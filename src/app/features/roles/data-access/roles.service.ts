import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { CreateRoleRequest, RoleDetailDto, RoleDto, RoleScope, UpdateRoleRequest } from './role.models';

/** Data-access for the Roles feature. Exposes state as signals. */
@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/roles`;

  private readonly _roles = signal<RoleDto[]>([]);
  private readonly _paging = signal<PagedResult<RoleDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly roles = this._roles.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of roles and push the result into the state signals. */
  list(page: number, pageSize: number, name?: string, scope?: RoleScope): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (name) params = params.set('name', name);
    if (scope) params = params.set('scope', scope);

    this.http.get<PagedResult<RoleDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._roles.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  getById(id: number): Observable<RoleDetailDto> {
    return this.http.get<RoleDetailDto>(`${this.base}/${id}`);
  }

  create(body: CreateRoleRequest): Observable<void> {
    return this.http.post<void>(this.base, body);
  }

  update(id: number, body: UpdateRoleRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar los roles.';
    }
    return 'No se pudieron cargar los roles.';
  }
}
