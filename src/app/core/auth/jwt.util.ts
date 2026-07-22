import { jwtDecode } from 'jwt-decode';
import { JwtClaims } from './auth.models';

/** The platform-scoped role that grants access to this panel. */
export const SUPER_ADMIN_ROLE = 'SuperAdmin';

// .NET identity uses the full URI form for the role claim.
const MS_ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

/** Decode a JWT into its claims, or `null` if it is malformed. */
export function decodeToken(token: string): JwtClaims | null {
  try {
    return jwtDecode<JwtClaims>(token);
  } catch {
    return null;
  }
}

/** Normalize the `role` claim (string | string[]) into a plain array. */
export function normalizeRoles(role: string | string[] | undefined): string[] {
  if (!role) {
    return [];
  }
  return Array.isArray(role) ? role : [role];
}

/**
 * Extract the role value from either the short-form `role` claim or the
 * full Microsoft URI claim that .NET Identity emits by default.
 */
export function extractRoles(claims: JwtClaims): string | string[] | undefined {
  return (claims[MS_ROLE_CLAIM] as string | string[] | undefined) ?? claims.role;
}

/** True when the claims include the `SuperAdmin` role. */
export function isSuperAdmin(claims: JwtClaims | null): boolean {
  if (!claims) {
    return false;
  }
  return normalizeRoles(extractRoles(claims)).includes(SUPER_ADMIN_ROLE);
}

/** True when the token carries an `exp` that is at or before now. */
export function isExpired(claims: JwtClaims | null): boolean {
  if (!claims?.exp) {
    return false;
  }
  return claims.exp * 1000 <= Date.now();
}
