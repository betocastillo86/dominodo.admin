# Dominodo Admin — Architecture

> Dominodo **super administrator** panel: an Angular SPA that consumes the `dominodo.api` REST API
> to manage platform features **cross-tenant** (not bound to a specific community).
>
> This is a high-level guide to how the panel is built and how to extend it. It captures the shape and
> the conventions, not every field and method — read the code for specifics. Keep it current as the panel grows.

---

## 1. Purpose and scope

`dominodo.admin` is the global administration interface. Its user is the **SuperAdmin** (a `Platform`-scoped
role), who manages resources that do not depend on a specific tenant.

Current modules: **Authentication** (login by phone + password, restricted to SuperAdmin), **Roles**
(list, create, edit), **Users** (list with filters, create, edit), **Tenants** (list, create, edit
of the conjuntos), and **System Settings** (list, create, edit of global configuration rows). Future
modules (permissions, memberships, notifications) follow the same conventions described here.

---

## 2. Stack

- **Angular (v20+), standalone + signals** — no `NgModule`; `provideRouter`/`provideHttpClient`,
  **functional** interceptors and guards, `@if`/`@for`, `inject()`.
- **Tabler** (`@tabler/core`, SCSS) as the global theme (Bootstrap 5, no jQuery); the layout is ported to
  Angular components.
- **ng-bootstrap** for interactive components (dropdowns, modals…) on top of Tabler's CSS — Bootstrap's JS is not used.
- **`angular-tabler-icons`** for icons.
- **State**: signals + services (`AuthStore`, `data-access` services). No NgRx.
- **HTTP**: `HttpClient` + functional interceptors (Bearer auth, ProblemDetails + refresh on 401).
- **Forms**: Reactive Forms. **JWT**: `jwt-decode` (client reads the `role` claim; verification is the server's job).

---

## 3. API contract

- **Base URL:** `http://localhost:5083/api/v1/` (configurable via `environment`). **Swagger:** `/swagger/index.html`.
- **Paged responses:** `PagedResult<T> = { items, page, pageSize, totalCount, totalPages }`.
- **Errors:** RFC 9457 `ProblemDetails` → `{ type, title, status, detail, errors?: [{ property, message }] }`.
- **Multi-tenancy:** the endpoints this panel uses (`auth`, `roles`, `permissions`, `tenants`) are
  **cross-tenant** and do **not** send the `X-Tenant` header.
- **Auth:** `POST /auth/login` (`{phone,password}` → tokens), `/auth/refresh`, `/auth/logout`. The JWT is
  tenant-agnostic and carries **no** permissions; the SuperAdmin is identified by a `role` claim that
  includes **`SuperAdmin`**. Fine-grained permissions are enforced **server-side** (a `403` surfaces as `ProblemDetails`).

> Two contract rules worth knowing up front: a role's `scope` is set on create and **immutable** on edit,
> and **system roles** (`isSystem`) are treated as read-only in the panel.

---

## 4. Project structure

**Feature-first**, with a `core` / `layout` / `shared` / `features` split. Each feature separates
`data-access` (services + models) from its presentation components and is **lazy-loaded**.

```
src/app/
├── core/        # singletons & cross-cutting, no feature UI
│   ├── auth/       # service, store (signals), token storage, jwt util
│   ├── http/       # auth + error interceptors
│   ├── guards/     # authGuard, superAdminGuard
│   └── models/     # shared contracts (e.g. PagedResult, ProblemDetails)
├── layout/      # panel chrome: shell (sidebar + navbar + outlet)
├── shared/ui/   # reusable presentational pieces (data-table, page-header, spinner)
└── features/    # lazy domains, each with data-access/ + components
    ├── auth/             # blank layout → login
    ├── roles/            # list + form (create/edit share one component)
    ├── users/            # list + form (create/edit share one component)
    ├── tenants/          # list + form (create/edit share one component)
    └── system-settings/  # list + form (create/edit share one component)
```

- **`core/`**: single instances and cross-cutting concerns; no business UI.
- **`layout/`**: the sidebar/navbar chrome, kept separate from features.
- **`shared/ui/`**: reusable Tabler-based pieces (the generic paged `data-table` is the notable one).
- **`features/*`**: one isolated, lazy-loaded domain each; `data-access` decouples data from presentation.

---

## 5. Routing

Everything is lazy. Login lives in a **blank** layout (no shell). All other routes hang off the
`ShellComponent` and are protected by `authGuard` + `superAdminGuard`. The shell defaults to `roles`.
New modules are added as lazy children under the shell.

---

## 6. Feature patterns

Reference implementations that new features should mirror.

**Authentication.** `LoginComponent` (reactive phone + password) → `AuthService.login()`, which decodes the
JWT, checks the `role` claim includes `SuperAdmin`, and only then stores the session in `AuthStore` (signals)
and enters the panel. `authInterceptor` attaches the Bearer token; `errorInterceptor` attempts a single
refresh-and-retry on 401 and maps `ProblemDetails` to user-facing messages. Guards gate access.

**Roles** (the template for CRUD modules):
- A **`data-access` service** owns the API calls. List state is exposed as **signals**
  (`roles`/`paging`/`loading`/`error`); write operations return **Observables** the caller manages locally.
- The **list** uses the shared `DataTable` with a page-header action ("+ Nuevo rol") and a per-row edit link.
- A **single form component** handles both create and edit, resolving the mode from the route (`:id` present
  → edit). It respects the contract rules: `scope` disabled on edit, and the whole form read-only for
  system roles. On success it notifies and navigates back to the list; on error it maps `ProblemDetails`
  (field errors → controls, 409 → name, else a global message).

**Tenants** follow the same shape. Two notes worth flagging: `slug` and `type` are set on create and
**immutable on edit** (disabled with a hint, like Roles' `scope`), and the list's `name`/`status`
filters are **wired ahead of API support** — the UI and query params are in place, but `GET /tenants`
does not yet read them, so they no-op until the backend adds them.

The `DataTable` is generic and presentational: columns are declared as data (value + optional badge/link
functions), pagination is server-side via `PagedResult`, and it renders loading/error/empty states itself.

---

## 7. Conventions

- **Standalone** components, `OnPush`, `inject()` (not constructor DI).
- Native `@if` / `@for` (no `*ngIf` / `*ngFor`).
- kebab-case filenames; `.component.ts` / `.service.ts` / `.store.ts` / `.guard.ts` suffixes.
- DTOs typed exactly as the API returns them (camelCase); not renamed.
- **UI copy in Spanish**; code, identifiers, and docs in English.
- Extend shared components in a **backward-compatible** way (new inputs optional, sensible defaults).

---

## 8. Verification

**No automated test suite** — this project ships no `.spec.ts` files and no test runner, by design.
Verification is **manual**: run the API (`http://localhost:5083`, seeded SuperAdmin) and `npm start`, then
exercise the flow end-to-end (login happy/rejected paths, the feature's CRUD, guard redirects, and error
mapping). Every change must `npm run build` with no type errors.

---

## 9. Setup

```bash
ng new dominodo-admin --style=scss --routing --ssr=false --directory .
npm i @tabler/core @ng-bootstrap/ng-bootstrap @popperjs/core angular-tabler-icons jwt-decode
```

- `app.config.ts` wires the router, `HttpClient` with the two interceptors, and the icons provider.
- `styles.scss` (Tabler + overrides) is registered in `angular.json`; `environment.development.ts` sets `apiBaseUrl`.
- A repo-root `.npmrc` sets `legacy-peer-deps=true` (a stale peer range in `angular-tabler-icons`, runtime-compatible).
- Tabler v1 uses legacy Sass `@import`, so its deprecation warnings during build are expected and originate in Tabler.
