import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

/** Allows activation only when the session's role includes `SuperAdmin`. */
export const superAdminGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);

  return store.isSuperAdmin() ? true : router.createUrlTree(['/auth']);
};
