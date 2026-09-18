/** The services the dashboard watches. */
export type HealthTargetKey = 'api' | 'domi';

/**
 * What the dashboard paints, in the colors the operator asked for: `checking` (yellow)
 * while a probe is in flight, `healthy` (green) on a 2xx, `down` (red) on anything else.
 */
export type HealthState = 'checking' | 'healthy' | 'down';

/** A probed service: where it lives and how it is named on screen. */
export interface HealthTarget {
  readonly key: HealthTargetKey;
  readonly label: string;
  readonly description: string;
  /** Absolute `/health/ready` URL, resolved from the environment at startup. */
  readonly url: string;
}

/** Last known result for one target. */
export interface HealthStatus {
  readonly state: HealthState;
  /** Why it is down (`HTTP 503`, timeout, no answer). `null` while it is not down. */
  readonly detail: string | null;
  /** Round trip of the last completed probe, in milliseconds. */
  readonly latencyMs: number | null;
  /** When that probe finished; `null` until the first one completes. */
  readonly checkedAt: Date | null;
}
