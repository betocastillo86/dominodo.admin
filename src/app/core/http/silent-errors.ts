import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * When set, `errorInterceptor` skips the global toast for that request and lets the
 * caller decide what to render. The 401 refresh-and-retry path is unaffected.
 *
 * Use it where a failure is not necessarily an incident the operator must be alerted
 * about — a polled endpoint (one toast per tick otherwise) or a call whose non-2xx
 * statuses carry business meaning, such as the chat reset's benign 404.
 */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

/** Shorthand for `{ context: silentErrors() }` on an HttpClient call. */
export function silentErrors(): HttpContext {
  return new HttpContext().set(SILENT_ERRORS, true);
}
