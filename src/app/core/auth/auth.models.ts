/** Credentials submitted to `POST /auth/login`. */
export interface LoginRequest {
  phone: string;
  password: string;
}

/** Token envelope returned by `/auth/login` and `/auth/refresh`. */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601 expiry of the access token. */
  expiresAt: string;
}

/**
 * Claims read from the (tenant-agnostic) JWT. Only what the panel needs.
 * `role` may arrive as a single string or an array — normalize via `jwt.util`.
 */
export interface JwtClaims {
  sub: string;
  jti: string;
  role?: string | string[];
  /** Expiry as a UNIX timestamp (seconds), when present. */
  exp?: number;
  [claim: string]: unknown;
}

/** The authenticated principal, derived from the JWT claims. */
export interface AuthUser {
  id: string;
  roles: string[];
}

/** Profile of the authenticated principal, as `GET /auth/current` returns it. */
export interface CurrentUserProfileDto {
  id: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  status: string;
  phoneVerified: boolean;
  createdAtUtc: string; // date-time
  updatedAtUtc?: string | null; // date-time
}

/**
 * Answer of `GET /auth/current`. Permissions are the codes in effect for the caller;
 * with no `X-Tenant` — the panel never sends one — the API resolves Platform scope only,
 * and `memberships` comes back empty.
 */
export interface CurrentUserResponse {
  user: CurrentUserProfileDto;
  permissions: string[];
  memberships: readonly unknown[];
}
