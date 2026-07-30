import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  InvitationDto,
  InvitationFilters,
  InviteMemberRequest,
  MembershipDto,
  MembershipFilters,
  RoleSummaryDto,
} from './membership.models';

/** Data-access for the Memberships feature. All list calls require X-Tenant header. */
@Injectable({ providedIn: 'root' })
export class MembershipsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/memberships`;
  private readonly rolesBase = `${environment.apiBaseUrl}/roles`;

  private readonly _members = signal<MembershipDto[]>([]);
  private readonly _paging = signal<PagedResult<MembershipDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly members = this._members.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  private readonly _invitations = signal<InvitationDto[]>([]);
  private readonly _invitationsPaging = signal<PagedResult<InvitationDto> | null>(null);
  private readonly _invitationsLoading = signal(false);
  private readonly _invitationsError = signal<string | null>(null);

  readonly invitations = this._invitations.asReadonly();
  readonly invitationsPaging = this._invitationsPaging.asReadonly();
  readonly invitationsLoading = this._invitationsLoading.asReadonly();
  readonly invitationsError = this._invitationsError.asReadonly();

  list(tenantSlug: string, page: number, pageSize: number, filters: MembershipFilters = {}): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.roleId !== undefined) params = params.set('roleId', filters.roleId);

    this.http
      .get<PagedResult<MembershipDto>>(this.base, {
        params,
        headers: { 'X-Tenant': tenantSlug },
      })
      .subscribe({
        next: (result) => {
          this._members.set(result.items);
          this._paging.set(result);
          this._loading.set(false);
        },
        error: (error: unknown) => {
          this._error.set(this.toError(error));
          this._loading.set(false);
        },
      });
  }

  listInvitations(
    tenantSlug: string,
    page: number,
    pageSize: number,
    filters: InvitationFilters = {},
  ): void {
    this._invitationsLoading.set(true);
    this._invitationsError.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.used !== undefined) params = params.set('used', filters.used);
    if (filters.registered !== undefined) params = params.set('registered', filters.registered);
    if (filters.expired !== undefined) params = params.set('expired', filters.expired);
    if (filters.roleId !== undefined) params = params.set('roleId', filters.roleId);

    this.http
      .get<PagedResult<InvitationDto>>(`${this.base}/invitations`, {
        params,
        headers: { 'X-Tenant': tenantSlug },
      })
      .subscribe({
        next: (result) => {
          this._invitations.set(result.items);
          this._invitationsPaging.set(result);
          this._invitationsLoading.set(false);
        },
        error: (error: unknown) => {
          this._invitationsError.set(
            this.toError(error, 'No se pudieron cargar las invitaciones.'),
          );
          this._invitationsLoading.set(false);
        },
      });
  }

  /**
   * Free-text search of memberships scoped to a tenant, for autocomplete/typeahead.
   * Returns just the items (no signal side-effects) so callers can pipe it per keystroke.
   */
  search(tenantSlug: string, search: string, take = 10): Observable<MembershipDto[]> {
    const params = new HttpParams()
      .set('page', 1)
      .set('pageSize', take)
      .set('search', search);
    return this.http
      .get<PagedResult<MembershipDto>>(this.base, {
        params,
        headers: { 'X-Tenant': tenantSlug },
      })
      .pipe(map((r) => r.items));
  }

  invite(body: InviteMemberRequest, tenantSlug: string): Observable<void> {
    return this.http.post<void>(`${this.base}/invite`, body, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  suspend(userId: string, tenantSlug: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${userId}/suspend`, null, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  reactivate(userId: string, tenantSlug: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${userId}/reactivate`, null, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  remove(userId: string, tenantSlug: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${userId}`, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  /** Loads all roles for the role selector in the invite form. */
  listRoles(): Observable<RoleSummaryDto[]> {
    const params = new HttpParams().set('pageSize', 200);
    return this.http
      .get<PagedResult<RoleSummaryDto>>(this.rolesBase, { params })
      .pipe(map((r) => r.items));
  }

  private toError(error: unknown, fallback = 'No se pudieron cargar las membresías.'): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? fallback;
    }
    return fallback;
  }
}
