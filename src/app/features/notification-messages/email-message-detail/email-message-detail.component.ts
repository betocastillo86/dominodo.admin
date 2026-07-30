import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
}
