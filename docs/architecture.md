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
(list, create, edit), **Users** (list with filters, create, edit), **Tenants** (list, create, edit of
the conjuntos), **System Settings** (list, create, edit of global configuration rows),
**Memberships** (a single page showing current members plus a filterable invitations section, and
an invite form with optional apartment assignment), and
**Notification Templates / Messages** (template editing, sent-message read-only views),
and **Request Categories** (cross-tenant catalog of PQRS categories, list + create + edit). Future
modules follow the same conventions described here.

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
- **Multi-tenancy:** most endpoints this panel uses (`auth`, `roles`, `permissions`, `tenants`) are
  **cross-tenant** and do **not** send the `X-Tenant` header. Tenant-scoped endpoints (`apartments`,
  `memberships`) require the `X-Tenant: <slug>` header and receive the slug via a `?tenant=` query param.
- **Auth:** `POST /auth/login` (`{phone,password}` → tokens), `/auth/refresh`, `/auth/logout`. The JWT is
  tenant-agnostic and carries **no** permissions; the SuperAdmin is identified by a `role` claim that
  includes **`SuperAdmin`**. Fine-grained permissions are enforced **server-side** (a `403` surfaces as `ProblemDetails`).

> Two contract rules worth knowing up front: a role's `scope` is set on create and **immutable** on edit,
> and **system roles** (`isSystem`) are treated as read-only in the panel.

- **Chat simulation:** `POST /chat-simulation` (`{phone,text}` → `{reply}`) forwards a simulated message
  to Domi. `GET /chat-simulation/{phone}/messages?afterTurn=N&includeBeforeReset=false` returns
  `{ conversationId, cursor, resetAfterTurn, messages[] }` — cursor pattern (Domi ADR-0027): `afterTurn=0`
  rehydrates the thread, subsequent calls pass the returned `cursor` for deltas. The panel polls this
  endpoint every 4 s and merges new turns by the `turnNumber:role` pair; the `POST` reply is no longer
  painted directly — all turns (including the agent's response and system nudges) arrive through the
  transcript. The panel sends **phone only** — Domi resolves the tenant from the number, and any spelling
  of a number canonicalizes to the same bare E.164 conversation (Domi ADR-0012), so the panel canonicalizes
  before it calls.

  `DELETE /chat-simulation/{phone}` **resets** the conversation — it does not delete it (Domi ADR-0013).
  Domi's transcript is append-only: the reset clears the agent's conversational state and stamps a **cut**
  on the transcript, reported back as `resetAfterTurn` (`0` = never reset). The pull hides everything up to
  that cut by default, so the panel empties after a reset while the audit trail survives and is readable
  with `includeBeforeReset=true` — which is what the "Ver historial completo" toggle sends, rendering a
  separator at the cut. The resident's identity link survives a reset, so notifications keep reaching them.

  Its statuses carry meaning: `204` there was something to reset · `404 Chat.NoConversation` the number
  never wrote, a **benign** outcome the panel reports as information, not an error · `400 Chat.InvalidPhone`
  Domi rejected the number · `502 Chat.UpstreamUnavailable` Domi is unreachable. The error code travels in
  the ProblemDetails `title`. All three routes opt out of the global error toast via the `SILENT_ERRORS`
  HTTP context token (`core/http/silent-errors.ts`) — a polled endpoint would otherwise raise one toast per
  tick, and the reset's 404 is not an incident.

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
    ├── users/                  # list + form (create/edit share one component)
    ├── tenants/                # list + form (create/edit share one component)
    ├── system-settings/        # list + form (create/edit share one component)
    ├── notification-templates/ # list + edit-only form (no create/delete)
    ├── notification-messages/  # read-only lists of sent messages (email/push/in-app)
    ├── memberships/            # tenant-scoped: members + invitations on one page, + invite form
    ├── requests/               # cross-tenant PQRS list + detail/edit page (edit, status, participant)
    ├── request-categories/     # cross-tenant catalog: list, create, edit of PQRS categories
    ├── announcements/          # cross-tenant list (status/category/tenant filters) + create/edit form
    ├── knowledge-resources/    # cross-tenant list (status/category/tenant filters) + create/edit form
    └── chat-simulation/        # Domi chat tester (phone gate → bubble chat); polls GET …/messages?afterTurn= for async turns, renders the reset cut
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

**Notification Templates** is a variation worth noting: the API exposes **only list + edit** (`GET`/`PUT
/notification-templates`), so there is **no create and no delete** — the form is edit-only and the list has
no "+ Nuevo" action. Templates are seeded by the backend; their `type` is **immutable** (shown disabled),
and `localization` is read-only but part of the `PUT` body, so its loaded value is re-sent unchanged. The
form has **conditional per-channel sections** (Email / In-App / Push) revealed by their enable toggles, and
the email body is edited with a **WYSIWYG editor** (`ngx-quill`, configured via `provideQuillConfig` in
`app.config.ts`; the Quill theme CSS is registered in `angular.json`). This module also introduced
**grouped sidebar navigation**: a "Notificaciones" parent (collapsible via a signal, no Bootstrap JS) with a
"Plantillas" child.

**Request Categories** is a cross-tenant catalog (`GET/POST/PUT /request-categories`, no `X-Tenant`
header) that lives under the "Solicitudes" sidebar group alongside the requests list. It follows the
standard list + form pattern: `code` is set on create and **immutable on edit** (disabled with a
hint), `isActive` is a boolean toggle, and the list accepts `name`, `code`, and `isActive` filters.

**Requests** is the PQRS management module. It lists cross-tenant requests from `GET /requests`
(filtered by tenant, status, type, priority, visibility, category, or free-text search) and provides
a detail/edit page at `/requests/:id/edit?tenantId=<uuid>`. A request's **category is a `categoryId`**
referencing the tenant-scoped `request-categories` catalog (`GET /request-categories`, `X-Tenant`),
so the edit form renders it as a required `<select>` populated from that tenant's categories. In the
list, the category filter is **dependent on the tenant filter** — it stays disabled until a tenant is
picked, then loads that tenant's categories; the `categoryId` query param is **wired ahead of API
support** (like the tenants list filters) and no-ops until `GET /requests` reads it. The detail page bundles three write
operations in one view: edit request fields (`PUT /requests/{id}`), change lifecycle status with
an optional note (`PUT /requests/{id}/status`), and add a participant
(`POST /requests/{id}/participants`). The participant picker is an **ng-bootstrap `NgbTypeahead`**
autocomplete that searches the tenant's memberships server-side (`GET /memberships?search=`,
debounced, `X-Tenant`-scoped) and submits the chosen membership's `userId` — no raw UUID entry.
Searching memberships (rather than users) guarantees the target already belongs to the tenant.
Because write endpoints require the `X-Tenant` header (a slug), the detail component resolves the
slug from the `tenantId` query param by calling `TenantsService.getById()` before loading the
request detail.

**Notification Messages** are the **materialized** (already-sent) notifications, exposed as three
**read-only** paged lists — Email (`GET /messages/email`), Push (`GET /messages/push`), and In-App
(`GET /notifications`). Each is a plain `DataTable` list with its own signal-based service (no forms, no row
actions, since the API has no per-message detail/edit). Email and Push accept a `status` filter
(`AdminDeliveryStatus`: Pending/Sent/Failed); In-App has none. They hang off the same "Notificaciones"
sidebar group as the templates, under the `notification-messages/{email|push|in-app}` routes.

**Knowledge Resources** is the cross-tenant knowledge base. Its list mirrors Announcements — a cross-tenant
`GET /knowledge-resources` (no `X-Tenant` header, filtered by `status`, free-text `category`, and `tenantId`
query params) rendered in a `DataTable` with a per-row edit link that carries the resource's `tenantId` as a
query param. Its create/edit follow the **Requests** write pattern instead: the create/update bodies carry no
`tenantId`, so the operations are tenant-scoped via the `X-Tenant` slug header. On **create** the user picks a
conjunto and its slug is resolved from the loaded catalog; on **edit** the `tenantId` query param is resolved
to a slug via `TenantsService.getById` (the conjunto is then immutable). A resource is always created as a
**Draft** (the create body has no `status`); its lifecycle (`Draft`/`Published`/`Archived`) is driven by the
`status` field, which is therefore only shown in edit mode.

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
