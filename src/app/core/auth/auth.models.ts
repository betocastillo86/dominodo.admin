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
