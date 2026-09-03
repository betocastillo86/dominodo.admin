import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  AdminWhatsAppMessageDto,
  WhatsAppMessageFilters,
  RequeueMessageResponse,
} from './notification-message.models';

/** Data-access for materialized WhatsApp messages. Exposes list state as signals. */
@Injectable({ providedIn: 'root' })
export class WhatsAppMessagesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/messages/whatsapp`;

  private readonly _messages = signal<AdminWhatsAppMessageDto[]>([]);
  private readonly _paging = signal<PagedResult<AdminWhatsAppMessageDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Fetch a page of WhatsApp messages and push the result into the state signals. */
  list(page: number, pageSize: number, filters: WhatsAppMessageFilters = {}): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.recipient) params = params.set('recipient', filters.recipient);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);

    this.http.get<PagedResult<AdminWhatsAppMessageDto>>(this.base, { params }).subscribe({
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

  /** Queue a copy of a WhatsApp message for a fresh delivery attempt. Returns the new message id. */
  requeue(id: string): Observable<RequeueMessageResponse> {
    return this.http.post<RequeueMessageResponse>(`${this.base}/${id}/requeue`, {});
  }

  private toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudieron cargar los mensajes de WhatsApp.';
    }
    return 'No se pudieron cargar los mensajes de WhatsApp.';
  }
}
