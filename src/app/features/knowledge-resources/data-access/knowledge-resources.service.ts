import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import {
  CreateKnowledgeResourceRequest,
  KnowledgeResourceDetailDto,
  KnowledgeResourceDto,
  KnowledgeResourceStatus,
  UpdateKnowledgeResourceRequest,
} from './knowledge-resource.models';

/**
 * Data-access for the Knowledge Resources feature. Exposes list state as signals.
 *
 * The list is read **cross-tenant** (no `X-Tenant` header, filtered by the optional
 * `tenantId` query param) like Announcements. The per-resource reads/writes are
 * **tenant-scoped**: their bodies carry no `tenantId`, so the caller resolves the
 * tenant slug (via `TenantsService`) and passes it here as the `X-Tenant` header —
 * the same pattern the Requests detail page uses.
 */
@Injectable({ providedIn: 'root' })
export class KnowledgeResourcesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/knowledge-resources`;

  private readonly _resources = signal<KnowledgeResourceDto[]>([]);
  private readonly _paging = signal<PagedResult<KnowledgeResourceDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly resources = this._resources.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of knowledge resources (cross-tenant) and push into the state signals. */
  list(
    page: number,
    pageSize: number,
    status?: KnowledgeResourceStatus,
    search?: string,
    tenantId?: string,
  ): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    if (tenantId) params = params.set('tenantId', tenantId);

    this.http.get<PagedResult<KnowledgeResourceDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._resources.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  /** Load a flat tenant catalog for filter/select controls (large pageSize, no pagination needed). */
  listTenants(): Observable<TenantDto[]> {
    return this.http
      .get<PagedResult<TenantDto>>(`${environment.apiBaseUrl}/tenants`, {
        params: new HttpParams().set('page', 1).set('pageSize', 500),
      })
      .pipe(map((r) => r.items));
  }

  getById(id: string, tenantSlug: string): Observable<KnowledgeResourceDetailDto> {
    return this.http.get<KnowledgeResourceDetailDto>(`${this.base}/${id}`, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  create(body: CreateKnowledgeResourceRequest, tenantSlug: string): Observable<void> {
    return this.http.post<void>(this.base, body, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  update(id: string, body: UpdateKnowledgeResourceRequest, tenantSlug: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar los recursos.';
    }
    return 'No se pudieron cargar los recursos.';
  }
}
