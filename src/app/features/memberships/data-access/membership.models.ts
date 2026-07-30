export type ResidentRelationType = 'Owner' | 'Renter';

/** Membership as returned by `GET /memberships` (camelCase, do not rename). */
export interface MembershipDto {
  userId: string;
  tenantId: string;
  userName: string;
  phone: string;
  email: string | null;
  roleId: number;
  roleName: string;
  status: string;
  invitedAtUtc: string | null;
  joinedAtUtc: string | null;
}

export interface InviteMemberRequest {
  phone: string;
  roleId: number;
  email?: string | null;
  apartmentId?: string | null;
  relationType?: ResidentRelationType;
  livesHere?: boolean | null;
}

/** Minimal role shape for the role selector. */
export interface RoleSummaryDto {
  id: number;
  name: string;
  scope: string;
}

/** Invitation as returned by `GET /memberships/invitations` (camelCase, do not rename). */
export interface InvitationDto {
  id: string;
  phone: string;
  email: string;
  roleId: number;
  roleName: string;
  status: string;
  apartmentId: string | null;
  createdAtUtc: string;
  expiresAtUtc: string;
  isExpired: boolean;
  isRegistered: boolean;
}

/** Query filters accepted by `GET /memberships/invitations`. */
export interface InvitationFilters {
  search?: string;
  /** true = Accepted, false = Pending. */
  used?: boolean;
  /** true = the phone already has an account. */
  registered?: boolean;
  expired?: boolean;
  roleId?: number;
}

export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  Active: 'Activo',
  Invited: 'Invitado',
  Suspended: 'Suspendido',
};

export const MEMBERSHIP_STATUS_BADGES: Record<string, string> = {
  Active: 'badge bg-green-lt',
  Invited: 'badge bg-yellow-lt',
  Suspended: 'badge bg-red-lt',
};

export const RESIDENT_RELATION_LABELS: Record<ResidentRelationType, string> = {
  Owner: 'Propietario',
  Renter: 'Arrendatario',
};

export const INVITATION_STATUS_LABELS: Record<string, string> = {
  Pending: 'Pendiente',
  Accepted: 'Aceptada',
  Expired: 'Expirada',
  Revoked: 'Revocada',
};

export const INVITATION_STATUS_BADGES: Record<string, string> = {
  Pending: 'badge bg-yellow-lt',
  Accepted: 'badge bg-green-lt',
  Expired: 'badge bg-secondary-lt',
  Revoked: 'badge bg-red-lt',
};

/** Query filters accepted by `GET /memberships`. */
export interface MembershipFilters {
  search?: string;
  status?: string;
  roleId?: number;
}
