import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { AdminDeliveryStatus, AdminEmailMessageDto } from './notification-message.models';

/** Data-access for materialized email messages. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class EmailMessagesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/messages/email`;

  private readonly _messages = signal<AdminEmailMessageDto[]>([]);
  private readonly _paging = signal<PagedResult<AdminEmailMessageDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of email messages and push the result into the state signals. */
  list(page: number, pageSize: number, status?: AdminDeliveryStatus): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) params = params.set('status', status);

    this.http.get<PagedResult<AdminEmailMessageDto>>(this.base, { params }).subscribe({
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
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar los correos.';
    }
    return 'No se pudieron cargar los correos.';
  }
}
