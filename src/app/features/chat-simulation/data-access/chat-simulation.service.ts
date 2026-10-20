import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ProblemDetails } from '../../../core/http/problem-details';
import { silentErrors } from '../../../core/http/silent-errors';
import {
  AdminChatMediaRef,
  AdminChatMediaResponse,
  AdminSimulateChatRequest,
  AdminSimulateChatResponse,
  CHAT_INVALID_PHONE,
  CHAT_MEDIA_REJECTED,
  CHAT_NO_CONVERSATION,
  ChatResetFailure,
  ChatTranscriptResponse,
} from './chat-simulation.models';

/**
 * An upload the API refused, carrying a message that already names the file. `uploadAll` fails
 * with this because a turn may hold five attachments: "Domi rechazó el archivo" on its own would
 * not tell the operator which one to replace.
 */
export class ChatMediaUploadError extends Error {
  constructor(
    readonly fileName: string,
    reason: string,
  ) {
    super(`No se pudo subir «${fileName}». ${reason}`);
    this.name = 'ChatMediaUploadError';
  }
}

/**
 * Data-access for the Domi chat simulator. Stateless: the cursor and the rendered
 * thread are owned by the component, so this service only wraps the API calls.
 *
 * Every call opts out of the global error toast: the component renders these failures
 * in place (inline alert, poll banner) and the reset's 404 is a benign outcome, not an
 * error to shout about.
 */
@Injectable({ providedIn: 'root' })
export class ChatSimulationService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/chat-simulation`;

  /**
   * Forwards a simulated message to Domi and returns the agent's reply. A turn carrying only
   * media answers with an EMPTY reply (Domi ADR-0012 §16): the acknowledgement arrives later,
   * through the transcript poll, so the caller must not render this as a bubble.
   */
  send(
    phone: string,
    text: string | null,
    media?: AdminChatMediaRef[],
  ): Observable<AdminSimulateChatResponse> {
    const body: AdminSimulateChatRequest = {
      phone,
      text,
      ...(media?.length ? { media } : {}),
    };
    return this.http.post<AdminSimulateChatResponse>(this.base, body, {
      context: silentErrors(),
    });
  }

  /**
   * Uploads every file of a turn and returns the pointers in the order they were picked. The
   * endpoint takes ONE file per call, so a turn with five attachments is five calls, issued
   * together; the first refusal fails the batch and cancels the rest. Pointers already minted
   * are left to expire — they are only ever spent by the turn being composed.
   */
  uploadAll(files: File[]): Observable<AdminChatMediaRef[]> {
    if (!files.length) {
      return of([]);
    }
    return forkJoin(
      files.map((file) =>
        this.uploadMedia(file).pipe(
          map(({ url, contentType }): AdminChatMediaRef => ({
            url,
            contentType,
          })),
          catchError((err: unknown) =>
            throwError(() => new ChatMediaUploadError(file.name, this.toUploadError(err))),
          ),
        ),
      ),
    );
  }

  /**
   * Uploads one file and returns the pointer the next turn carries. Domi decides type and size,
   * so a file it refuses fails here rather than inside the resident's turn.
   */
  private uploadMedia(file: File): Observable<AdminChatMediaResponse> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<AdminChatMediaResponse>(`${this.base}/media`, form, {
      context: silentErrors(),
    });
  }

  /**
   * Resets Domi's conversation for a phone number: 204 when there was something to
   * clear, 404 `Chat.NoConversation` when the number never wrote, 400 on a malformed
   * phone, 502 when Domi is down. The transcript is NOT deleted — the reset stamps a
   * cut on it and the pull starts after that cut.
   */
  reset(phone: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${encodeURIComponent(phone)}`, {
      context: silentErrors(),
    });
  }

  /**
   * Returns the transcript delta starting after `afterTurn`. Pass 0 to rehydrate the
   * thread. By default the view starts after the last reset; `includeBeforeReset`
   * ignores that cut and returns the whole audit trail.
   */
  getMessages(
    phone: string,
    afterTurn: number,
    includeBeforeReset = false,
  ): Observable<ChatTranscriptResponse> {
    const params = new HttpParams()
      .set('afterTurn', afterTurn)
      .set('includeBeforeReset', includeBeforeReset);
    return this.http.get<ChatTranscriptResponse>(
      `${this.base}/${encodeURIComponent(phone)}/messages`,
      { params, context: silentErrors() },
    );
  }

  /**
   * Why the upload failed. `Chat.MediaRejected` carries Domi's own reason — type or size; the
   * 413 is the API's own ceiling and arrives with no body, so the copy is ours.
   */
  private toUploadError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 413) {
        return 'El archivo es demasiado grande.';
      }
      const problem = error.error as ProblemDetails | undefined;
      if (error.status === 400 && problem?.title === CHAT_MEDIA_REJECTED) {
        return problem.detail ?? 'Domi rechazó el archivo.';
      }
    }
    return this.toError(error);
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

  /**
   * Classifies a failed reset. The API relays the error code in the ProblemDetails
   * `title`; the upstream `detail` is in English, so the known codes get our own copy.
   */
  toResetFailure(error: unknown): ChatResetFailure {
    if (!(error instanceof HttpErrorResponse)) {
      return { kind: 'unknown', message: 'No se pudo reiniciar la conversación.' };
    }

    const code = (error.error as ProblemDetails | undefined)?.title;

    if (error.status === 404 && code === CHAT_NO_CONVERSATION) {
      return {
        kind: 'no-conversation',
        message: 'Este número no tenía una conversación que reiniciar.',
      };
    }
    if (error.status === 400 && code === CHAT_INVALID_PHONE) {
      return {
        kind: 'invalid-phone',
        message: 'Domi rechazó el número. Debe ser un teléfono en formato internacional.',
      };
    }
    if (error.status === 502) {
      return {
        kind: 'upstream',
        message: 'Domi no está disponible en este momento. Inténtalo de nuevo.',
      };
    }

    const problem = error.error as ProblemDetails | undefined;
    return {
      kind: 'unknown',
      message: problem?.detail ?? problem?.title ?? 'No se pudo reiniciar la conversación.',
    };
  }
}
