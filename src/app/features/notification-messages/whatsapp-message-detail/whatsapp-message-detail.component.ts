import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ProblemDetails } from '../../../core/http/problem-details';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { WhatsAppMessagesService } from '../data-access/whatsapp-messages.service';
import {
  AdminWhatsAppMessageDto,
  DELIVERY_STATUS_BADGE,
  DELIVERY_STATUS_LABELS,
} from '../data-access/notification-message.models';

/** Read-only detail of a single materialized WhatsApp message (all DTO fields). */
@Component({
  selector: 'app-whatsapp-message-detail',
  standalone: true,
  imports: [PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-message-detail.component.html',
})
export class WhatsAppMessageDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly whatsAppService = inject(WhatsAppMessagesService);

  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  /** The message located in the currently-loaded list state; undefined on direct/refresh nav. */
  readonly message = computed<AdminWhatsAppMessageDto | undefined>(() =>
    this.whatsAppService.messages().find((m) => m.id === this.id),
  );

  statusLabel(m: AdminWhatsAppMessageDto): string {
    return DELIVERY_STATUS_LABELS[m.status] ?? m.status;
  }

  statusBadge(m: AdminWhatsAppMessageDto): string {
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
    this.whatsAppService
      .requeue(this.id)
      .pipe(finalize(() => this.requeueing.set(false)))
      .subscribe({
        next: (result) => {
          this.requeuedId.set(result.id);
          this.notifications.success('Reintento del mensaje de WhatsApp encolado');
        },
        error: (err: unknown) =>
          this.requeueError.set(
            this.toMessage(err, 'No se pudo reintentar el mensaje de WhatsApp.'),
          ),
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
