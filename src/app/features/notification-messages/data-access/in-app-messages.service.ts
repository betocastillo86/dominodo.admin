import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { AdminInAppMessageDto, InAppMessageFilters } from './notification-message.models';

/** Data-access for materialized in-app notifications. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class InAppMessagesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/messages/inapp`;

  private readonly _messages = signal<AdminInAppMessageDto[]>([]);
  private readonly _paging = signal<PagedResult<AdminInAppMessageDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of in-app notifications and push the result into the state signals. */
  list(page: number, pageSize: number, filters: InAppMessageFilters = {}): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.recipientUserId) params = params.set('recipientUserId', filters.recipientUserId);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);

    this.http.get<PagedResult<AdminInAppMessageDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._messages.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error));
        this._loading.set(false);
      },
    });
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar las notificaciones.';
    }
    return 'No se pudieron cargar las notificaciones.';
  }
}
