import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ChatSimulationService } from '../data-access/chat-simulation.service';
import { ChatBubble } from '../data-access/chat-simulation.models';

/**
 * Domi chat simulator. The operator enters a phone number, then exchanges
 * messages with Domi in a chat-style UI. Conversations are ephemeral: state
 * lives only in this component and can be reset via the API.
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

  /** Active phone number; null shows the phone gate. */
  readonly phone = signal<string | null>(null);
  readonly messages = signal<ChatBubble[]>([]);
  readonly sending = signal(false);
  readonly resetting = signal(false);
  readonly error = signal<string | null>(null);

  readonly phoneControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\+?[0-9]{6,15}$/)],
  });
  readonly phoneForm = new FormGroup({ phone: this.phoneControl });

  readonly messageControl = new FormControl('', { nonNullable: true });
  readonly messageForm = new FormGroup({ message: this.messageControl });

  private readonly scrollAnchor = viewChild<ElementRef<HTMLElement>>('scrollAnchor');

  /** Enters the conversation for the typed phone and reveals the chat surface. */
  startConversation(): void {
    if (this.phoneControl.invalid) {
      this.phoneControl.markAsTouched();
      return;
    }
    this.phone.set(this.phoneControl.value.trim());
    this.messages.set([]);
    this.error.set(null);
  }

  /** Sends the typed message to Domi and appends the reply. */
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
        next: (response) => {
          this.markStatus(outgoing.id, 'sent');
          this.messages.update((list) => [
            ...list,
            {
              id: crypto.randomUUID(),
              direction: 'incoming',
              text: response.reply,
              sentAt: new Date(),
              status: 'sent',
            },
          ]);
          this.scrollToBottom();
        },
        error: (err: unknown) => {
          this.markStatus(outgoing.id, 'error');
          this.error.set(this.chatService.toError(err));
          this.scrollToBottom();
        },
      });
  }

  /** Resets Domi's session for the current phone and clears the on-screen chat. */
  resetConversation(): void {
    const phone = this.phone();
    if (!phone || this.sending() || this.resetting()) {
      return;
    }

    this.resetting.set(true);
    this.chatService
      .reset(phone)
      .pipe(finalize(() => this.resetting.set(false)))
      .subscribe({
        next: () => {
          this.messages.set([]);
          this.error.set(null);
          this.notifications.success('Conversación reiniciada.');
        },
        error: (err: unknown) => {
          // Best-effort: still clear locally so the operator can continue.
          this.messages.set([]);
          this.notifications.error(this.chatService.toError(err));
        },
      });
  }

  /** Returns to the phone gate, resetting Domi's session for the previous number. */
  changePhone(): void {
    const phone = this.phone();
    if (this.sending() || this.resetting()) {
      return;
    }
    if (phone) {
      // Fire-and-forget so Domi's session doesn't leak between numbers.
      this.chatService.reset(phone).subscribe({ error: () => undefined });
    }
    this.phone.set(null);
    this.messages.set([]);
    this.error.set(null);
    this.phoneControl.reset('');
    this.messageControl.reset('');
  }

  private markStatus(id: string, status: ChatBubble['status']): void {
    this.messages.update((list) =>
      list.map((m) => (m.id === id ? { ...m, status } : m)),
    );
  }

  private scrollToBottom(): void {
    afterNextRender(() => this.scrollAnchor()?.nativeElement.scrollIntoView({ block: 'end' }), {
      injector: this.injector,
    });
  }
}
