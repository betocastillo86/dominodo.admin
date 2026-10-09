import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { EMPTY, interval, Subscription, catchError, finalize, startWith, switchMap } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ChatSimulationService } from '../data-access/chat-simulation.service';
import {
  ChatBubble,
  ChatDirection,
  ChatMessageRole,
  ChatThreadItem,
  ChatTranscriptResponse,
} from '../data-access/chat-simulation.models';

const POLL_INTERVAL_MS = 4000;

/** Separators the operator may paste inside a number; Domi strips them too. */
const PHONE_SEPARATORS = /[\s().-]/g;

/** Domi's canonical sender id (ADR-0012): bare E.164, no leading zero. */
const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Canonical form of whatever the operator typed. Any spelling of a number resolves to
 * the same conversation on Domi's side, so the panel sends the canonical one and the
 * transcript, the reset and the session all key off the same string.
 */
function canonicalPhone(value: string): string {
  const cleaned = value.trim().replace(PHONE_SEPARATORS, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

function e164Validator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string | null)?.trim();
  if (!value) {
    return null;
  }
  return E164.test(canonicalPhone(value)) ? null : { e164: true };
}

/**
 * Domi chat simulator. The operator enters a phone number, then exchanges messages
 * with Domi in a chat-style UI.
 *
 * The component polls GET …/messages?afterTurn= every POLL_INTERVAL_MS ms and merges
 * new turns into the bubble list deduplicating by turnNumber. The POST reply is not
 * painted directly — all turns arrive through the transcript.
 *
 * Reset semantics (Domi ADR-0004 §13–§14): DELETE clears the agent's conversational
 * state but NEVER deletes the transcript — it stamps a cut on it, reported back as
 * `resetAfterTurn`, and the pull hides everything up to that cut by default. So the
 * screen empties after a reset while the audit trail survives, readable on demand via
 * `includeBeforeReset`. A 404 on the reset means the number simply never wrote: a
 * benign outcome, not a failure.
 *
 * The cut is NOT only ours any more (Domi ADR-0004 §18–§19): Domi closes a conversation
 * by itself when a request is created, and stamps the cut on the very turn that carries
 * the goodbye. The default pull starts after the cut, so that last turn would never
 * arrive — `pullAcrossCut()` is what goes and gets it. See `archiveFloor`.
 */
@Component({
  selector: 'app-chat-simulation',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, PageHeaderComponent, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-simulation.component.html',
  styleUrl: './chat-simulation.component.scss',
})
export class ChatSimulationComponent {
  private readonly chatService = inject(ChatSimulationService);
  private readonly notifications = inject(NotificationService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  /** Active phone number; null shows the phone gate. */
  readonly phone = signal<string | null>(null);
  readonly messages = signal<ChatBubble[]>([]);
  readonly sending = signal(false);
  readonly resetting = signal(false);
  readonly error = signal<string | null>(null);
  readonly cursor = signal(0);
  readonly conversationId = signal<string | null>(null);
  readonly polling = signal(false);
  readonly pollError = signal<string | null>(null);

  /** Highest turn belonging to a conversation already reset; 0 = never reset. */
  readonly resetAfterTurn = signal(0);
  /** When on, the pull ignores the cut and returns the whole audit trail. */
  readonly includeBeforeReset = signal(false);

  /** True when this number carries archived turns the default view is hiding. */
  readonly hasArchivedHistory = computed(() => this.resetAfterTurn() > 0);

  /**
   * The rendered thread: bubbles plus the cut marker, inserted before the first turn that
   * survives the cut — or at the end when nothing does, which is what a conversation Domi
   * just closed looks like. The marker only shows up once turns from behind the cut are on
   * screen, so the default view never renders a dangling separator.
   */
  readonly thread = computed<ChatThreadItem[]>(() => {
    const cut = this.resetAfterTurn();
    const bubbles = this.messages();
    const isBehindCut = (b: ChatBubble) => b.turnNumber != null && b.turnNumber <= cut;
    const item = (message: ChatBubble, archived: boolean) =>
      ({ kind: 'message', id: message.id, message, archived }) as const;

    if (cut <= 0 || !bubbles.some(isBehindCut)) {
      return bubbles.map((message) => item(message, false));
    }

    // Dim the archive only when something on screen survives the cut. Since Domi closes a
    // conversation on its own, the common shape is a thread that lies entirely behind the
    // cut — the conversation the operator just finished. Greying all of it says nothing.
    const divides = bubbles.some((b) => !isBehindCut(b));

    const items: ChatThreadItem[] = [];
    let divided = false;
    for (const message of bubbles) {
      if (!divided && !isBehindCut(message)) {
        items.push({ kind: 'reset', id: `reset-${cut}`, turnNumber: cut });
        divided = true;
      }
      items.push(item(message, divides && isBehindCut(message)));
    }
    // Nothing since the cut: it closes the thread.
    if (!divided) {
      items.push({ kind: 'reset', id: `reset-${cut}`, turnNumber: cut });
    }
    return items;
  });

  readonly phoneControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, e164Validator],
  });
  readonly phoneForm = new FormGroup({ phone: this.phoneControl });

  readonly messageControl = new FormControl('', { nonNullable: true });
  readonly messageForm = new FormGroup({ message: this.messageControl });

  private readonly scrollAnchor = viewChild<ElementRef<HTMLElement>>('scrollAnchor');
  private pollSub?: Subscription;

  /**
   * The cut this screen settled on when it first pulled, and the floor every read across a
   * later cut starts from. `null` until that first pull answers: whatever was already behind
   * the cut on arrival is archive the operator did not ask for, so it must never be dragged
   * back in — only turns cut away *while we were watching* are ours to recover.
   */
  private archiveFloor: number | null = null;

  /** A read across the cut is in flight; it is never chained onto itself. */
  private crossingCut = false;

  /** Enters the conversation for the typed phone and starts live polling (rehydrates from afterTurn=0). */
  startConversation(): void {
    if (this.phoneControl.invalid) {
      this.phoneControl.markAsTouched();
      return;
    }
    this.phone.set(canonicalPhone(this.phoneControl.value));
    this.includeBeforeReset.set(false);
    this.resetAfterTurn.set(0);
    this.archiveFloor = null;
    this.conversationId.set(null);
    this.messages.set([]);
    this.cursor.set(0);
    this.error.set(null);
    this.pollError.set(null);
    this.startPolling();
  }

  /** Sends the typed message to Domi; the reply arrives through the transcript via pullOnce(). */
  sendMessage(): void {
    const phone = this.phone();
    const text = this.messageControl.value.trim();
    if (!phone || !text || this.sending()) {
      return;
    }

    const outgoing: ChatBubble = {
      id: crypto.randomUUID(),
      direction: 'outgoing',
      text,
      sentAt: new Date(),
      status: 'sending',
    };
    this.messages.update((list) => [...list, outgoing]);
    this.messageControl.setValue('');
    this.error.set(null);
    this.sending.set(true);
    this.scrollToBottom();

    this.chatService
      .send(phone, text)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: () => {
          this.markStatus(outgoing.id, 'sent');
          this.pullOnce();
        },
        error: (err: unknown) => {
          this.markStatus(outgoing.id, 'error');
          this.error.set(this.chatService.toError(err));
          this.scrollToBottom();
        },
      });
  }

  /**
   * Resets Domi's conversation for the current phone. On success the screen empties:
   * the transcript survives behind the cut, so nothing is lost — it moves out of the
   * default view. A 404 means there was nothing to reset, which lands the operator in
   * the same place, so it is reported as information rather than an error. Any other
   * failure leaves the thread untouched: nothing was reset, and saying otherwise lies.
   */
  resetConversation(): void {
    const phone = this.phone();
    if (!phone || this.sending() || this.resetting()) {
      return;
    }

    const wasPolling = this.polling();
    this.resetting.set(true);
    this.stopPolling();
    this.chatService
      .reset(phone)
      .pipe(finalize(() => this.resetting.set(false)))
      .subscribe({
        next: () => {
          this.afterReset();
          this.notifications.success(
            'Conversación reiniciada. El historial anterior queda archivado.',
          );
        },
        error: (err: unknown) => {
          const failure = this.chatService.toResetFailure(err);
          if (failure.kind === 'no-conversation') {
            this.afterReset();
            this.notifications.info(failure.message);
            return;
          }
          // Nothing changed upstream, so the thread stays and the live view goes back
          // to whatever the operator had it on.
          this.notifications.error(failure.message);
          if (wasPolling) {
            this.startPolling();
          }
        },
      });
  }

  /** Returns to the phone gate. The conversation on Domi is left as it is. */
  changePhone(): void {
    if (this.sending() || this.resetting()) {
      return;
    }
    this.stopPolling();
    this.phone.set(null);
    this.messages.set([]);
    this.error.set(null);
    this.cursor.set(0);
    this.conversationId.set(null);
    this.pollError.set(null);
    this.resetAfterTurn.set(0);
    this.includeBeforeReset.set(false);
    this.archiveFloor = null;
    this.phoneControl.reset('');
    this.messageControl.reset('');
  }

  /** Switches between the post-reset view and the full audit trail, then rehydrates. */
  toggleHistory(): void {
    if (this.sending() || this.resetting()) {
      return;
    }
    this.includeBeforeReset.update((value) => !value);
    this.rehydrate();
  }

  /** Pauses or resumes the live polling. */
  togglePolling(): void {
    if (this.polling()) {
      this.stopPolling();
    } else {
      this.startPolling();
    }
  }

  /** Id of the message whose text was just copied; drives the transient "copied" feedback. */
  readonly copiedId = signal<string | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  /** Copies a bubble's text to the clipboard and briefly flags it as copied. */
  copyMessage(message: ChatBubble): void {
    navigator.clipboard
      .writeText(message.text)
      .then(() => {
        this.copiedId.set(message.id);
        if (this.copiedTimer) {
          clearTimeout(this.copiedTimer);
        }
        this.copiedTimer = setTimeout(() => this.copiedId.set(null), 1500);
      })
      .catch(() => this.notifications.error('No se pudo copiar el mensaje.'));
  }

  /** Clears the local thread after a reset landed; the cut is re-read from the next pull. */
  private afterReset(): void {
    this.messages.set([]);
    this.error.set(null);
    this.cursor.set(0);
    this.pollError.set(null);
    this.archiveFloor = null;
    // The new default view starts after the fresh cut; the archive stays one click away.
    this.includeBeforeReset.set(false);
    this.startPolling();
  }

  /** Drops the on-screen thread and pulls it again from turn 0 under the current view. */
  private rehydrate(): void {
    this.messages.set([]);
    this.cursor.set(0);
    this.pollError.set(null);
    this.archiveFloor = null;
    if (this.polling()) {
      this.startPolling();
    } else {
      this.pullOnce();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    const phone = this.phone();
    if (!phone) return;

    this.pollSub = interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.chatService.getMessages(phone, this.cursor(), this.includeBeforeReset()).pipe(
            catchError((err: unknown) => {
              this.pollError.set(this.chatService.toError(err));
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((resp) => this.mergeTranscript(resp));
    this.polling.set(true);
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.polling.set(false);
  }

  private pullOnce(): void {
    const phone = this.phone();
    if (!phone) return;
    this.chatService.getMessages(phone, this.cursor(), this.includeBeforeReset()).subscribe({
      next: (resp) => this.mergeTranscript(resp),
      error: (err: unknown) => this.pollError.set(this.chatService.toError(err)),
    });
  }

  /**
   * Merges a transcript response into the bubble list, deduplicating by the
   * `turnNumber:role` pair. Domi persists the User turn and its Assistant reply
   * under the SAME turnNumber, so deduping by turnNumber alone would drop the
   * reply — the pair keys them apart. User turns replace the oldest optimistic
   * outgoing bubble (no turnNumber); other roles are appended as incoming.
   * Cursor advances monotonically; `resetAfterTurn` is authoritative on every page.
   */
  private mergeTranscript(resp: ChatTranscriptResponse): void {
    const keyOf = (turnNumber: number, role: ChatMessageRole) => `${turnNumber}:${role}`;
    const seen = new Set(
      this.messages()
        .filter((m) => m.turnNumber != null && m.role != null)
        .map((m) => keyOf(m.turnNumber!, m.role!)),
    );

    // Order by turnNumber, then by role so User renders above its Assistant reply.
    const sorted = [...resp.messages].sort(
      (a, b) => a.turnNumber - b.turnNumber || this.roleRank(a.role) - this.roleRank(b.role),
    );
    let currentList = this.messages();
    let added = 0;

    for (const msg of sorted) {
      const key = keyOf(msg.turnNumber, msg.role);
      if (seen.has(key)) continue;
      seen.add(key);

      const bubble: ChatBubble = {
        id: crypto.randomUUID(),
        direction: this.mapRole(msg.role),
        text: msg.text,
        sentAt: new Date(msg.createdAtUtc),
        status: 'sent',
        turnNumber: msg.turnNumber,
        role: msg.role,
      };

      if (msg.role === 'User') {
        const idx = currentList.findIndex(
          (m) => m.direction === 'outgoing' && m.turnNumber == null,
        );
        if (idx >= 0) {
          currentList = [...currentList.slice(0, idx), ...currentList.slice(idx + 1)];
        }
      }

      currentList = [...currentList, bubble];
      added++;
    }

    if (added > 0) {
      this.messages.set(currentList);
      this.scrollToBottom();
    }

    this.cursor.set(Math.max(this.cursor(), resp.cursor));
    this.conversationId.set(resp.conversationId);

    // The cut moved past our cursor: turns were closed away between two pulls and the default
    // view will never hand them over. Go read them, from no earlier than the cut this screen
    // had already settled on. The new cut is deliberately NOT published yet — that pull
    // publishes it, which keeps the separator from landing above a bubble it is about to
    // replace, and leaves the next poll free to try again if this read fails.
    if (!this.crossingCut && this.archiveFloor !== null && resp.resetAfterTurn > this.cursor()) {
      this.pullAcrossCut(Math.max(this.cursor(), this.archiveFloor));
      return;
    }

    this.resetAfterTurn.set(resp.resetAfterTurn);
    this.archiveFloor ??= resp.resetAfterTurn;
  }

  /**
   * Pulls the turns a close swallowed: the same read, ignoring the cut, starting at
   * `afterTurn`. Domi stamps the cut on the turn it is answering (ADR-0004 §19), so a
   * conversation it closes by itself buries its own goodbye behind it. Bounded by the
   * caller to what came after the previous cut, so recovering one closing turn never drags
   * the whole archive onto the screen.
   *
   * The flag is held across the merge, not just the request: a cut the pull cannot reach
   * past (an upstream `resetAfterTurn` beyond the last turn) would otherwise re-arm the
   * condition and spin. Held, the retry falls back to the 4 s poll, which is a safe rhythm.
   */
  private pullAcrossCut(afterTurn: number): void {
    const phone = this.phone();
    if (!phone) return;
    this.crossingCut = true;
    this.chatService
      .getMessages(phone, afterTurn, true)
      .pipe(finalize(() => (this.crossingCut = false)))
      .subscribe({
        next: (resp) => this.mergeTranscript(resp),
        error: (err: unknown) => this.pollError.set(this.chatService.toError(err)),
      });
  }

  private mapRole(role: ChatMessageRole): ChatDirection {
    return role === 'User' ? 'outgoing' : 'incoming';
  }

  /** Render order within a single turnNumber (matches the API's convention). */
  private roleRank(role: ChatMessageRole): number {
    switch (role) {
      case 'User':
        return 0;
      case 'Assistant':
        return 1;
      case 'System':
        return 2;
      default:
        return 3;
    }
  }

  private markStatus(id: string, status: ChatBubble['status']): void {
    this.messages.update((list) => list.map((m) => (m.id === id ? { ...m, status } : m)));
  }

  private scrollToBottom(): void {
    afterNextRender(
      () => this.scrollAnchor()?.nativeElement.scrollIntoView({ block: 'end' }),
      { injector: this.injector },
    );
  }
}
