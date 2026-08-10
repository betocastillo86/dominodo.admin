/** User account status as returned by the API. */
export type UserStatus = 'PendingVerification' | 'Active' | 'Disabled';

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
