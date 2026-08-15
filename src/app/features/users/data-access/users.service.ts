import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  ConfirmVerificationRequest,
  RegisterUserRequest,
  RequestVerificationRequest,
  UpdateUserRequest,
  UserDetailDto,
  UserListItemDto,
  UserStatus,
} from './user.models';

/** Data-access for the Users feature. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/users`;
  private readonly authBase = `${environment.apiBaseUrl}/auth`;

  private readonly _users = signal<UserListItemDto[]>([]);
  private readonly _paging = signal<PagedResult<UserListItemDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly users = this._users.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of users and push the result into the state signals. */
  list(page: number, pageSize: number, search?: string, status?: UserStatus, tenantId?: string): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (tenantId) params = params.set('tenantId', tenantId);

    this.http.get<PagedResult<UserListItemDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._users.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  getById(id: string): Observable<UserDetailDto> {
    return this.http.get<UserDetailDto>(`${this.base}/${id}`);
  }

  create(body: RegisterUserRequest): Observable<void> {
    return this.http.post<void>(this.base, body);
  }

  update(id: string, body: UpdateUserRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body);
  }

  requestVerification(body: RequestVerificationRequest): Observable<void> {
    return this.http.post<void>(`${this.authBase}/verify/request`, body);
  }

  confirmVerification(body: ConfirmVerificationRequest): Observable<void> {
    return this.http.post<void>(`${this.authBase}/verify/confirm`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar los usuarios.';
    }
    return 'No se pudieron cargar los usuarios.';
  }
}
