import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { InAppMessagesService } from '../data-access/in-app-messages.service';
import { AdminInAppMessageDto } from '../data-access/notification-message.models';

/** Read-only, server-paginated listing of materialized in-app notifications. */
@Component({
  selector: 'app-in-app-message-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './in-app-message-list.component.html',
})
export class InAppMessageListComponent {
  private readonly inAppService = inject(InAppMessagesService);

  readonly messages = this.inAppService.messages;
  readonly paging = this.inAppService.paging;
  readonly loading = this.inAppService.loading;
  readonly error = this.inAppService.error;

  private readonly pageSize = 20;

  readonly columns: readonly TableColumn<AdminInAppMessageDto>[] = [
    { header: 'Tipo', value: (m) => m.type, badgeClass: () => 'badge bg-blue-lt' },
    { header: 'Título', value: (m) => m.title },
    { header: 'Mensaje', value: (m) => m.body },
    {
      header: 'Leído',
      value: (m) => (m.isRead ? 'Leído' : 'No leído'),
      badgeClass: (m) => (m.isRead ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
    { header: 'Creado', value: (m) => this.formatDate(m.createdAtUtc), class: 'text-secondary' },
  ];

  readonly rowKey = (message: AdminInAppMessageDto): string => message.id;

  constructor() {
    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    this.inAppService.list(page, this.pageSize);
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
