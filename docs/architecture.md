# Dominodo Admin — Architecture

> Dominodo **super administrator** panel. An Angular SPA that consumes the `dominodo.api` REST API
> to manage platform features **cross-tenant** (not bound to a specific community).
>
> This document is the foundation the project is built on. Keep it up to date as the panel grows.

---

## 1. Purpose and scope

`dominodo.admin` is the global administration interface. The target user is the **SuperAdmin**
(a `Platform`-scoped role in the domain), who manages resources that do not depend on a specific tenant.

**Initial scope:**

1. **Authentication** — login by `phone` + `password`, restricted to SuperAdmin.
2. **Roles** — role listing.

The remaining modules (permissions, tenants, users, memberships, notifications, settings) will be added
following the same conventions described here.

---

## 2. Stack

| Area | Choice | Rationale |
|---|---|---|
| Framework | **Angular stable (v20/21), standalone + signals** | No `NgModule`. `provideRouter`, `provideHttpClient`, **functional** interceptors/guards, `@if/@for` control flow, `inject()`. Modern, maintainable standard. |
| UI / theme | **Tabler (`@tabler/core`, SCSS)** | Classic admin look, Bootstrap 5, **no jQuery**, actively maintained. Consumed as a global styling layer; the layout is ported to Angular components. |
| Interactive components | **ng-bootstrap** | Dropdowns, modals, offcanvas, tabs as idiomatic Angular components on top of the Bootstrap 5 CSS that Tabler already ships. Bootstrap's JS is **not** used. |
| Icons | **`angular-tabler-icons`** | Official Tabler icons as Angular components. |
| State | **Signals + services** | `AuthStore` and `data-access` services using `signal`/`computed`. Minimal boilerplate, scalable. No NgRx for now. |
| HTTP | `HttpClient` + functional interceptors | `authInterceptor` (Bearer) and `errorInterceptor` (ProblemDetails + refresh on 401). |
| Forms | **Reactive Forms** | Typed and declarative validation. |
| JWT decode | `jwt-decode` | Read the `role` claim client-side (claim reading only; verification is the server's job). |

---

## 3. API contract

- **Base URL:** `http://localhost:5083/api/v1/` (configurable via `environment`).
- **Swagger:** `http://localhost:5083/swagger/index.html`.
- **Paged responses:** `PagedResult<T> = { items: T[], page, pageSize, totalCount, totalPages }`.
- **Errors:** RFC 9457 `ProblemDetails` → `{ type, title, status, detail, errors?: [{ property, message }] }`.
- **Multi-tenancy:** tenant-scoped endpoints require the `X-Tenant: <slug>` header. The endpoints this panel
  uses (`auth`, `roles`, `permissions`, `tenants`) are **cross-tenant** and do **not** require that header.

### 3.1 Authentication

| Method | Endpoint | Body | Response |
|---|---|---|---|
| `POST` | `/auth/login` | `{ phone, password }` | `{ accessToken, refreshToken, expiresAt }` |
| `POST` | `/auth/refresh` | `{ token }` | `{ accessToken, refreshToken, expiresAt }` (rotates the refresh token) |
| `POST` | `/auth/logout` | `{ token }` | `204 No Content` |

- The **JWT is tenant-agnostic**. Relevant claims: `sub` (userId), `jti`, and `role` (one or more).
- The SuperAdmin is identified by the `role` claim that includes **`SuperAdmin`** (a `Platform`-scoped role).
- The JWT carries **no** `tenant_id` or permissions (both are resolved server-side).

### 3.2 Roles

| Method | Endpoint | Response |
|---|---|---|
| `GET` | `/roles?page=1&pageSize=20` | `PagedResult<RoleDto>` (requires the `roles.manage` permission, which SuperAdmin holds) |

```ts
type RoleScope = 'Platform' | 'Tenant';

interface RoleDto {
  id: number;
  name: string;
  description?: string;
  isSystem: boolean;
  scope: RoleScope;
  permissionIds: number[];
}
```

---

## 4. Project structure

**Feature-first** organization with `core` / `layout` / `shared` / `features` separation. Each feature separates
`data-access` (services + models) from the presentation components.

```
dominodo.admin/
├── docs/
│   └── architecture.md                 # this document
├── angular.json
├── package.json
├── tsconfig.json
└── src/
    ├── main.ts
    ├── index.html
    ├── environments/
    │   ├── environment.ts               # apiBaseUrl (prod)
    │   └── environment.development.ts    # apiBaseUrl = http://localhost:5083/api/v1
    ├── styles/
    │   ├── styles.scss                   # global entrypoint (Tabler + overrides)
    │   ├── _variables.scss               # tokens/palette (Tabler var overrides)
    │   └── _tabler.scss                   # @use "@tabler/core" + tweaks
    └── app/
        ├── app.config.ts                 # providers: router, http + interceptors, icons
        ├── app.routes.ts                 # root routes (lazy)
        ├── app.component.ts              # <router-outlet/>
        │
        ├── core/                         # singletons and cross-cutting (no feature UI)
        │   ├── auth/
        │   │   ├── auth.models.ts         # LoginRequest, AuthTokens, JwtClaims, AuthUser
        │   │   ├── auth.service.ts        # login/refresh/logout (HTTP)
        │   │   ├── auth.store.ts          # signals: token, user, isAuthenticated, isSuperAdmin
        │   │   ├── token-storage.service.ts # persistence (localStorage)
        │   │   └── jwt.util.ts            # decode + role-claim normalization
        │   ├── http/
        │   │   ├── auth.interceptor.ts    # Authorization: Bearer <accessToken>
        │   │   └── error.interceptor.ts   # ProblemDetails → toast + refresh on 401
        │   ├── guards/
        │   │   ├── auth.guard.ts          # canActivate: valid session
        │   │   └── super-admin.guard.ts   # canActivate: role claim includes SuperAdmin
        │   └── models/
        │       └── paged-result.ts        # PagedResult<T>
        │
        ├── layout/                        # panel shell, ported from Tabler
        │   ├── shell/                     # sidebar + navbar + <router-outlet/>
        │   ├── sidebar/
        │   └── navbar/                     # user + logout (ng-bootstrap dropdown)
        │
        ├── shared/                        # reusable across features
        │   └── ui/
        │       ├── data-table/             # generic paged table (Tabler markup)
        │       ├── page-header/
        │       └── spinner/
        │
        └── features/
            ├── auth/
            │   ├── auth.routes.ts          # "blank" layout (no shell) → login
            │   └── login/                  # reactive phone + password form
            └── roles/
                ├── roles.routes.ts
                ├── data-access/
                │   ├── role.models.ts      # RoleDto, RoleScope, PermissionDto
                │   └── roles.service.ts    # GET /roles → PagedResult<RoleDto> (signals)
                └── role-list/
```

### Rationale
- **`core/`**: single instances and cross-cutting concerns (auth, interceptors, guards). No business UI.
- **`layout/`**: the panel "chrome" (sidebar/navbar) kept separate from features.
- **`shared/ui/`**: reusable pieces built on Tabler. The paged `data-table` debuts with Roles.
- **`features/*`**: each functional domain isolated and **lazy-loaded**; `data-access` decouples data access
  from presentation (better testing and reuse).

---

## 5. Routing

`app.routes.ts` (everything lazy via `loadChildren` / `loadComponent`):

```
''            → redirect based on session
'auth'        → features/auth (blank layout)          [public]
''  (shell)   → layout/shell                           [canActivate: authGuard, superAdminGuard]
                 └── 'roles' → features/roles           (shell default → 'roles')
'**'          → redirect to ''
```

- Protected routes hang off the `ShellComponent` and apply `authGuard` + `superAdminGuard`.
- Login lives in a "blank" layout (Tabler's centered page), without a sidebar.

---

## 6. Initial feature design

### 6.1 Authentication

**`LoginComponent`** — Reactive Form:
- Fields: `phone` (required, E.164 pattern `^\+?[1-9]\d{7,14}$`) and `password` (required).
- Uses Tabler's sign-in template (centered card); validation and states handled in Angular.
- Submit → `AuthService.login({ phone, password })`.

**`AuthService`**:
- `login()` → `POST /auth/login`. On receiving tokens: decode the JWT, normalize `role` (string | array)
  and **validate that it includes `SuperAdmin`**.
  - If **not** SuperAdmin → clear storage and propagate "Access not authorized" (does not enter the panel).
  - If it is → `AuthStore` stores tokens + `AuthUser`, persists, and navigates to `/roles`.
- `refresh()` → `POST /auth/refresh`. `logout()` → `POST /auth/logout` + clear storage + navigate to `/auth`.

**`AuthStore`** (signals): `accessToken`, `refreshToken`, `user`, `isAuthenticated` (computed),
`isSuperAdmin` (computed). Rehydrated from `TokenStorageService` on startup.

**Interceptors**:
- `authInterceptor`: adds `Authorization: Bearer <accessToken>` except for `/auth/login` and `/auth/refresh`.
- `errorInterceptor`: on `401` attempts **one** refresh and retries the request; on failure → logout + redirect.
  Maps `ProblemDetails` (`title`/`detail`/`errors`) to a user-facing message.

**Guards**: `authGuard` (valid token) and `superAdminGuard` (`AuthStore.isSuperAdmin()`).

### 6.2 Roles

**`RolesService`** (`data-access`):
- `list(page, pageSize): Observable<PagedResult<RoleDto>>` → `GET /roles?page&pageSize`.
- Exposed signals: `roles`, `paging`, `loading`, `error`.

**`RoleListComponent`**:
- `PageHeader` ("Roles") + `DataTable` (`shared/ui`).
- Columns: **Name**, **Scope** (Platform/Tenant badge), **Description**, **System** (badge if `isSystem`),
  **# permissions** (`permissionIds.length`).
- Server-side pagination bound to `PagedResult`; `loading` and `error` states.
- Read-only in this scope (no create/edit yet).

---

## 7. Initial setup

```bash
# Scaffold (app name: dominodo-admin)
ng new dominodo-admin --style=scss --routing --ssr=false --directory .

# UI and infrastructure dependencies
npm i @tabler/core @ng-bootstrap/ng-bootstrap @popperjs/core angular-tabler-icons jwt-decode
```

- `styles.scss` imports Tabler + overrides and is registered in `angular.json`.
- `app.config.ts`: `provideRouter(routes)`,
  `provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]))`, and the
  `angular-tabler-icons` provider. ng-bootstrap is used by importing its standalone components per component.
- `environment.development.ts`: `apiBaseUrl = 'http://localhost:5083/api/v1'`.

---

## 8. Conventions

- **Standalone** components, `changeDetection: OnPush`, `inject()` instead of constructor DI.
- Native `@if` / `@for` control flow (no `*ngIf` / `*ngFor`).
- kebab-case filenames; `.component.ts` / `.service.ts` / `.store.ts` / `.guard.ts` suffixes.
- DTOs are typed exactly as they arrive (camelCase); not renamed unless necessary.
- UI copy in **Spanish**.

---

## 9. End-to-end verification

> **No automated test suite.** This project intentionally ships **no** `.spec.ts` files and no test
> runner (karma/jasmine were removed from the scaffold). All verification below is **manual**.

1. **API** (`dominodo.api`) running at `http://localhost:5083` with a seeded SuperAdmin.
2. `npm start` (`ng serve`) → app at `http://localhost:4200`.
3. **Happy login:** E.164 phone + SuperAdmin password → redirects to `/roles`; the navbar shows the user.
4. **Rejected login (non-SuperAdmin):** a user without the Platform SuperAdmin role → "Access not authorized", no entry.
5. **Invalid credentials:** the `errorInterceptor` surfaces the `ProblemDetails` `detail` (401).
6. **Role listing:** seeded roles appear with their scope badge and permission count; pagination reflects `totalCount`.
7. **Guard:** navigating to `/roles` without a session → redirects to `/auth`.
8. **Refresh:** with an expired access token, a 401 triggers a transparent refresh and retry.
9. `ng build` with no type/lint errors.

---

## 10. Implementation notes & divergences (Phase 1, 2026-07-22)

Recorded where the built code differs from the design above. The design remains the intended target.

- **Angular 20 toolchain.** Built on Angular **20.3** (`@angular/* ^20.3`), matching the "v20/21" stack.
  Companion versions: `@ng-bootstrap/ng-bootstrap ^19`, `angular-tabler-icons ^3.26`, `zone.js ~0.15`,
  `typescript ~5.8`. A repo-root **`.npmrc`** sets `legacy-peer-deps=true` because `angular-tabler-icons@3.26`
  declares a stale peer range (`@angular <=19`) despite being runtime-compatible with Angular 20.
- **Tabler styling via `@import`.** `src/styles/{_variables,_tabler,styles}.scss`. Tabler v1 imports its
  partials with the legacy Sass `@import` system, so overrides are declared before the theme via `@import`
  (not `@use`). Builds emit Dart Sass `@import` deprecation warnings that originate in Tabler, not our code.
- **Production bundle budget** raised (`initial` warning 1.2 MB / error 2 MB) to accommodate Tabler's full
  global CSS. Prod build: ~828 kB raw initial, ~132 kB transferred (gzip).
- **Notification service.** Added `core/notifications/notification.service.ts` — a minimal signal-based bus
  the `errorInterceptor` pushes `ProblemDetails` messages to. A toast UI that renders it is a later concern.
- **`role.models.ts`** ships `RoleDto` + `RoleScope` only; **`PermissionDto` was not created** — the listing
  needs just `permissionIds.length`, so no permission DTO is required yet.
- **Generic `DataTable`.** `DataTableComponent<T>` takes `columns`/`rows` inputs and a `pageChange` output;
  badges are declared per column via a `badgeClass(row)` function (no `TemplateRef`), keeping it fully typed.
- **No automated tests** (see §9): the scaffold's karma/jasmine and all `.spec.ts` were removed by request.
- **Contract check against the live API (no auth):** `POST /auth/login` with bad credentials returns
  RFC 9457 ProblemDetails (`title: "Auth.InvalidCredentials"`, `detail: "Phone or password is incorrect."`);
  `GET /roles` without a token returns `401`. Both match the interceptor/guard assumptions.
