# Plan — Crear/Editar Roles (vista y controlador reutilizados)

**Generado:** 2026-07-22
**Rama:** main · **Proyecto:** `dominodo.admin` (Angular 20, standalone + signals)

---

## Context

Hoy la feature de Roles (`src/app/features/roles/`) es **solo lectura**: `RoleListComponent`
lista roles paginados vía `RolesService.list()` (`GET /roles`). No existe forma de crear ni editar
roles desde el panel.

La API ya expone el contrato completo para escritura (verificado contra el Swagger vivo en
`http://localhost:5083/swagger/v1/swagger.json`):

| Método | Endpoint | Body | Respuesta |
|---|---|---|---|
| `GET`  | `/roles/{id}` | — | `200 RoleDetailDto` · `404 ProblemDetails` |
| `POST` | `/roles` | `CreateRoleRequest` | `201` · `400`/`409 ProblemDetails` |
| `PUT`  | `/roles/{id}` | `UpdateRoleRequest` | `204` · `400`/`404 ProblemDetails` |
| `GET`  | `/permissions` | — | `200 PermissionDto[]` |

DTOs exactos de la API (camelCase, no renombrar):

```ts
// CreateRoleRequest — scope SÍ es editable al crear
{ name: string; description?: string | null; scope: RoleScope; permissionIds?: number[] | null }

// UpdateRoleRequest — OJO: NO incluye scope → el scope es INMUTABLE al editar
{ name: string; description?: string | null; permissionIds?: number[] | null }

// RoleDetailDto — GET /roles/{id}. Devuelve `permissions` (resumen), NO `permissionIds`
{ id: number; name: string; description?: string | null; isSystem: boolean;
  scope: RoleScope; permissions: { id: number; code: string }[] }

// PermissionDto — GET /permissions
{ id: number; code: string; description: string; group: string }

type RoleScope = 'Platform' | 'Tenant';
```

**Objetivo:** una única vista/controlador `RoleFormComponent` que sirve para **crear** (ruta sin `id`)
y **editar** (ruta con `id`), permitiendo editar todos los campos que la API admite en cada modo.

**Decisiones de UX confirmadas con el usuario:**
- **Roles de sistema** (`isSystem === true`): formulario en **solo lectura** con banner informativo y
  sin botón Guardar (protección en cliente frente a 403/400 del servidor).
- **Selector de permisos**: **checkboxes agrupados** por el campo `group` de `PermissionDto`,
  mostrando `description` por permiso.

**Reglas derivadas del contrato (no negociables):**
- `scope` se elige al crear; al editar se muestra **deshabilitado** (la API no lo acepta en `PUT`).
- Al cargar para editar, mapear `RoleDetailDto.permissions.map(p => p.id)` → IDs seleccionados en el form.

---

## Phase 1 — Data-access: modelos y métodos de escritura ✅ COMPLETED (2026-07-22)

> **Ejecución:** añadidos `RoleDetailDto`, `RolePermissionSummaryDto`, `CreateRoleRequest`, `UpdateRoleRequest` a `role.models.ts`; creados `permission.models.ts` y `permissions.service.ts`; añadidos `getById`, `create`, `update` a `roles.service.ts`. `npm run build` sin errores de tipos.

**Objetivo:** que `RolesService` soporte leer un rol por id, crear y actualizar; añadir acceso a permisos.

**Inputs / prerequisitos:** endpoints ya existentes en la API (verificados). Sin cambios de backend.

**Acciones:**

1. **`features/roles/data-access/role.models.ts`** — añadir (sin tocar `RoleDto`/`RoleScope` existentes):
   ```ts
   export interface RoleDetailDto {
     id: number; name: string; description?: string; isSystem: boolean;
     scope: RoleScope; permissions: RolePermissionSummaryDto[];
   }
   export interface RolePermissionSummaryDto { id: number; code: string; }
   export interface CreateRoleRequest {
     name: string; description?: string | null; scope: RoleScope; permissionIds: number[];
   }
   export interface UpdateRoleRequest {
     name: string; description?: string | null; permissionIds: number[];
   }
   ```

2. **`features/roles/data-access/permission.models.ts`** (nuevo):
   ```ts
   export interface PermissionDto { id: number; code: string; description: string; group: string; }
   ```

3. **`features/roles/data-access/permissions.service.ts`** (nuevo, `providedIn: 'root'`):
   - `list(): Observable<PermissionDto[]>` → `GET {apiBaseUrl}/permissions`.
   - Patrón `inject(HttpClient)` + `environment.apiBaseUrl` igual que `RolesService`.
   - Nota: cuando exista el módulo de Permisos (roadmap de `architecture.md`), este servicio se relocaliza;
     por ahora vive en `roles/data-access` porque solo lo consume el formulario de roles.

4. **`features/roles/data-access/roles.service.ts`** — añadir métodos que devuelven `Observable`
   (el formulario se suscribe y maneja loading/error localmente; **no** tocar el estado por signals de la lista):
   ```ts
   getById(id: number): Observable<RoleDetailDto>            // GET /roles/{id}
   create(body: CreateRoleRequest): Observable<void>          // POST /roles → 201
   update(id: number, body: UpdateRoleRequest): Observable<void> // PUT /roles/{id} → 204
   ```
   - Reutilizar `this.base` existente. No duplicar el manejo de error por signals (`toError` es para la lista).

**Expected outcome:** capa de datos completa para CRUD de roles + catálogo de permisos.

**Exit criteria:** `npm run build` compila sin errores de tipos; los tres métodos usan las URLs correctas.

---

## Phase 2 — `RoleFormComponent` (crear/editar en un solo componente) ✅ COMPLETED (2026-07-22)

> **Ejecución:** creado `role-form/role-form.component.ts` (standalone, OnPush, Reactive Forms) con: resolución de modo por `:id`; form tipado `nonNullable` (`name` required+maxLength(100), `description`, `scope` required y `disable()` en edición); selección de permisos vía `signal<Set<number>>` con `toggle()`/`isChecked()`; carga de permisos agrupados por `group` (ordenados) y del rol en edición (precarga selección desde `permissions.map(p=>p.id)`, `readOnly`+`form.disable()` si `isSystem`); `onSubmit` con create/update, `NotificationService.success` + navegación a `/roles`, y mapeo de `ProblemDetails` (409 → `name`; `errors[]` → controles; fallback a `detail`/`title`). Señales de UI: `loadingPermissions`, `loadingRole`, `saving`, `error`, `readOnly`. Creado `.html` funcional mínimo (se completa en Phase 3). `npm run build` sin errores.

**Objetivo:** un componente que resuelve modo por presencia de `:id` en la ruta y edita todos los campos.

**Inputs / prerequisitos:** Phase 1 completa.

**Acciones:**

1. Crear **`features/roles/role-form/role-form.component.ts`** + `.html`, standalone, `OnPush`,
   `inject()`, Reactive Forms, `@if`/`@for`. Imports: `ReactiveFormsModule`, `PageHeaderComponent`,
   `RouterLink`, `SpinnerComponent`, `TablerIconComponent`.

2. **Resolución de modo:**
   - Leer `id` de la ruta con `inject(ActivatedRoute).snapshot.paramMap.get('id')`.
   - `mode = id ? 'edit' : 'create'` (signal/const). Título dinámico vía `PageHeader`
     ("Nuevo rol" / "Editar rol").

3. **Formulario reactivo tipado (`nonNullable`):**
   - `name`: `[Validators.required, Validators.maxLength(100)]`.
   - `description`: opcional.
   - `scope`: `FormControl<RoleScope>` con `Validators.required`. En modo `edit` se **deshabilita**
     (`control.disable()`), porque `UpdateRoleRequest` no admite `scope`.
   - `permissionIds`: modelado como `FormArray`/mapa de checkboxes o un `FormControl<number[]>`
     gestionado con helpers `toggle(id)` / `isChecked(id)` (recomendado: `signal<Set<number>>` para la
     selección + validación mínima). Elegir el enfoque más simple y tipado.

4. **Carga de datos (`ngOnInit` / constructor):**
   - Siempre: `PermissionsService.list()` → agrupar por `group` (helper que produce
     `{ group: string; permissions: PermissionDto[] }[]`, ordenado). Guardar en signal para el template.
   - Modo `edit`: `RolesService.getById(id)`:
     - Rellenar `name`, `description`, `scope` (disabled), y precargar la selección con
       `permissions.map(p => p.id)`.
     - Si `role.isSystem === true` → activar bandera `readOnly` (signal): deshabilitar todo el form
       (`form.disable()`) y ocultar el botón Guardar; mostrar banner informativo (ver Phase 3).
   - Señales de UI locales: `loadingPermissions`, `loadingRole`, `saving`, `error`, `fieldErrors`.

5. **Envío (`onSubmit`):**
   - Guard: si inválido → `markAllAsTouched()` y salir; si `readOnly` → no hacer nada.
   - `saving.set(true)`.
   - Modo `create`: `RolesService.create({ name, description || null, scope, permissionIds })`.
   - Modo `edit`: `RolesService.update(id, { name, description || null, permissionIds })`
     (**sin** `scope`; usar `form.getRawValue()` no aplica a scope porque no se envía).
   - **Éxito** → `NotificationService.success('Rol creado' | 'Rol actualizado')`
     + `Router.navigate(['/roles'])`.
   - **Error** (`HttpErrorResponse`) → mapear `ProblemDetails`:
     - `409` (nombre duplicado en create) → mensaje en `error` y/o marcar `name` con error.
     - `400` con `errors[]` → asignar a los controles por `property` (`setErrors({ server: message })`),
       fallback al `detail`/`title` en `error`.
     - Reutilizar la forma de `ProblemDetails` de `core/http/problem-details.ts`.
   - `saving.set(false)` en `finalize`.

**Expected outcome:** un componente único que crea y edita, con estados de carga/guardado/errores.

**Exit criteria:** navegando a `/roles/new` renderiza el form vacío con scope habilitado; a `/roles/:id/edit`
precarga datos con scope deshabilitado; un rol `isSystem` aparece en solo lectura sin botón Guardar.

---

## Phase 3 — Template del formulario (Tabler) ✅ COMPLETED (2026-07-22)

> **Ejecución:** `role-form.component.html` completo con Tabler: `app-page-header` con título dinámico; `container-xl` → `card`/`card-body`; banner `alert alert-info` con `tabler-icon` cuando `readOnly()`; `app-spinner` mientras `loading()`; campo `name` con `is-invalid`/`invalid-feedback` (server/required/maxlength), `description` textarea, `scope` `form-select` (deshabilitado por el control en edición + `form-hint`); permisos como checkboxes agrupados por `group` en grid, con `code` + `description`; `alert alert-danger` para `error()`; acciones `@if (!readOnly())` con Guardar (spinner inline en `saving()`) y Cancelar (`routerLink="/roles"`). `npm run build` sin errores.

**Objetivo:** UI en español, coherente con Tabler y con el resto del panel.

**Acciones (`role-form.component.html`):**

1. `<app-page-header [title]="mode==='edit' ? 'Editar rol' : 'Nuevo rol'" pretitle="Administración" />`.
2. `page-body` → `card` con `card-body`:
   - **Banner de solo lectura** (`@if (readOnly())`): `div.alert.alert-info` — p. ej.
     "Este es un rol de sistema y no puede editarse."
   - **Spinner** mientras `loadingRole() || loadingPermissions()` (usar `SpinnerComponent`).
   - **Campos:**
     - `name` — `input.form-control` (+ estado `is-invalid` y `.invalid-feedback` con el error del control/servidor).
     - `description` — `textarea.form-control`.
     - `scope` — `select.form-select` con opciones `Platform`/`Tenant` (labels "Plataforma"/"Tenant");
       deshabilitado en edición (el propio `control.disabled` lo refleja).
     - **Permisos** — por cada grupo (`@for` sobre grupos): encabezado del grupo + `@for` de permisos con
       `input.form-check-input[type=checkbox]`, label `code` + texto `description`. `(change)` → `toggle(id)`,
       `[checked]="isChecked(id)"`.
   - **Acciones** (`@if (!readOnly())`): botón `Guardar` (`btn btn-primary`, `[disabled]="saving()"`,
     spinner inline cuando `saving()`), botón `Cancelar` (`routerLink="/roles"`, `btn btn-link`).
   - Si `error()` global → `div.alert.alert-danger`.

**Expected outcome:** formulario usable y consistente con `login.component.html` / `role-list.component.html`.

**Exit criteria:** validaciones visibles; checkboxes agrupados; en edición el `scope` se ve bloqueado.

---

## Phase 4 — Rutas y navegación ✅ COMPLETED (2026-07-22)

> **Ejecución:** `roles.routes.ts` con rutas `new` y `:id/edit` (lazy, mismo `RoleFormComponent`). `DataTableComponent` extendido de forma retrocompatible con inputs opcionales `actionLink` (default `null`) y `actionIcon` (default `'edit'`); template renderiza una columna final con `<a [routerLink]>` + `tabler-icon` solo si `actionLink()`, y ajusta el `colspan` del empty state. `RoleListComponent`: añadido `RouterLink` a imports, botón "+ Nuevo rol" en el slot `[actions]` del page-header, y `editLink = (r) => ['/roles', r.id, 'edit']` pasado a `[actionLink]`. `npm run build` sin errores.

**Objetivo:** enrutar hacia el form y ofrecer puntos de entrada desde la lista.

**Acciones:**

1. **`features/roles/roles.routes.ts`** — añadir rutas hijas (lazy `loadComponent`):
   ```ts
   { path: '', loadComponent: … RoleListComponent }
   { path: 'new', loadComponent: () => import('./role-form/role-form.component').then(m => m.RoleFormComponent) }
   { path: ':id/edit', loadComponent: () => import('./role-form/role-form.component').then(m => m.RoleFormComponent) }
   ```
   (Ambas rutas apuntan al **mismo** componente → controlador/vista reutilizados, como pidió el usuario.)

2. **Punto de entrada "Nuevo rol"** en `role-list.component.html`: usar el slot `[actions]` del
   `PageHeaderComponent` (ya soporta `<ng-content select="[actions]">`) con un
   `<a routerLink="/roles/new" actions class="btn btn-primary">+ Nuevo rol</a>`.
   Requiere añadir `RouterLink` a los `imports` de `RoleListComponent`.

3. **Editar por fila:** extender `shared/ui/data-table/data-table.component.ts` de forma
   **retrocompatible** con un input opcional para una columna de acción de tipo enlace:
   ```ts
   readonly actionLink = input<((row: T) => string) | null>(null);   // p.ej. r => `/roles/${r.id}/edit`
   readonly actionIcon = input<string>('edit');
   ```
   - En `data-table.component.html`: `@if (actionLink())` renderiza una columna final con
     `<a [routerLink]="actionLink()!(row)" class="btn btn-icon btn-sm"><tabler-icon .../></a>`.
     Añadir `RouterLink` y `TablerIconComponent` a los imports del data-table.
   - `RoleListComponent` pasa `[actionLink]="editLink"` con `editLink = (r) => ['/roles', r.id, 'edit']`
     (o string). Uso existente en cualquier otra tabla queda intacto (input opcional, default `null`).

**Expected outcome:** desde la lista se abre "Nuevo rol" y el lápiz de cada fila abre la edición.

**Exit criteria:** rutas resuelven al mismo componente; botones navegan correctamente; la lista sin
`actionLink` sigue igual.

---

## Phase 5 — Documentación ✅ COMPLETED (2026-07-22)

> **Ejecución:** actualizado `docs/architecture.md`: §3.2 con filas `GET /roles/{id}`, `POST /roles`, `PUT /roles/{id}` + sección `/permissions`, DTOs `RoleDetailDto`/`CreateRoleRequest`/`UpdateRoleRequest`/`PermissionDto`, y notas de `scope` inmutable en `PUT` + roles `isSystem` de solo lectura; §4 con `role-form/`, `permission.models.ts`, `permissions.service.ts` y métodos de escritura de `roles.service.ts`; §6.2 con `RoleFormComponent` (crear/editar por ruta), `PermissionsService` y los puntos de entrada de la lista (reemplazada la nota "Read-only … no create/edit yet"); §10 con la extensión opcional `actionLink`/`actionIcon` del `DataTableComponent`.

**Objetivo:** mantener `docs/architecture.md` como fuente de verdad.

**Acciones:**
- **§3.2 Roles**: añadir filas `POST /roles`, `GET /roles/{id}`, `PUT /roles/{id}` y la sección `/permissions`,
  con los DTOs `CreateRoleRequest`, `UpdateRoleRequest`, `RoleDetailDto`, `PermissionDto`. Documentar que
  `scope` es inmutable en `PUT` y que los roles `isSystem` son solo lectura en el panel.
- **§4 estructura**: añadir `role-form/` y `data-access/permission*.ts` bajo `features/roles/`.
- **§6.2**: describir `RoleFormComponent` (crear/editar por ruta) reemplazando la nota "Read-only … (no create/edit yet)".
- **§10**: registrar la extensión opcional `actionLink` del `DataTableComponent`.

**Exit criteria:** el doc refleja el CRUD implementado.

---

## Verification (manual — este proyecto NO tiene test suite)

Prerrequisito: API en `http://localhost:5083` con SuperAdmin sembrado; `npm start` → `http://localhost:4200`.

1. `npm run build` → sin errores de tipos/lint.
2. **Crear:** `/roles` → "+ Nuevo rol" → `/roles/new`; `scope` habilitado; completar nombre + permisos →
   Guardar → toast de éxito → vuelve a `/roles` con el rol nuevo en la lista.
3. **Validación:** enviar sin nombre → error de required; crear con nombre duplicado → `409` mapeado a mensaje.
4. **Editar:** lápiz en una fila → `/roles/:id/edit`; datos precargados; `scope` **deshabilitado**;
   permisos precargados desde `RoleDetailDto.permissions`; cambiar y Guardar → `204` → toast → lista actualizada.
5. **Rol de sistema:** editar un rol `isSystem` → formulario en solo lectura, banner visible, sin botón Guardar.
6. **Guard:** entrar directo a `/roles/new` sin sesión → redirige a `/auth`.
7. **404:** `/roles/999999/edit` con id inexistente → error mapeado del `404 ProblemDetails`.

---

## Assumptions & Open Questions

**Assumptions:**
- El acceso a crear/editar se controla con los guards existentes (`authGuard` + `superAdminGuard`).
  El JWT **no** transporta permisos (`architecture.md` §3.1), así que el permiso fino `roles.manage`
  lo **aplica el servidor** (403 → se muestra el `ProblemDetails`). No se añade gating adicional en cliente.
- `permissionIds` se envía siempre como array (vacío si no hay selección), no `null`.
- `scope` inmutable en edición y roles `isSystem` en solo lectura (confirmado con el usuario).
- `PermissionsService` vive temporalmente en `roles/data-access` hasta que exista el módulo de Permisos.

**Open questions:** No blocking questions identified.
