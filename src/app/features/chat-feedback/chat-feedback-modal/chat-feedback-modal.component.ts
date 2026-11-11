import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TablerIconComponent } from 'angular-tabler-icons';
import { ChatFeedbackItemDto } from '../data-access/chat-feedback.models';

/**
 * One feedback row in full: the question and the resident's comment, which the list leaves
 * out. Read-only — it closes, or leaves for the conversation the question was asked in.
 */
@Component({
  selector: 'app-chat-feedback-modal',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-feedback-modal.component.html',
})
export class ChatFeedbackModalComponent {
  readonly activeModal = inject(NgbActiveModal);
  private readonly router = inject(Router);

  readonly feedback = signal<ChatFeedbackItemDto | null>(null);
  /** Display name of the row's conjunto; the opener resolves it from its tenant catalog. */
  readonly tenantName = signal('');

  /**
   * The row to show. Setters rather than `input()`s because the opener assigns them
   * imperatively through the modal's `componentInstance`.
   */
  set item(value: ChatFeedbackItemDto) {
    this.feedback.set(value);
  }

  set tenant(value: string) {
    this.tenantName.set(value);
  }

  openConversation(conversationId: string): void {
    this.activeModal.close();
    void this.router.navigate(['/conversations', conversationId]);
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
