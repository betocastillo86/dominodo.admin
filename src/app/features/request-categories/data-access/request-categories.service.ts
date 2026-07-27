import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  CreateRequestCategoryRequest,
  RequestCategoryDto,
  UpdateRequestCategoryRequest,
} from './request-category.models';

/** Data-access for the Request Categories feature. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class RequestCategoriesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/request-categories`;

  private readonly _categories = signal<RequestCategoryDto[]>([]);
  private readonly _paging = signal<PagedResult<RequestCategoryDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly categories = this._categories.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  list(page: number, pageSize: number, search?: string, isActive?: boolean): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (search) params = params.set('search', search);
    if (isActive !== undefined) params = params.set('isActive', isActive);

    this.http.get<PagedResult<RequestCategoryDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._categories.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  getById(id: string): Observable<RequestCategoryDto> {
    return this.http.get<RequestCategoryDto>(`${this.base}/${id}`);
  }

  create(body: CreateRequestCategoryRequest): Observable<void> {
    return this.http.post<void>(this.base, body);
  }

  update(id: string, body: UpdateRequestCategoryRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}`, body);
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar las categorías.';
    }
    return 'No se pudieron cargar las categorías.';
  }
}
