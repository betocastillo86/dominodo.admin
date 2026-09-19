import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PagedResult } from '../../../core/models/paged-result';
import { ProblemDetails } from '../../../core/http/problem-details';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import {
  ConversationDetailDto,
  ConversationEpisodeDto,
  ConversationFilters,
  ConversationMessageDto,
  ConversationSummaryDto,
  ConversationTurnFilters,
  DecisionRecordDto,
} from './conversation.models';

/**
 * Data-access for Domi's persisted conversations. The three listings (conversations,
 * one conversation's transcript and its decision trail) each own their own state
 * signals because the detail page renders the last two side by side in tabs.
 */
@Injectable({ providedIn: 'root' })
export class ConversationsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/chat-simulation/conversations`;

  private readonly _conversations = signal<ConversationSummaryDto[]>([]);
  private readonly _paging = signal<PagedResult<ConversationSummaryDto> | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly conversations = this._conversations.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  private readonly _messages = signal<ConversationMessageDto[]>([]);
  private readonly _messagesPaging = signal<PagedResult<ConversationMessageDto> | null>(null);
  private readonly _messagesLoading = signal(false);
  private readonly _messagesError = signal<string | null>(null);

  readonly messages = this._messages.asReadonly();
  readonly messagesPaging = this._messagesPaging.asReadonly();
  readonly messagesLoading = this._messagesLoading.asReadonly();
  readonly messagesError = this._messagesError.asReadonly();

  private readonly _decisions = signal<DecisionRecordDto[]>([]);
  private readonly _decisionsPaging = signal<PagedResult<DecisionRecordDto> | null>(null);
  private readonly _decisionsLoading = signal(false);
  private readonly _decisionsError = signal<string | null>(null);

  readonly decisions = this._decisions.asReadonly();
  readonly decisionsPaging = this._decisionsPaging.asReadonly();
  readonly decisionsLoading = this._decisionsLoading.asReadonly();
  readonly decisionsError = this._decisionsError.asReadonly();

  /** Fetches a page of conversations (newest first). `pageSize` is clamped to 100 upstream. */
  list(page: number, pageSize: number, filters: ConversationFilters = {}): void {
    this._loading.set(true);
    this._error.set(null);

    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (filters.senderId) params = params.set('senderId', filters.senderId);
    if (filters.tenant) params = params.set('tenant', filters.tenant);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);

    this.http.get<PagedResult<ConversationSummaryDto>>(this.base, { params }).subscribe({
      next: (result) => {
        this._conversations.set(result.items);
        this._paging.set(result);
        this._loading.set(false);
      },
      error: (error: unknown) => {
        this._error.set(this.toError(error, 'No se pudieron cargar las conversaciones.'));
        this._loading.set(false);
      },
    });
  }

  getById(conversationId: string): Observable<ConversationDetailDto> {
    return this.http.get<ConversationDetailDto>(`${this.base}/${conversationId}`);
  }

  /**
   * Fetches a page of the transcript, oldest first. By default it starts after the last
   * reset cut; `includeBeforeReset` returns the whole audit trail instead.
   */
  listMessages(
    conversationId: string,
    page: number,
    pageSize: number,
    filters: ConversationTurnFilters = {},
  ): void {
    this._messagesLoading.set(true);
    this._messagesError.set(null);

    const params = this.pageParams(page, pageSize, filters);
    this.http
      .get<PagedResult<ConversationMessageDto>>(`${this.base}/${conversationId}/messages`, {
        params,
      })
      .subscribe({
        next: (result) => {
          this._messages.set(result.items);
          this._messagesPaging.set(result);
          this._messagesLoading.set(false);
        },
        error: (error: unknown) => {
          this._messagesError.set(this.toError(error, 'No se pudieron cargar los mensajes.'));
          this._messagesLoading.set(false);
        },
      });
  }

  /** Same page/reset/episode semantics as the transcript, over the agent's decision trail. */
  listDecisions(
    conversationId: string,
    page: number,
    pageSize: number,
    filters: ConversationTurnFilters = {},
  ): void {
    this._decisionsLoading.set(true);
    this._decisionsError.set(null);

    const params = this.pageParams(page, pageSize, filters);
    this.http
      .get<PagedResult<DecisionRecordDto>>(`${this.base}/${conversationId}/decisions`, { params })
      .subscribe({
        next: (result) => {
          this._decisions.set(result.items);
          this._decisionsPaging.set(result);
          this._decisionsLoading.set(false);
        },
        error: (error: unknown) => {
          this._decisionsError.set(this.toError(error, 'No se pudieron cargar las decisiones.'));
          this._decisionsLoading.set(false);
        },
      });
  }

  /**
   * Episode index of one conversation, used as the catalog of the episode filter.
   * Read-only and small (one row per reset), so a single large page is enough.
   */
  episodeCatalog(conversationId: string): Observable<ConversationEpisodeDto[]> {
    const params = new HttpParams().set('page', 1).set('pageSize', 100);
    return this.http
      .get<PagedResult<ConversationEpisodeDto>>(`${this.base}/${conversationId}/episodes`, {
        params,
      })
      .pipe(map((r) => r.items));
  }

  /** Tenant catalog for the conjunto filter; the list endpoint matches on `slug`. */
  tenantCatalog(): Observable<TenantDto[]> {
    const params = new HttpParams().set('page', 1).set('pageSize', 200);
    return this.http
      .get<PagedResult<TenantDto>>(`${environment.apiBaseUrl}/tenants`, { params })
      .pipe(map((r) => r.items));
  }

  private pageParams(page: number, pageSize: number, filters: ConversationTurnFilters): HttpParams {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize)
      .set('includeBeforeReset', filters.includeBeforeReset ?? false);
    if (filters.episode != null) params = params.set('episode', filters.episode);
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
