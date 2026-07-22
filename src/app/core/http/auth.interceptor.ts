import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';

/** Endpoints that must NOT carry the Authorization header. */
const SKIP_AUTH = ['/auth/login', '/auth/refresh'];

/** Attaches `Authorization: Bearer <accessToken>` to outgoing requests. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const token = store.accessToken();
  const shouldSkip = SKIP_AUTH.some((path) => req.url.includes(path));

  if (!token || shouldSkip) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
