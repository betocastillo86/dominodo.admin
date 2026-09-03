import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ProblemDetails } from '../../../core/http/problem-details';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { EmailMessagesService } from '../data-access/email-messages.service';
import {
  AdminEmailMessageDto,
  DELIVERY_STATUS_BADGE,
  DELIVERY_STATUS_LABELS,
} from '../data-access/notification-message.models';

/** Read-only detail of a single materialized email message (all DTO fields). */
@Component({
  selector: 'app-email-message-detail',
  standalone: true,
  imports: [PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './email-message-detail.component.html',
})
export class EmailMessageDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly emailService = inject(EmailMessagesService);

  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  /** The message located in the currently-loaded list state; undefined on direct/refresh nav. */
  readonly message = computed<AdminEmailMessageDto | undefined>(() =>
    this.emailService.messages().find((m) => m.id === this.id),
  );

  statusLabel(m: AdminEmailMessageDto): string {
    return DELIVERY_STATUS_LABELS[m.status] ?? m.status;
  }

  statusBadge(m: AdminEmailMessageDto): string {
    return DELIVERY_STATUS_BADGE[m.status] ?? 'badge';
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }

  /** Two-step confirm: the button arms the prompt, the prompt fires the requeue. */
  readonly confirmingRequeue = signal(false);
  readonly requeueing = signal(false);
  readonly requeueError = signal<string | null>(null);
  /** Id of the copy queued by the last successful requeue. */
  readonly requeuedId = signal<string | null>(null);

  requestRequeue(): void {
    this.requeueError.set(null);
    this.confirmingRequeue.set(true);
  }

  cancelRequeue(): void {
    this.confirmingRequeue.set(false);
  }

  submitRequeue(): void {
    this.confirmingRequeue.set(false);
    this.requeueing.set(true);
    this.requeueError.set(null);
    this.emailService
      .requeue(this.id)
      .pipe(finalize(() => this.requeueing.set(false)))
      .subscribe({
        next: (result) => {
          this.requeuedId.set(result.id);
          this.notifications.success('Reintento del correo encolado');
        },
        error: (err: unknown) =>
          this.requeueError.set(this.toMessage(err, 'No se pudo reintentar el correo.')),
      });
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const problem = err.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? fallback;
    }
    return fallback;
  }
}
