import { Injectable, signal } from '@angular/core';
import { APP_VERSION, DISPLAY_VERSION, IS_VERSION_STAMPED } from './app-version';

/** How often to ask the server which release is currently published. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Detects that a new version was deployed while the user had the app open.
 *
 * `web.config` keeps `index.html` uncacheable, so a reload always picks up the
 * latest build — but a long-lived tab never reloads on its own. This service
 * closes that gap: it polls `/version.json` (published by the same pipeline run
 * that stamped `APP_VERSION`) and flips `updateAvailable` when they differ, which
 * is what `VersionBannerComponent` renders.
 *
 * Uses `fetch`, not `HttpClient`, on purpose: `errorInterceptor` turns failed
 * requests into user-facing error toasts, and a background poll that blips while
 * the user is offline must stay completely silent.
 */
@Injectable({ providedIn: 'root' })
export class VersionCheckService {
  private readonly _updateAvailable = signal(false);
  private started = false;

  /** True once a different version is published. Never flips back to false. */
  readonly updateAvailable = this._updateAvailable.asReadonly();

  /** The release the user is currently running (`dev` in local builds). */
  readonly currentVersion = DISPLAY_VERSION;

  /** Idempotent — safe to call from every component that renders the banner. */
  start(): void {
    // A dev build has no published counterpart to compare against.
    if (this.started || !IS_VERSION_STAMPED) {
      return;
    }
    this.started = true;

    void this.check();
    setInterval(() => void this.check(), POLL_INTERVAL_MS);

    // Coming back to the tab is the cheapest, most likely moment to catch a deploy.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.check();
      }
    });
  }

  reload(): void {
    location.reload();
  }

  private async check(): Promise<void> {
    // Once flagged there is nothing left to learn; stop polling.
    if (this._updateAvailable()) {
      return;
    }

    try {
      // Absolute path: a relative one would resolve against the current deep
      // link (e.g. /requests/123/version.json).
      const response = await fetch('/version.json', { cache: 'no-store' });
      if (!response.ok) {
        return;
      }

      const published = (await response.json()) as { version?: string };
      if (published.version && published.version !== APP_VERSION) {
        this._updateAvailable.set(true);
      }
    } catch {
      // Offline, or a transient blip. Deliberately silent.
    }
  }
}
