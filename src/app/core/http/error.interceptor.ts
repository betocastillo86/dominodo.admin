import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { AuthStore } from '../auth/auth.store';
import { NotificationService } from '../notifications/notification.service';
import { ProblemDetails } from './problem-details';

/** Auth endpoints are excluded from the 401 refresh-and-retry logic. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * On 401 (for non-auth requests) attempts a SINGLE refresh and retries the
 * original request; if that fails, clears the session and redirects to `/auth`.
 * All other errors are mapped from RFC 9457 ProblemDetails to a user message.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const store = inject(AuthStore);
  const router = inject(Router);
  const notifications = inject(NotificationService);

  const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => req.url.includes(path));

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const canRefresh = error.status === 401 && !isAuthEndpoint && !!store.refreshToken();

      if (canRefresh) {
        return auth.refresh().pipe(
          switchMap((tokens) =>
            next(req.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } })),
          ),
          catchError(() => {
            store.clear();
            notifications.error('Tu sesión expiró. Inicia sesión nuevamente.');
            void router.navigate(['/auth']);
            return throwError(() => error);
          }),
        );
      }

      notifications.error(toMessage(error));
      return throwError(() => error);
    }),
  );
};

/** Extract a human-facing message from a ProblemDetails payload. */
function toMessage(error: HttpErrorResponse): string {
  const problem = error.error as ProblemDetails | undefined;
  if (problem?.errors?.length) {
    return problem.errors.map((e) => e.message).join(' ');
  }
  return problem?.detail ?? problem?.title ?? 'Ocurrió un error inesperado.';
}
