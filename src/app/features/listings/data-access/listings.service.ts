import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  CreateListingRequest,
  EditListingRequest,
  ListingDto,
  ListingKind,
  ListingStatus,
} from './listing.models';

/** Data-access for the Listings feature. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class ListingsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/listings`;

  private readonly _listings = signal<ListingDto[]>([]);
  private readonly _paging = signal<PagedResult<ListingDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  /**
   * Holds the listing chosen for editing. Set by the list before navigating to edit,
   * because the API has no GET /listings/{id} endpoint.
   */
  private readonly _selected = signal<ListingDto | null>(null);

  readonly listings = this._listings.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selected = this._selected.asReadonly();

  list(page: number, pageSize: number, kind?: ListingKind, status?: ListingStatus): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (kind) params = params.set('kind', kind);
    if (status) params = params.set('status', status);

    this.http.get<PagedResult<ListingDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._listings.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  /** Sets the listing to be edited. Call before navigating to the edit route. */
  select(listing: ListingDto): void {
    this._selected.set(listing);
  }

  create(body: CreateListingRequest): Observable<ListingDto> {
    return this.http.post<ListingDto>(this.base, body);
  }

  update(id: string, body: EditListingRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar las publicaciones.';
    }
    return 'No se pudieron cargar las publicaciones.';
  }
}
