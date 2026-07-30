import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { PushMessagesService } from '../data-access/push-messages.service';
import {
  AdminPushMessageDto,
  DELIVERY_STATUS_BADGE,
  DELIVERY_STATUS_LABELS,
  PLATFORM_BADGE,
} from '../data-access/notification-message.models';

/** Read-only detail of a single materialized push message (all DTO fields). */
@Component({
  selector: 'app-push-message-detail',
  standalone: true,
  imports: [PageHeaderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './push-message-detail.component.html',
})
export class PushMessageDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly pushService = inject(PushMessagesService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  /** The message located in the currently-loaded list state; undefined on direct/refresh nav. */
  readonly message = computed<AdminPushMessageDto | undefined>(() =>
    this.pushService.messages().find((m) => m.id === this.id),
  );

  statusLabel(m: AdminPushMessageDto): string {
    return DELIVERY_STATUS_LABELS[m.status] ?? m.status;
  }

  statusBadge(m: AdminPushMessageDto): string {
    return DELIVERY_STATUS_BADGE[m.status] ?? 'badge';
  }

  platformBadge(m: AdminPushMessageDto): string {
    return PLATFORM_BADGE[m.platform] ?? 'badge';
  }

  formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
