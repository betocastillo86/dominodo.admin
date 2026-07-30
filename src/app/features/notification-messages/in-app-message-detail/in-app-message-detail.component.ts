import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
}
