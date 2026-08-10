# Deployment — Dominodo Admin

How the super-admin panel is built and deployed to its two hosting environments over FTP, driven by
Azure DevOps. This mirrors the `pollaya.admin.front` pattern, modernized for Angular 20 (environment
`fileReplacements` instead of build-time `sed` string injection).

## Environments

| Environment | Branch    | Build configuration | Front-end URL                       | API base URL (`apiBaseUrl`)                                  | FTP variable group      |
| ----------- | --------- | ------------------- | ----------------------------------- | ------------------------------------------------------------ | ----------------------- |
| **prod**    | `main`    | `production`        | *(TBD)*                             | `https://api.dominodo.com/api/v1` *(PLACEHOLDER)*            | `dominodo-admin-prod`   |
| **stage**   | `develop` | `stage`             | `https://admin.stage.dominodo.com`  | `https://app-dominodo-api-stage.azurewebsites.net/api/v1`     | `dominodo-admin-stage`  |

The **stage** API URL is live (`app-dominodo-api-stage.azurewebsites.net`). The **prod** API URL is
still a **placeholder** — the prod API is not deployed yet. Update it once the API is live (see
[Placeholders to fill](#placeholders-to-fill-once-the-api-is-deployed)).

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

## Placeholders to fill (once the API is deployed)

1. **Prod API URL** — `src/environments/environment.ts` → `apiBaseUrl` (still a placeholder).
2. ~~**Stage API URL**~~ — done: `app-dominodo-api-stage.azurewebsites.net/api/v1`.
3. **FTP host/creds/folders** — the two variable groups (never commit these). Stage folder:
   `dominodoadminstage` (SmarterASP); prod folder TBD.

## Cross-repo prerequisite — CORS

The API's `cors_allowed_origins` (`dominodo.api/infra/envs/*/*.tfvars`) is currently `localhost`-only
(stage) / empty (prod). The stage/prod **front-end URLs must be added there** and the API re-applied
before cross-origin login works. This is an API-repo action, but it is a hard prerequisite for a green
login on either hosted environment.

- **stage** — add `https://admin.stage.dominodo.com` to the stage API's `cors_allowed_origins`.
- **prod** — add the prod front-end URL (TBD) once it is defined.
