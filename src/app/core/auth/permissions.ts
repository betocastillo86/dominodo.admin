/**
 * Permission codes the panel gates UI on. They mirror `Permissions` in the API
 * (`Dominodo.Shared.Kernel.Authorization`) — keep the strings in sync.
 *
 * The panel is cross-tenant and never sends `X-Tenant`, so `GET /auth/current` answers
 * with the caller's **Platform-scope** grants only. Holding a code here therefore means
 * holding it at platform scope, which is exactly what the platform-gated writes demand
 * (e.g. `PUT /users/{id}/password`, behind `[HasPlatformPermission(users.edit)]`).
 */
export const PERMISSION_USERS_EDIT = 'users.edit';
