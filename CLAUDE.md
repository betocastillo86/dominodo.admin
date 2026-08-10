# Dominodo Admin — CLAUDE.md

Angular SPA: the Dominodo **super administrator** panel. Consumes the `dominodo.api` REST API
**cross-tenant** (not bound to a single tenant). Full design: `docs/architecture.md`.

## Stack
- **Angular 20** (`@angular/* ^20.3`), **standalone components + signals**. No `NgModule`.
- **Tabler** (`@tabler/core` v1, SCSS) for the theme; **ng-bootstrap** (`^19`) for interactive components (no jQuery, no Bootstrap JS).
- `angular-tabler-icons` (`^3.26`) for icons; `jwt-decode` for reading JWT claims.
- State: signals + services (no NgRx). Forms: Reactive Forms.
- **Install note:** `.npmrc` sets `legacy-peer-deps=true` because `angular-tabler-icons@3.26` declares a
  stale peer range (`@angular <=19`); its runtime APIs are forward-compatible with Angular 20.
- **Styling note:** Tabler v1 uses legacy Sass `@import` internally, so `src/styles/` uses `@import`
  (variables before the theme). Expect Dart Sass `@import` deprecation warnings — they originate in Tabler, not our code.

## Commands
- `npm start` — dev server at `http://localhost:4200`.
- `npm run build` — production build.
- `npm run build:stage` — build for **stage** (`--configuration stage`, stage API URL).
- `npm run build:prod` — build for **prod** (`--configuration production`, prod API URL).
- API base URL lives in `src/environments/` (`apiBaseUrl = http://localhost:5083/api/v1`).
- API Swagger: `http://localhost:5083/swagger/index.html`.

## Testing
- **This project has no automated test suite.** Do **not** add `.spec.ts` files, karma/jasmine,
  or any test runner. Verification is manual (see `docs/architecture.md` §9).

## Structure (`src/app/`)
- `core/` — singletons & cross-cutting, no feature UI: `auth/` (store, service, jwt util, token storage),
  `http/` (auth + error interceptors), `guards/`, `models/`.
- `layout/` — panel chrome ported from Tabler: `shell/`, `sidebar/`, `navbar/`.
- `shared/ui/` — reusable presentational pieces: `data-table/` (generic paged table), `page-header/`, `spinner/`.
- `features/<name>/` — lazy-loaded domains; each splits `data-access/` (services + models) from components.

**Env & hosting artifacts:** `src/environments/environment.stage.ts` holds stage config (prod is
`environment.ts`); `public/web.config` is the IIS SPA-fallback, copied to the deploy root at build time.

## Conventions
- `changeDetection: OnPush`; use `inject()`, not constructor DI.
- Native control flow `@if` / `@for` (never `*ngIf` / `*ngFor`).
- **Functional** interceptors and guards.
- kebab-case filenames; suffixes `.component.ts` / `.service.ts` / `.store.ts` / `.guard.ts`.
- DTOs typed exactly as the API returns them (camelCase); do not rename.
- **UI copy is in Spanish**; code, identifiers, and docs are in English.

## API contract (essentials)
- Base URL: `http://localhost:5083/api/v1`. Panel endpoints are **cross-tenant** — no `X-Tenant` header.
- Auth: `POST /auth/login {phone,password}` → `{accessToken, refreshToken, expiresAt}`;
  `POST /auth/refresh {token}`; `POST /auth/logout {token}`.
- JWT is tenant-agnostic; the `role` claim (string | string[]) must include **`SuperAdmin`** to enter the panel.
- Paged responses: `PagedResult<T> = { items, page, pageSize, totalCount, totalPages }`.
- Errors: RFC 9457 `ProblemDetails` — `{ type, title, status, detail, errors? }`.

## Auth flow
- `authInterceptor` adds `Authorization: Bearer <accessToken>` (except `/auth/login`, `/auth/refresh`).
- `errorInterceptor`: on 401 attempts one refresh + retry, else logout + redirect; maps `ProblemDetails` to a message.
- Guards: `authGuard` (valid session) + `superAdminGuard` (role includes `SuperAdmin`).

## Docs
- `docs/architecture.md` — authoritative architecture, structure, and API contract.
- `docs/deployment.md` — stage/prod FTP deployment: branch→env mapping, build configs, `web.config`, Azure DevOps pipeline + variable groups.
- `plan_init.md` — phased implementation plan for the first slice (auth + roles).
