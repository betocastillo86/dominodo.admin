import { IS_VERSION_STAMPED } from './app-version';

/**
 * Set once the wipe has been done. Deliberately **not** keyed to the release:
 * this repairs one specific historical mistake, and re-running it every deploy
 * would throw away every hashed bundle the user has cached, for nothing.
 */
const STORAGE_KEY = 'dominodo.admin.httpCacheReset.v1';

/** Its response carries `Clear-Site-Data: "cache"` (see `public/web.config`). */
const RESET_URL = '/reset-cache.html';

/**
 * Wipes `index.html` cache entries poisoned before `1dbd451`.
 *
 * Between the first stage deploy (2026-08-10) and the `no-cache` fix
 * (2026-08-28) the hosting served `index.html` with `max-age=31536000`.
 * Browsers that loaded the panel in that window stored the entry point with a
 * one-year TTL, and a *fresh* entry is never revalidated — Cloudflare RUM
 * measured `dt: "cache"`, `transferSize: 0` on a cold load of `/`. Not a slow
 * request or a 304: no request. Nothing the server puts on `/` can reach those
 * users, and they keep booting the August build until 2027.
 *
 * Overwriting the entry is unreliable, so this deletes it instead. Fetching
 * `RESET_URL` — a URL too new to be in anyone's cache, so always a real
 * request — returns `Clear-Site-Data: "cache"`, which makes the browser drop
 * the whole origin cache, poisoned entry included. The next navigation to `/`
 * has nothing to reuse and must go to the network.
 *
 * Costs the user one re-download of the hashed bundles, once, ever.
 * Best-effort: never blocks bootstrap, never surfaces an error.
 */
export function resetPoisonedHttpCache(): void {
  // Local dev was never served the bad header.
  if (!IS_VERSION_STAMPED) {
    return;
  }

  try {
    if (localStorage.getItem(STORAGE_KEY)) {
      return;
    }
  } catch {
    // Storage blocked (private mode, hardened settings). Without somewhere to
    // record the wipe it would repeat on every load, so skip it entirely.
    return;
  }

  void fetch(RESET_URL, { cache: 'no-store' })
    .then((response) => {
      // A rewritten 200 from the SPA fallback would mean the file is missing
      // from the deploy; only record success when the real file answered.
      if (!response.ok) {
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      } catch {
        // Unreachable: the read above already succeeded.
      }
    })
    .catch(() => {
      // Offline or a transient blip: stay unmarked and retry on the next load.
    });
}
