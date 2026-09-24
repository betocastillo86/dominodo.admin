import { ApartmentDto, ResidentDto } from '../../apartments/data-access/apartment.models';
import { MembershipDto } from '../../memberships/data-access/membership.models';
import { RequestDto } from '../../requests/data-access/request.models';

/** User account status as returned by the API. */
export type UserStatus = 'PendingVerification' | 'Active' | 'Disabled';

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  PendingVerification: 'Pendiente',
  Active: 'Activo',
  Disabled: 'Deshabilitado',
};

export const USER_STATUS_BADGES: Record<UserStatus, string> = {
  PendingVerification: 'badge bg-yellow-lt',
  Active: 'badge bg-green-lt',
  Disabled: 'badge bg-red-lt',
};

/** User as returned by GET /users (list item, camelCase — do not rename). */
export interface UserListItemDto {
  id: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  documentType?: string;
  documentNumber?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAtUtc: string; // date-time
  updatedAtUtc?: string | null; // date-time
}

/** User detail as returned by GET /users/{id}. */
export interface UserDetailDto {
  id: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  phoneVerified: boolean;
}

export interface RegisterUserRequest {
  phone: string;
  email?: string | null;
  firstName: string;
  lastName: string;
  password: string;
}

export interface UpdateUserRequest {
  firstName: string;
  lastName: string;
  /** Editable from the admin panel; null clears the address. */
  email?: string | null;
  preferredLanguage: string;
}

export interface RequestVerificationRequest {
  phone: string;
}

export interface ConfirmVerificationRequest {
  phone: string;
  code: string;
}

/**
 * A membership of the user, enriched with the conjunto it belongs to. Composed on the
 * client: `GET /memberships?userId=` only carries `tenantId`, so the name and slug come
 * from the tenants catalog.
 */
export interface UserMembershipRow extends MembershipDto {
  tenantName: string;
  tenantSlug: string;
}

/**
 * A residency of the user in one apartment. Composed on the client: residencies hang off
 * an apartment (`GET /apartments/{apartmentId}/residents`), so the apartment and its
 * conjunto are merged in to keep the row readable outside a tenant context.
 */
export interface UserResidencyRow extends ResidentDto {
  apartment: ApartmentDto;
  tenantName: string;
  tenantSlug: string;
}

/**
 * A request the user takes part in, enriched with its conjunto and how the person is involved.
 * Composed on the client: the API splits involvement across two filters (`participantUserId`
 * covers reporter and follower, `assignedToUserId` the assignee), so the rows are merged here.
 */
export interface UserRequestRow extends RequestDto {
  tenantName: string;
  /** Spanish label(s) for the user's role in the request, e.g. `Reportante · Asignado`. */
  involvement: string;
}
