import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ProblemDetails } from '../../../core/http/problem-details';
import {
  AdminSimulateChatRequest,
  AdminSimulateChatResponse,
  ChatTranscriptResponse,
} from './chat-simulation.models';

/**
 * Data-access for the Domi chat simulator. Stateless: conversations are ephemeral
 * and owned by the component, so this service only wraps the API calls.
 */
@Injectable({ providedIn: 'root' })
export class ChatSimulationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/chat-simulation`;

  /** Forwards a simulated message to Domi and returns the agent's reply. */
  send(phone: string, text: string): Observable<AdminSimulateChatResponse> {
    const body: AdminSimulateChatRequest = { phone, text };
    return this.http.post<AdminSimulateChatResponse>(this.base, body);
  }

  /** Resets Domi's conversation session for a phone number. */
  reset(phone: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${encodeURIComponent(phone)}`);
  }

  /** Returns the transcript delta starting after `afterTurn`. Pass 0 to rehydrate the full thread. */
  getMessages(phone: string, afterTurn: number): Observable<ChatTranscriptResponse> {
    const params = new HttpParams().set('afterTurn', afterTurn);
    return this.http.get<ChatTranscriptResponse>(
      `${this.base}/${encodeURIComponent(phone)}/messages`,
      { params },
    );
  }

  /** Maps an HTTP error to a Spanish message, special-casing an unreachable Domi (502). */
  toError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 502) {
        return 'Domi no está disponible en este momento. Inténtalo de nuevo.';
      }
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudo enviar el mensaje.';
    }
    return 'No se pudo enviar el mensaje.';
  }
}
