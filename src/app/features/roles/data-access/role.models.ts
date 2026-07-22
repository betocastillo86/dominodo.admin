/** Scope of a role: platform-wide or tenant-bound. */
export type RoleScope = 'Platform' | 'Tenant';

/** Role as returned by `GET /roles` (camelCase, do not rename). */
export interface RoleDto {
  id: number;
  name: string;
  description?: string;
  isSystem: boolean;
  scope: RoleScope;
  permissionIds: number[];
}

/** Role detail as returned by `GET /roles/{id}`. */
export interface RoleDetailDto {
  id: number;
  name: string;
  description?: string;
  isSystem: boolean;
  scope: RoleScope;
  permissions: RolePermissionSummaryDto[];
}

export interface RolePermissionSummaryDto {
  id: number;
  code: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  scope: RoleScope;
  permissionIds: number[];
}

export interface UpdateRoleRequest {
  name: string;
  description?: string | null;
  permissionIds: number[];
}
