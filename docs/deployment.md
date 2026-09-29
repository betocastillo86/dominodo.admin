# Deployment — Dominodo Admin

How the super-admin panel is built and deployed to its two hosting environments over FTP, driven by
Azure DevOps. This mirrors the `pollaya.admin.front` pattern, modernized for Angular 20 (environment
`fileReplacements` instead of build-time `sed` string injection).

## Environments

| Environment | Branch    | Build configuration | Front-end URL                       | API base URL (`apiBaseUrl`)                                  | FTP variable group      |
| ----------- | --------- | ------------------- | ----------------------------------- | ------------------------------------------------------------ | ----------------------- |
| **prod**    | `main`    | `production`        | `https://admin.dominodo.com`        | `https://app-dominodo-api-prod.azurewebsites.net/api/v1`      | `dominodo-admin-prod`   |
| **stage**   | `develop` | `stage`             | `https://adminstage.dominodo.com`   | `https://app-dominodo-api-stage.azurewebsites.net/api/v1`     | `dominodo-admin-stage`  |

Both API URLs are `azurewebsites.net` hosts rather than `api.dominodo.com`: the web apps run on Free
(F1) App Service plans, which support no custom domain. When prod moves to B1, `api.dominodo.com`
becomes a DNS record plus a hostname binding, and only `apiBaseUrl` changes here.

`admin.dominodo.com` is a DNS record on the **same FTP/IIS hosting** as stage — the admin panel is
never served from Azure.

## Branch → environment mapping

- Push / merge to **`main`** → builds `production` → deploys to the **prod** FTP folder.
- Push / merge to **`develop`** → builds `stage` → deploys to the **stage** FTP folder.

PRs do not deploy (the pipeline `pr` trigger is disabled).

## Build configurations

Selected purely by `--configuration`; no post-build string replacement.

- `src/environments/environment.ts` — **prod** values (used by `production`, the default configuration).
- `src/environments/environment.stage.ts` — **stage** values; the `stage` configuration swaps it in via
  Angular `fileReplacements`. `production: true` keeps stage optimized like prod; only the URL differs.
- `src/environments/environment.development.ts` — local dev (`http://localhost:5083/api/v1`).

npm scripts:

```bash
npm run build:prod    # ng build --configuration production  → prod bundle
npm run build:stage   # ng build --configuration stage       → stage bundle
```

Output lands in `dist/dominodo-admin/browser/` (the `application` builder's `browser` subfolder).

## IIS SPA fallback — `web.config`

Hosting is Windows/IIS. `public/web.config` is copied to the deploy root automatically by the
`angular.json` assets rule (`{ glob: "**/*", input: "public" }`), so it ends up at
`dist/dominodo-admin/browser/web.config`.

It rewrites any request that is **not** a real file/directory and **not** under `/api/` to
`/index.html`, so deep-route reloads (e.g. `/roles`, `/requests/123`) resolve to the SPA instead of a
404. It also maps `.json` / `.webmanifest` MIME types.

## Cache strategy — why a deploy is visible immediately

**The problem this solves.** The hosting applies `Cache-Control: max-age=31536000` (one year) to
every static file it serves, `index.html` included — verifiable with
`curl -sSI https://<host>/ | grep -i cache-control`. A browser therefore never revalidates
`index.html`, and a stale `index.html` keeps referencing the **previous** build's hashed bundles,
which are still on disk (`clean: false`). Everything loads fine and the new release is simply never
picked up, for days. This is exactly the symptom users reported: "I have to clear my cache to see
the changes".

`public/web.config` fixes it by carving out one exception:

| Resource | `Cache-Control` | Why |
| --- | --- | --- |
| `index.html` (and every SPA-rewritten route) | `no-cache` + `Expires: -1` | It is the pointer to everything else — always revalidate it (a cheap `304` when unchanged) |
| `*-<hash>.js`, `*-<hash>.css` | `max-age=31536000` | Content-addressed by `outputHashing: "all"`; a new build emits new filenames |
| `favicon.*` | `max-age=86400` | Copied verbatim from `public/`, so **not** hashed |

Implemented with `<staticContent><clientCache>` for the 1-year default and
`<location path="index.html">` with `cacheControlMode="DisableCache"` for the exception. `<location>`
config is resolved *after* the URL Rewrite module runs, so it covers SPA deep links too, not just a
literal request for `/index.html`.

> ⚠️ The 1-year default is only safe because **every** JS/CSS filename is content-hashed. If
> `outputHashing` is ever turned off, or an unhashed file is added to `public/`, it gets cached for a
> year — give it its own `<location>` block. Today the only unhashed files in the deploy root are
> `index.html`, `favicon.*` and `web.config` (IIS never serves the last one).

**Nothing else is needed.** Cloudflare fronts the site but returns `cf-cache-status: DYNAMIC` for
HTML — it does not cache it — and the hashed bundles change filename every release, so there is
nothing to purge. No pipeline change, no cache-busting query strings, no edge rules.

### `/reset-cache.html` — evicting the caches poisoned before the fix

The `no-cache` above only protects browsers that ask. It does nothing for the ones that already
stored `index.html` during the bad window (**2026-08-10 → 2026-08-28**, first stage deploy to
`1dbd451`): those entries carry `max-age=31536000`, stay *fresh* until August 2027, and a fresh
entry is never revalidated. Measured on a cold load of `/` by an affected user, via Cloudflare's RUM
beacon:

```json
{ "nt": "navigate", "dt": "cache", "timingsV2": { "transferSize": 0, "decodedBodySize": 28782 } }
```

`transferSize: 0` — not a 304, not a slow request. **No request.** The browser boots the August
bundle (`main-WXYFEID2.js`) without contacting the server, so no header, rewrite rule or redirect can
reach it. Clearing the browser cache is also unreliable: Chrome's dialog defaults to a *Last hour*
time range, which leaves an August entry untouched.

The only lever is a URL that cannot be in the cache, because it did not exist when the cache was
poisoned. `public/reset-cache.html` is that URL:

| Step | What happens |
| --- | --- |
| Something requests `/reset-cache.html` | Never cached → always a real network request |
| IIS answers with `Clear-Site-Data: "cache"` | Browser **drops the entire origin cache**, poisoned `index.html` included |
| The page redirects to `/` | Nothing left to reuse → clean fetch of the current build |

Two ways in, and both are wanted:

- **By hand** — send an affected user `https://<host>/reset-cache.html`. One click, permanent.
- **Automatically** — `core/version/cache-heal.ts` fetches it once, ever, from `main.ts`, so anyone
  who reaches a current build by any route is repaired silently.

Notes:

- Only `"cache"`. `"storage"` or `"*"` would also wipe `localStorage` and sign every user out.
- The flag in `localStorage` is **not** keyed to the release. This repairs one historical mistake;
  re-running it per deploy would discard every hashed bundle the user has cached, for nothing.
- `reset-cache.html` needs its own `DisableCache` block — it is unhashed (the rule above), and a
  cached copy would be served without ever delivering the header.
- Safari does not support `Clear-Site-Data`; those users still need a hard reload.
- Related hardening in the same commit: the SPA rewrite now excludes asset extensions, so a missing
  bundle returns a real **404** instead of `index.html`. Previously a stale `index.html` pointing at a
  deleted bundle pulled HTML into a `<script>` tag, and any legacy service worker on the origin could
  never be unregistered (browsers drop a worker whose script 404s, but keep one answering 200 HTML).

### Version stamping and the "new version available" banner

The `no-cache` on `index.html` only kicks in when the browser asks for it again — a reload, or
reopening the tab. A tab left open all afternoon never does, because Angular swaps components on
route changes without reloading the document. These pieces close that gap:

| Piece | What it does |
| --- | --- |
| `src/app/core/version/app-version.ts` | `APP_VERSION` placeholder compiled **into the bundle** |
| `public/version.json` | the same placeholder, published as a **separate file** at `/version.json` |
| `Stamp build version` pipeline step | one `sed` replaces `___buildid___` with `$(Build.BuildId)` in **both**, before `ng build` |
| `core/version/version-check.service.ts` | polls `/version.json` every 5 min (and on tab focus) and compares it to `APP_VERSION` |
| `shared/ui/version-banner/` | renders the "Actualizar ahora" prompt when they differ |

Because a single pipeline run stamps both files with the same id, the bundle knows which release it
is and the server publishes which release is current — a mismatch means a deploy happened since the
tab was opened.

Notes:

- `version.json` gets its own `<location>` block with `DisableCache` in `web.config`. Without it the
  poll would read a cached copy and report the old release forever.
- The check uses `fetch`, not `HttpClient`, on purpose: `errorInterceptor` turns failed requests into
  user-facing error toasts, and a background poll must stay silent when the user is offline.
- The banner **prompts**, it does not auto-reload — a forced refresh would discard a half-written form.
- Local dev builds never run the stamp step, so the placeholder survives; `IS_VERSION_STAMPED` detects
  that, skips the polling entirely, and the header shows `vdev`.
- The running version is shown in the header next to the user menu, so a user reporting a bug can say
  which build they are on.

### Verifying after a deploy

```bash
HOST=https://adminstage.dominodo.com
curl -sSI "$HOST/" | grep -i cache-control          # expect: no-cache
curl -sSI "$HOST/roles"    | grep -i cache-control   # expect: no-cache (SPA rewrite path)

ASSET=$(curl -sS "$HOST/" | grep -o 'main-[A-Za-z0-9]*\.js' | head -1)
curl -sSI "$HOST/$ASSET" | grep -i cache-control    # expect: max-age=31536000
```

If `/` still shows `max-age=31536000`, the `web.config` did not take effect — check that it reached
the deploy root and that the site returns 200 and not a `500.19` configuration error.

## Pipeline — `pipelines/build-ftp-pipeline.yaml`

One Azure DevOps pipeline, branch-scoped:

1. Selects the variable group + `BUILD_CONFIG` from `Build.SourceBranchName` (`main`→prod, `develop`→stage).
2. Installs Node.js 20, runs `npm ci` (respects `.npmrc` `legacy-peer-deps=true`).
3. `npx ng build --configuration $(BUILD_CONFIG)`.
4. `FtpUpload@2` uploads `dist/dominodo-admin/browser` to `$(FTP_REMOTE_DIR)` on `$(FTP_HOST)`.

### Variable groups (Pipelines → Library)

No secrets live in the repo. Create two variable groups, each with these keys:

| Key             | Notes                                                        |
| --------------- | ----------------------------------------------------------- |
| `FTP_HOST`      | e.g. `ftp://winXXXX.site4now.net/`                          |
| `FTP_USERNAME`  | FTP account user                                            |
| `FTP_PASSWORD`  | **Mark as secret**                                          |
| `FTP_REMOTE_DIR`| target folder — stage: `/dominodoadminstage/` (SmarterASP); prod: TBD |

- `dominodo-admin-prod`  → prod hosting folder (TBD).
- `dominodo-admin-stage` → stage hosting folder (`dominodoadminstage` on SmarterASP).

Stage and prod may share one FTP account with different folders, or use separate accounts — the
variable-group design supports either without YAML changes.

### One-time Azure DevOps setup (manual, outside the repo)

1. Create the two variable groups above.
2. Create the pipeline from the GitHub repo pointing at `pipelines/build-ftp-pipeline.yaml`
   (GitHub service connection, as pollaya does).

## Placeholders to fill

1. ~~**Prod API URL**~~ — done: `app-dominodo-api-prod.azurewebsites.net/api/v1`.
2. ~~**Stage API URL**~~ — done: `app-dominodo-api-stage.azurewebsites.net/api/v1`.
3. **FTP host/creds/folders** — the two variable groups (never commit these). Stage folder:
   `dominodoadminstage` (SmarterASP); prod folder TBD.
4. **DNS** — `admin.dominodo.com` must point at the prod folder's hosting.

## Cross-repo prerequisite — CORS

Cross-origin login needs the front-end origin in the **API's** `Cors:AllowedOrigins`, which lives in
`dominodo.api/src/Bootstrap/Dominodo.Api/appsettings.<Env>.json` — **not** in
`infra/envs/*/*.tfvars`, whose `cors_allowed_origins` configures the storage account's blob CORS
(direct SAS uploads/downloads), a different thing. Both already cover this panel:

- **stage** — `appsettings.Staging.json` allows `https://*.dominodo.com`, which matches
  `adminstage.dominodo.com`.
- **prod** — `appsettings.Production.json` allows `https://*.dominodo.com`, which matches
  `admin.dominodo.com`.
