import { computed, Injectable, Signal, signal, WritableSignal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HealthState, HealthStatus, HealthTarget, HealthTargetKey } from './health.models';

/** Readiness probe, served at the host root by both services — never under `/api/v1`. */
const HEALTH_PATH = '/health/ready';

/**
 * Both services run on Azure App Service **Free (F1)**: no Always On, so they unload after a few
 * idle minutes and the next request has to wake them up. That wake-up takes far longer than a
 * normal request, so the timeout is generous on purpose — cutting it short would paint a service
 * red while it is merely booting.
 */
const PROBE_TIMEOUT_MS = 25_000;

/** While a service is not answering, keep knocking: the knocking is also what wakes it up. */
const RETRY_WHEN_DOWN_MS = 5_000;

/** Once it answers there is nothing left to warm up — just keep an eye on it. */
const RETRY_WHEN_HEALTHY_MS = 30_000;

const UNKNOWN: HealthStatus = { state: 'checking', detail: null, latencyMs: null, checkedAt: null };

/** `/health/ready` hangs off the host root, so any path in the base URL (`/api/v1`) is dropped. */
function healthUrl(baseUrl: string): string {
  return new URL(HEALTH_PATH, baseUrl).toString();
}

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

const TARGETS: readonly HealthTarget[] = [
  {
    key: 'api',
    label: 'API',
    description: 'Backend REST que consume este panel',
    url: healthUrl(environment.apiBaseUrl),
  },
  {
    key: 'domi',
    label: 'Domi',
    description: 'Agente conversacional de WhatsApp',
    url: healthUrl(environment.domiBaseUrl),
  },
];

/**
 * Polls the readiness probe of the API and of Domi, and exposes each result as a signal.
 *
 * Uses `fetch` rather than `HttpClient` on purpose: `authInterceptor` would attach an
 * `Authorization` header — turning a probe that needs no preflight into one that does — and
 * `errorInterceptor` would raise a toast on every failed tick of a five-second poll.
 *
 * The loop is sequential, not a fixed interval: the next probe is scheduled once the previous
 * one settles, so a slow wake-up never stacks requests on a service that is already struggling.
 *
 * `start()`/`stop()` are reference-counted because two screens watch these services — the login
 * and the dashboard. The handover between them must not depend on whether the router destroys one
 * before it creates the other: whoever arrives first opens the loop, whoever leaves last closes it.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly statuses = new Map<HealthTargetKey, WritableSignal<HealthStatus>>(
    TARGETS.map((target) => [target.key, signal(UNKNOWN)]),
  );
  private readonly timers = new Map<HealthTargetKey, ReturnType<typeof setTimeout>>();
  private readonly inFlight = new Map<HealthTargetKey, AbortController>();
  /** How many screens are watching; the loop runs while this is above zero. */
  private monitors = 0;

  readonly targets = TARGETS;

  /** Every target with its current status — what both screens render. */
  readonly snapshot = computed(() =>
    this.targets.map((target) => ({ ...target, status: this.statusOf(target.key)() })),
  );

  /** Live status of one target. */
  statusOf(key: HealthTargetKey): Signal<HealthStatus> {
    return this.statuses.get(key)!;
  }

  /** Registers a watcher; the first one starts the loop. */
  start(): void {
    this.monitors += 1;
    if (this.monitors > 1) {
      return;
    }
    for (const target of this.targets) {
      void this.probe(target);
    }
  }

  /** Unregisters a watcher; the last one out stops the loop and drops what is in flight. */
  stop(): void {
    this.monitors = Math.max(0, this.monitors - 1);
    if (this.monitors > 0) {
      return;
    }
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    for (const controller of this.inFlight.values()) {
      controller.abort();
    }
    this.inFlight.clear();
  }

  /** Re-checks everything right now, ignoring the pending schedule. */
  refresh(): void {
    for (const target of this.targets) {
      const timer = this.timers.get(target.key);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(target.key);
      }
      void this.probe(target);
    }
  }

  private async probe(target: HealthTarget): Promise<void> {
    // A manual refresh (or a stop()) can land mid-probe; the older attempt is abandoned.
    this.inFlight.get(target.key)?.abort();

    const controller = new AbortController();
    this.inFlight.set(target.key, controller);

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PROBE_TIMEOUT_MS);

    // Yellow while the answer is pending — but only when we do not already know the service is
    // up, so a healthy card does not blink on every poll.
    this.statuses
      .get(target.key)!
      .update((current) =>
        current.state === 'healthy' ? current : { ...current, state: 'checking', detail: null },
      );

    const startedAt = performance.now();
    let result: HealthStatus;

    try {
      const response = await fetch(target.url, {
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });
      result = response.ok
        ? { state: 'healthy', detail: null, latencyMs: elapsedMs(startedAt), checkedAt: new Date() }
        : down(`HTTP ${response.status}`, startedAt);
    } catch {
      // An abort we did not cause by timing out means this probe was superseded: leave the card
      // alone and let the newer probe own the schedule.
      if (controller.signal.aborted && !timedOut) {
        return;
      }
      result = down(timedOut ? 'Sin respuesta (tiempo agotado)' : 'No responde', startedAt);
    } finally {
      clearTimeout(timeout);
      if (this.inFlight.get(target.key) === controller) {
        this.inFlight.delete(target.key);
      }
    }

    this.statuses.get(target.key)!.set(result);
    this.scheduleNext(target, result.state);
  }

  private scheduleNext(target: HealthTarget, state: HealthState): void {
    if (this.monitors === 0) {
      return;
    }
    const delay = state === 'healthy' ? RETRY_WHEN_HEALTHY_MS : RETRY_WHEN_DOWN_MS;
    this.timers.set(
      target.key,
      setTimeout(() => void this.probe(target), delay),
    );
  }
}

function down(detail: string, startedAt: number): HealthStatus {
  return { state: 'down', detail, latencyMs: elapsedMs(startedAt), checkedAt: new Date() };
}
