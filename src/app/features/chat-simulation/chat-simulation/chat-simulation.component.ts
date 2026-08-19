import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, interval, Subscription, catchError, finalize, startWith, switchMap } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ChatSimulationService } from '../data-access/chat-simulation.service';
import {
  ChatBubble,
  ChatDirection,
  ChatMessageRole,
  ChatTranscriptResponse,
} from '../data-access/chat-simulation.models';

const POLL_INTERVAL_MS = 4000;

/**
 * Domi chat simulator. The operator enters a phone number, then exchanges
 * messages with Domi in a chat-style UI. Conversations are ephemeral: state
 * lives only in this component and can be reset via the API.
 *
 * The component polls GET …/messages?afterTurn= every POLL_INTERVAL_MS ms and
 * merges new turns into the bubble list deduplicating by turnNumber. The POST
 * reply is not painted directly — all turns arrive through the transcript.
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

  readonly phoneControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\+?[0-9]{6,15}$/)],
  });
  readonly phoneForm = new FormGroup({ phone: this.phoneControl });

  readonly messageControl = new FormControl('', { nonNullable: true });
  readonly messageForm = new FormGroup({ message: this.messageControl });

  private readonly scrollAnchor = viewChild<ElementRef<HTMLElement>>('scrollAnchor');
  private pollSub?: Subscription;

  /** Enters the conversation for the typed phone and starts live polling (rehydrates from afterTurn=0). */
  startConversation(): void {
    if (this.phoneControl.invalid) {
      this.phoneControl.markAsTouched();
      return;
    }
    this.cursor.set(0);
    this.conversationId.set(null);
    this.phone.set(this.phoneControl.value.trim());
    this.messages.set([]);
    this.error.set(null);
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

  /** Resets Domi's session for the current phone, clears the on-screen chat, and restarts polling. */
  resetConversation(): void {
    const phone = this.phone();
    if (!phone || this.sending() || this.resetting()) {
      return;
    }

    this.resetting.set(true);
    this.stopPolling();
    this.chatService
      .reset(phone)
      .pipe(finalize(() => this.resetting.set(false)))
      .subscribe({
        next: () => {
          this.messages.set([]);
          this.error.set(null);
          this.cursor.set(0);
          this.conversationId.set(null);
          this.pollError.set(null);
          this.notifications.success('Conversación reiniciada.');
          this.startPolling();
        },
        error: (err: unknown) => {
          // Best-effort: still clear locally so the operator can continue.
          this.messages.set([]);
          this.cursor.set(0);
          this.conversationId.set(null);
          this.pollError.set(null);
          this.notifications.error(this.chatService.toError(err));
          this.startPolling();
        },
      });
  }

  /** Returns to the phone gate, stopping polling and resetting Domi's session fire-and-forget. */
  changePhone(): void {
    const phone = this.phone();
    if (this.sending() || this.resetting()) {
      return;
    }
    this.stopPolling();
    if (phone) {
      this.chatService.reset(phone).subscribe({ error: () => undefined });
    }
    this.phone.set(null);
    this.messages.set([]);
    this.error.set(null);
    this.cursor.set(0);
    this.conversationId.set(null);
    this.pollError.set(null);
    this.phoneControl.reset('');
    this.messageControl.reset('');
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

  private startPolling(): void {
    this.stopPolling();
    const phone = this.phone();
    if (!phone) return;

    this.pollSub = interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.chatService.getMessages(phone, this.cursor()).pipe(
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
    this.chatService.getMessages(phone, this.cursor()).subscribe({
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
   * Cursor advances monotonically.
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
