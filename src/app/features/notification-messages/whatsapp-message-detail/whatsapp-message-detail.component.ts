import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
}
