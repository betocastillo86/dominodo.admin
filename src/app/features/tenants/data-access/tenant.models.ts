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
}

/** `PUT /tenants/{id}` — note it excludes the immutable `slug`/`type` and the create-only `branding`/`settings`. */
export interface UpdateTenantRequest {
  name: string;
  legalId?: string | null;
  address: string;
  city: string;
  country: string;
}
