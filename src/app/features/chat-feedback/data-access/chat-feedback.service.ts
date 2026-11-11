import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import {
  ChatFeedbackFilters,
  ChatFeedbackItemDto,
  ChatFeedbackScope,
  ChatFeedbackSummaryDto,
} from './chat-feedback.models';

/** Data-access for the residents' feedback on the questions Domi deflected (read-only). */
@Injectable({ providedIn: 'root' })
export class ChatFeedbackService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/chat-feedback`;

  private readonly _feedback = signal<ChatFeedbackItemDto[]>([]);
  private readonly _paging = signal<PagedResult<ChatFeedbackItemDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly feedback = this._feedback.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetches a page of feedback, newest first by default. `pageSize` is clamped to 100 upstream. */
  list(page: number, pageSize: number, filters: ChatFeedbackFilters = {}): void {
    this._loading.set(true);
    this._error.set(null);

    let params = this.scopeParams(filters).set('page', page).set('pageSize', pageSize);
    if (filters.wasHelpful != null) params = params.set('wasHelpful', filters.wasHelpful);
    if (filters.answered != null) params = params.set('answered', filters.answered);
    if (filters.direction) params = params.set('direction', filters.direction);

    this.http.get<PagedResult<ChatFeedbackItemDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._feedback.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error, 'No se pudo cargar el feedback.'));
        this._loading.set(false);
      },
    });
  }

  /** Totals for the tenant/date scope; the verdict filters of the list do not apply. */
  summary(scope: ChatFeedbackScope = {}): Observable<ChatFeedbackSummaryDto> {
    return this.http.get<ChatFeedbackSummaryDto>(`${this.base}/summary`, {
      params: this.scopeParams(scope),
    });
  }

  /** Tenant catalog for the conjunto filter; the endpoints match on `slug`. */
  tenantCatalog(): Observable<TenantDto[]> {
    const params = new HttpParams().set('page', 1).set('pageSize', 200);
    return this.http
      .get<PagedResult<TenantDto>>(`${environment.apiBaseUrl}/tenants`, {
        params,
      })
      .pipe(map((r) => r.items));
  }

  private scopeParams(scope: ChatFeedbackScope): HttpParams {
    let params = new HttpParams();
    if (scope.tenant) params = params.set('tenant', scope.tenant);
    if (scope.from) params = params.set('from', scope.from);
    if (scope.to) params = params.set('to', scope.to);
    return params;
  }

  /** Maps an HTTP error to a Spanish message, special-casing an unreachable Domi (502). */
  private toError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 502) {
        return 'Domi no está disponible en este momento. Inténtalo de nuevo.';
      }
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? fallback;
    }
    return fallback;
  }
}
