import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  CreateTenantRequest,
  TenantDetailDto,
  TenantDto,
  TenantStatus,
  UpdateTenantRequest,
} from './tenant.models';

/** Data-access for the Tenants feature. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class TenantsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/tenants`;

  private readonly _tenants = signal<TenantDto[]>([]);
  private readonly _paging = signal<PagedResult<TenantDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly tenants = this._tenants.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Fetch a page of tenants and push the result into the state signals.
   *
   * NOTE: the `name`/`status` query params are not yet supported by the API
   * (`GET /tenants` currently only reads `page`/`pageSize`). They are wired
   * end-to-end so the list filters work as soon as the API adds support;
   * until then the server simply ignores them.
   */
  list(page: number, pageSize: number, name?: string, status?: TenantStatus): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (name) params = params.set('name', name);
    if (status) params = params.set('status', status);

    this.http.get<PagedResult<TenantDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._tenants.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  getById(id: string): Observable<TenantDetailDto> {
    return this.http.get<TenantDetailDto>(`${this.base}/${id}`);
  }

  create(body: CreateTenantRequest): Observable<void> {
    return this.http.post<void>(this.base, body);
  }

  update(id: string, body: UpdateTenantRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar los conjuntos.';
    }
    return 'No se pudieron cargar los conjuntos.';
  }
}
