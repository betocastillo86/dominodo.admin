import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ProblemDetails } from '../../../core/http/problem-details';
import { NotificationService } from '../../../core/notifications/notification.service';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { InAppMessagesService } from '../data-access/in-app-messages.service';
import { AdminInAppMessageDto } from '../data-access/notification-message.models';

/** Read-only detail of a single materialized in-app notification (all DTO fields). */
@Component({
  selector: 'app-in-app-message-detail',
  standalone: true,
  imports: [PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './in-app-message-detail.component.html',
})
export class InAppMessageDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly inAppService = inject(InAppMessagesService);

  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  /** The message located in the currently-loaded list state; undefined on direct/refresh nav. */
  readonly message = computed<AdminInAppMessageDto | undefined>(() =>
    this.inAppService.messages().find((m) => m.id === this.id),
  );

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
    this.inAppService
      .requeue(this.id)
      .pipe(finalize(() => this.requeueing.set(false)))
      .subscribe({
        next: (result) => {
          this.requeuedId.set(result.id);
          this.notifications.success('Notificación reenviada al destinatario');
        },
        error: (err: unknown) =>
          this.requeueError.set(this.toMessage(err, 'No se pudo reenviar la notificación.')),
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
