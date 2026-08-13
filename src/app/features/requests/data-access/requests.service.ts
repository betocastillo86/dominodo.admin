import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import {
  AddRequestParticipantRequest,
  AttachmentDownloadUrlDto,
  ChangeRequestStatusRequest,
  ConfirmAttachmentRequest,
  RequestAttachmentDto,
  RequestAttachmentUploadTicketDto,
  RequestCategoryDto,
  RequestDetailDto,
  RequestDto,
  RequestPriority,
  RequestSortBy,
  RequestStatus,
  RequestType,
  RequestVisibility,
  SortDirection,
  UpdateRequestRequest,
} from './request.models';

export interface RequestFilters {
  search?: string;
  statuses?: RequestStatus[];
  type?: RequestType;
  priority?: RequestPriority;
  visibility?: RequestVisibility;
  tenantId?: string;
  categoryIds?: string[];
  sortBy?: RequestSortBy;
  direction?: SortDirection;
}

/** Data-access for the Requests feature. List state is exposed as signals; writes return Observables. */
@Injectable({ providedIn: 'root' })
export class RequestsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/requests`;

  private readonly _requests = signal<RequestDto[]>([]);
  private readonly _paging = signal<PagedResult<RequestDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly requests = this._requests.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  list(page: number, pageSize: number, filters: RequestFilters = {}): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.search) params = params.set('search', filters.search);
    // `statuses` and `categoryIds` are array params — repeated query keys
    // (e.g. `statuses=New&statuses=InProgress`), the ASP.NET default binding.
    for (const status of filters.statuses ?? []) params = params.append('statuses', status);
    for (const categoryId of filters.categoryIds ?? []) params = params.append('categoryIds', categoryId);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.visibility) params = params.set('visibility', filters.visibility);
    if (filters.tenantId) params = params.set('tenantId', filters.tenantId);
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.direction) params = params.set('direction', filters.direction);

    this.http.get<PagedResult<RequestDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._requests.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  /** Fetches all tenants as a catalog for the list filter dropdown. */
  tenantCatalog(): Observable<TenantDto[]> {
    const params = new HttpParams().set('page', 1).set('pageSize', 200);
    return this.http
      .get<PagedResult<TenantDto>>(`${environment.apiBaseUrl}/tenants`, { params })
      .pipe(map((r) => r.items));
  }

  getById(id: string, tenantSlug: string): Observable<RequestDetailDto> {
    return this.http.get<RequestDetailDto>(`${this.base}/${id}`, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  /** Loads a tenant's request categories (tenant-scoped) for the category selector/filter. */
  categoryCatalog(tenantSlug: string): Observable<RequestCategoryDto[]> {
    const params = new HttpParams().set('page', 1).set('pageSize', 200);
    return this.http
      .get<PagedResult<RequestCategoryDto>>(`${environment.apiBaseUrl}/request-categories`, {
        params,
        headers: { 'X-Tenant': tenantSlug },
      })
      .pipe(map((r) => r.items));
  }

  update(id: string, body: UpdateRequestRequest, tenantSlug: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  changeStatus(id: string, body: ChangeRequestStatusRequest, tenantSlug: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/status`, body, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  addParticipant(
    id: string,
    body: AddRequestParticipantRequest,
    tenantSlug: string,
  ): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/participants`, body, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  listAttachments(id: string, tenantSlug: string): Observable<RequestAttachmentDto[]> {
    return this.http.get<RequestAttachmentDto[]>(`${this.base}/${id}/attachments`, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  getUploadUrl(
    id: string,
    fileName: string,
    contentType: string,
    tenantSlug: string,
  ): Observable<RequestAttachmentUploadTicketDto> {
    return this.http.post<RequestAttachmentUploadTicketDto>(
      `${this.base}/${id}/attachments/upload-url`,
      { fileName, contentType },
      { headers: { 'X-Tenant': tenantSlug } },
    );
  }

  confirmAttachment(
    id: string,
    body: ConfirmAttachmentRequest,
    tenantSlug: string,
  ): Observable<RequestAttachmentDto> {
    return this.http.post<RequestAttachmentDto>(`${this.base}/${id}/attachments`, body, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  getDownloadUrl(
    id: string,
    attachmentId: string,
    tenantSlug: string,
  ): Observable<AttachmentDownloadUrlDto> {
    return this.http.get<AttachmentDownloadUrlDto>(
      `${this.base}/${id}/attachments/${attachmentId}/download-url`,
      { headers: { 'X-Tenant': tenantSlug } },
    );
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar las solicitudes.';
    }
    return 'No se pudieron cargar las solicitudes.';
  }
}
