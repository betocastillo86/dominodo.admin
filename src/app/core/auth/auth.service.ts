import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthTokens, CurrentUserResponse, LoginRequest } from './auth.models';
import { AuthStore } from './auth.store';
import { decodeToken, isSuperAdmin } from './jwt.util';
import { silentErrors } from '../http/silent-errors';

/** Handles the authentication lifecycle against `/auth/*`. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly base = `${environment.apiBaseUrl}/auth`;

  /**
   * Authenticate by phone + password. Rejects (clearing storage) if the token's
   * role does not include `SuperAdmin`, so a non-admin never enters the panel.
   * The permissions follow in a second call, which must not be able to fail the login.
   */
  login(credentials: LoginRequest): Observable<void> {
    return this.http.post<AuthTokens>(`${this.base}/login`, credentials).pipe(
      map((tokens) => {
        const claims = decodeToken(tokens.accessToken);
        if (!isSuperAdmin(claims)) {
          this.store.clear();
          throw new Error('Acceso no autorizado');
        }
        this.store.setSession(tokens);
      }),
      switchMap(() => this.loadCurrentUser().pipe(catchError(() => of(void 0)))),
    );
  }

  /**
   * Loads the session's effective permissions into the store. The panel sends no `X-Tenant`,
   * so the API answers with Platform-scope grants only — which is what the platform-gated
   * writes are checked against. Errors are left to the caller; the toast is suppressed because
   * a missing permission list only hides UI, it is not an incident to alert the operator about.
   */
  loadCurrentUser(): Observable<void> {
    return this.http
      .get<CurrentUserResponse>(`${this.base}/current`, { context: silentErrors() })
      .pipe(
        tap((current) => this.store.setPermissions(current.permissions)),
        map(() => void 0),
      );
  }

  /** Exchange the refresh token for a fresh token set (rotates the refresh token). */
  refresh(): Observable<AuthTokens> {
    const token = this.store.refreshToken();
    if (!token) {
      return throwError(() => new Error('No hay refresh token disponible'));
    }
    return this.http
      .post<AuthTokens>(`${this.base}/refresh`, { token })
      .pipe(tap((tokens) => this.store.setSession(tokens)));
  }

  /** Best-effort server logout, then clear the session and go to `/auth`. */
  logout(): Observable<void> {
    const token = this.store.refreshToken();
    return this.http.post<void>(`${this.base}/logout`, { token }).pipe(
      catchError(() => of(void 0)),
      tap(() => {
        this.store.clear();
        void this.router.navigate(['/auth']);
      }),
      map(() => void 0),
    );
  }
}
