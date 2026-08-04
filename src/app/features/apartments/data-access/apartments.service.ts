import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import {
  ApartmentDetailDto,
  ApartmentDto,
  CreateApartmentRequest,
  ResidentDto,
  UpdateApartmentRequest,
} from './apartment.models';

/** Data-access for the Apartments feature. All API calls require X-Tenant header with the tenant slug. */
@Injectable({ providedIn: 'root' })
export class ApartmentsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/apartments`;

  /** Paged apartments for a tenant — used by the tenant form's embedded section. */
  query(
    tenantSlug: string,
    page: number,
    pageSize: number,
    tower?: string,
  ): Observable<PagedResult<ApartmentDto>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (tower) params = params.set('tower', tower);
    return this.http.get<PagedResult<ApartmentDto>>(this.base, {
      params,
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  /** Lists the residents of an apartment (array, not paged). */
  getResidents(apartmentId: string, tenantSlug: string): Observable<ResidentDto[]> {
    return this.http.get<ResidentDto[]>(`${this.base}/${apartmentId}/residents`, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  /** Returns all apartments for a tenant (up to 500) as a plain array — for catalog/lookup selects. */
  listForTenant(tenantSlug: string): Observable<ApartmentDto[]> {
    return this.query(tenantSlug, 1, 500).pipe(map((r) => r.items));
  }

  getById(id: string, tenantSlug: string): Observable<ApartmentDetailDto> {
    return this.http.get<ApartmentDetailDto>(`${this.base}/${id}`, {
      headers: { 'X-Tenant': tenantSlug },
    });
  }

  create(body: CreateApartmentRequest, tenantSlug: string): Observable<void> {
    return this.http.post<void>(this.base, body, { headers: { 'X-Tenant': tenantSlug } });
  }

  update(id: string, body: UpdateApartmentRequest, tenantSlug: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body, { headers: { 'X-Tenant': tenantSlug } });
  }
}
