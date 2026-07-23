---
name: domi-new-module
description: Scaffold a new CRUD feature module in dominodo.admin (Angular 20, standalone + signals) following the Roles reference implementation — list with filters, create/edit form with validation, optional delete. Interactive — gathers the module contract before writing code.
model: sonnet
user-invokable: true
---

# domi-new-module

You are scaffolding a **new feature module** in `dominodo.admin` — the Dominodo super-admin panel
(Angular 20, standalone components + signals, Tabler + ng-bootstrap). The **Roles feature is the canonical
reference**: mirror its structure, conventions, and error handling exactly. Read `CLAUDE.md` and
`docs/architecture.md` first, then the Roles files below as living templates.

**Reference files (read these before writing anything):**
- `src/app/features/roles/data-access/role.models.ts` — DTO + request typing
- `src/app/features/roles/data-access/roles.service.ts` — list via signals, writes via Observable
- `src/app/features/roles/data-access/permissions.service.ts` — a plain read-only catalog service
- `src/app/features/roles/role-list/role-list.component.{ts,html}` — list + filters + page-header action + row action
- `src/app/features/roles/role-form/role-form.component.{ts,html}` — single create/edit component
- `src/app/features/roles/roles.routes.ts` — lazy routes (`''` / `new` / `:id/edit`)
- `src/app/shared/ui/data-table/data-table.component.{ts,html}` — generic paged table
- `src/app/app.config.ts` — **icon registration** (a recurring gotcha)

---

## Non-negotiable conventions (from CLAUDE.md)

- **No tests.** Never create `.spec.ts` files or a test runner. Verification is manual + `npm run build`.
- Standalone components, `changeDetection: OnPush`, `inject()` (never constructor DI).
- Native `@if` / `@for` (never `*ngIf` / `*ngFor`). Functional guards/interceptors.
- kebab-case filenames; `.component.ts` / `.service.ts` / `.store.ts` suffixes.
- DTOs typed **exactly** as the API returns them (camelCase); do not rename.
- **UI copy in Spanish**; code, identifiers, comments, and docs in English.
- List state lives in the service as **signals**; write operations return **Observables** the component
  subscribes to and manages locally (loading/error). Do not push writes through the list signals.
- Extend shared components (e.g. `DataTable`) only in a **backward-compatible** way (new inputs optional, defaults preserved).
- **Every `<tabler-icon name="x">` must have its `IconX` registered in `app.config.ts`** — unregistered icons render blank.

---

## Step 0 — Gather the module contract (INTERACTIVE — do this first)

Do not write code until you have this. Verify endpoints against the live Swagger
(`http://localhost:5083/swagger/v1/swagger.json`) when reachable; otherwise ask the user. Use
`AskUserQuestion` to collect, in this order:

1. **Module identity**
   - English identifier, singular + plural (e.g. `tenant` / `tenants`) → drives filenames, folder, service/component names.
   - Spanish UI labels, singular + plural (e.g. "Comunidad" / "Comunidades") → drives all on-screen copy.

2. **Operations that apply** — confirm which of: **list**, **create**, **edit**, **delete**. Delete is
   optional; only scaffold it if the API supports it and the user wants it.

3. **API contract** — for each operation, the endpoint, request body, and response. Capture the exact DTOs
   (list item DTO, detail DTO if different, create request, update request, any catalog/lookup needed for
   selects). Note the response codes for errors (typically `400`/`404`/`409` → `ProblemDetails`).

4. **List filters** — enumerate the query params the list endpoint accepts (e.g. `name`, `status`, a scope
   enum, date ranges). **Present the full list of available filters and ask the user which ones to expose**
   in the UI. Default to a debounced text input for free-text and a `select` for enums, mirroring the Roles list.

5. **Create/edit rules** — for each field, capture: required?, max length / pattern / min-max, enum options,
   **immutable-on-edit?** (like Roles' `scope` — disabled in edit mode), and any **"at least one" collection
   rule** (like Roles' `permissionIds`). Also ask whether there is a **read-only condition** on an entity
   (like Roles' `isSystem` → whole form disabled + info banner + hidden save).

Summarize the gathered contract back to the user and get a confirmation before scaffolding.

---

## Step 1 — Data-access (`features/<plural>/data-access/`)

- `<singular>.models.ts` — the DTOs and request interfaces, typed exactly as the API returns them. Follow the
  Roles split: a list DTO, a detail DTO if the API differs (e.g. returns nested summaries instead of ids),
  `Create<Singular>Request`, `Update<Singular>Request`. Comment immutable/notable fields inline.
- `<plural>.service.ts` (`providedIn: 'root'`) — mirror `RolesService`:
  - `list(page, pageSize, ...filters)` pushing into private signals exposed read-only:
    `items`/`paging`/`loading`/`error` (name the collection after the module). Include a private `toError()`.
  - `getById(id): Observable<DetailDto>`, `create(body): Observable<void>`, `update(id, body): Observable<void>`,
    and `remove(id): Observable<void>` **only if delete applies**.
- Any lookup/catalog needed by a select → a small read-only service like `PermissionsService`.

## Step 2 — List component (`<singular>-list/`)

Mirror `RoleListComponent` + its HTML:
- `app-page-header` with the Spanish plural title and a **"+ Nuevo <singular>"** action in the `[actions]` slot → `/<plural>/new`.
- The chosen **filters** as reactive controls (debounced text via `debounceTime(300)` + `distinctUntilChanged`;
  `select` for enums), reloading page 1 on change. Only wire the filters the user picked in Step 0.
- `app-data-table` with typed `columns`, server pagination bound to `paging()`, `[rowKey]`, and
  `[actionLink]="editLink"` (`editLink = (row) => ['/<plural>', row.id, 'edit']`).
- **If delete applies:** add a delete affordance per row. Prefer an ng-bootstrap confirm modal (never a
  silent destructive action); on confirm call `service.remove(id)` then reload. If the `DataTable` needs a
  second row action, extend it **backward-compatibly** (new optional input, default off) exactly as
  `actionLink`/`actionIcon` were added.

## Step 3 — Create/edit form (`<singular>-form/`)

Mirror `RoleFormComponent` + its HTML — **one component for both modes**:
- Resolve mode from the route: `id = route.snapshot.paramMap.get('id')`; `mode = id ? 'edit' : 'create'`.
- Typed `nonNullable` reactive form. Apply the validators gathered in Step 0 (`Validators.required`,
  `maxLength`, `pattern`, etc.). **Immutable-on-edit** fields → `control.disable()` in edit mode and a
  `form-hint` explaining why. Send the update request **without** immutable fields.
- **"At least one" collection rules** → manage the selection with a `signal<Set<number>>` + `toggle`/`isChecked`,
  a computed `hasX`, and a `submitted` flag gating the error message; block submit if empty (see the
  `permissionIds` pattern). Group checkbox catalogs like Roles groups permissions by `group`.
- **Read-only condition** (e.g. `isSystem`) → `readOnly` signal: `form.disable()`, info banner
  (`alert alert-info` + icon), hide the Save button.
- Loading/UI signals: `loadingDetail`, any catalog `loading`, `saving`, `error`, `submitted`.
- On submit success → `NotificationService.success('<Entidad> creado' | 'actualizado')` + `Router.navigate(['/<plural>'])`.
- On error map `ProblemDetails` (reuse `core/http/problem-details.ts`): `409` → the conflicting control
  (usually the name); `errors[]` → per-control `setErrors({ server: message })` (map PascalCase property →
  camelCase control); fallback to `detail`/`title` in a global `error` alert. `saving.set(false)` in `finalize`.
- Template: Tabler markup consistent with the Roles form — `is-invalid`/`invalid-feedback`, `required` labels,
  spinner while loading, inline spinner on the Save button while `saving()`, Cancel link back to the list.

## Step 4 — Routing, navigation & icons

- `<plural>.routes.ts`: lazy `loadComponent` for `''` (list), `'new'` and `':id/edit'` (**both → the same
  form component**).
- Register the module route in `src/app/app.routes.ts` under the shell (lazy, guarded like the rest) and add
  a sidebar entry in `layout/sidebar/` if the panel exposes navigation there.
- **Register every new icon** used by the templates (edit/delete/info/etc.) in `app.config.ts`'s
  `provideTablerIcons({...})` — this is the easiest thing to forget and produces invisible icons.

## Step 5 — Documentation

Update `docs/architecture.md` in the same lightweight, general style it already uses: note the new module
under the structure section and, if the module introduces a genuinely new pattern, mention it. Do **not**
dump full DTOs or method lists — the doc is a guide; the code and Swagger are the source of truth.

---

## Closing

- `npm run build` must pass with no type errors (Tabler Sass `@import` deprecation warnings are expected and fine).
- Summarize what was created and give the user a short **manual verification** checklist (create happy path,
  a required-field validation, edit prefills + immutable field disabled, delete confirm if applicable, and
  any read-only/at-least-one rule), since the project has no automated tests.
