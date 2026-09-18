/** Kind of tenant (conjunto). Set on create and immutable on edit. */
export type TenantType = 'Conjunto' | 'Edificio' | 'Mixto';

/** Lifecycle status of a tenant. Changed via a dedicated endpoint, not the edit form. */
export type TenantStatus = 'Onboarding' | 'Active' | 'Suspended';

/** Tenant as returned by `GET /tenants` (camelCase, do not rename). */
export interface TenantDto {
  id: string;
  slug: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  city: string;
}

/** Public contact details of a tenant, shown to residents. All fields optional. */
export interface ContactInfoDto {
  phone?: string | null;
  address?: string | null;
  additionalInfo?: string | null;
  schedules?: string | null;
}

/** Tenant detail as returned by `GET /tenants/{id}`. */
export interface TenantDetailDto {
  id: string;
  slug: string;
  name: string;
  legalId?: string | null;
  type: TenantType;
  status: TenantStatus;
  address: string;
  city: string;
  country: string;
  branding?: string | null;
  settings?: string | null;
  contactInfo?: ContactInfoDto | null;
  confirmInvitationRequired: boolean;
}

export interface CreateTenantRequest {
  slug: string;
  name: string;
  type: TenantType;
  address: string;
  city: string;
  country: string;
  legalId?: string | null;
  branding?: string | null;
  settings?: string | null;
  contactInfo?: ContactInfoDto | null;
  confirmInvitationRequired: boolean;
}

/** `PUT /tenants/{id}` — note it excludes the immutable `slug`/`type` and the create-only `branding`/`settings`. */
export interface UpdateTenantRequest {
  name: string;
  legalId?: string | null;
  address: string;
  city: string;
  country: string;
  contactInfo?: ContactInfoDto | null;
  confirmInvitationRequired: boolean;
}

/** Feature flag record for a tenant, returned by `GET /tenants/{tenantId}/features`. */
export interface TenantFeatureDto {
  id: string;
  tenantId: string;
  featureKey: string;
  enabled: boolean;
}

/** `PUT /tenants/{tenantId}/features/{featureKey}` */
export interface SetTenantFeatureRequest {
  enabled: boolean;
}

/** `PUT /tenants/{id}/status` */
export interface ChangeTenantStatusRequest {
  status: TenantStatus;
}

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  Onboarding: 'Onboarding',
  Active: 'Activo',
  Suspended: 'Suspendido',
};

export const TENANT_STATUS_BADGES: Record<TenantStatus, string> = {
  Onboarding: 'badge bg-warning-lt',
  Active: 'badge bg-success-lt',
  Suspended: 'badge bg-danger-lt',
};
