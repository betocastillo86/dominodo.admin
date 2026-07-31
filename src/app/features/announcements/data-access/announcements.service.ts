import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import {
  AnnouncementDetailDto,
  AnnouncementDto,
  AnnouncementStatus,
  CreateAnnouncementRequest,
  UpdateAnnouncementRequest,
} from './announcement.models';

/** Data-access for the Announcements feature. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/announcements`;

  private readonly _announcements = signal<AnnouncementDto[]>([]);
  private readonly _paging = signal<PagedResult<AnnouncementDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly announcements = this._announcements.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of announcements and push the result into the state signals. */
  list(
    page: number,
    pageSize: number,
    status?: AnnouncementStatus,
    categoryIds?: string[],
    tenantId?: string,
  ): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);
    for (const id of categoryIds ?? []) params = params.append('categoryIds', id);
    if (tenantId) params = params.set('tenantId', tenantId);

    this.http.get<PagedResult<AnnouncementDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._announcements.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  /** Load a flat tenant catalog for filter selects (large pageSize, no pagination needed). */
  listTenants(): Observable<TenantDto[]> {
    return this.http
      .get<PagedResult<TenantDto>>(`${environment.apiBaseUrl}/tenants`, {
        params: new HttpParams().set('page', 1).set('pageSize', 500),
      })
      .pipe(map((r) => r.items));
  }

  getById(id: string): Observable<AnnouncementDetailDto> {
    return this.http.get<AnnouncementDetailDto>(`${this.base}/${id}`);
  }

  create(body: CreateAnnouncementRequest): Observable<void> {
    return this.http.post<void>(this.base, body);
  }

  update(id: string, body: UpdateAnnouncementRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar los anuncios.';
    }
    return 'No se pudieron cargar los anuncios.';
  }
}
