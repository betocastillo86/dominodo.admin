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
