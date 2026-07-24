import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { PushMessagesService } from '../data-access/push-messages.service';
import {
  AdminDeliveryStatus,
  AdminPushMessageDto,
  DELIVERY_STATUS_BADGE,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUSES,
  PLATFORM_BADGE,
} from '../data-access/notification-message.models';

/** Read-only, server-paginated listing of materialized push messages. */
@Component({
  selector: 'app-push-message-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './push-message-list.component.html',
})
export class PushMessageListComponent {
  private readonly pushService = inject(PushMessagesService);

  readonly messages = this.pushService.messages;
  readonly paging = this.pushService.paging;
  readonly loading = this.pushService.loading;
  readonly error = this.pushService.error;

  readonly statuses = DELIVERY_STATUSES;
  readonly statusLabels = DELIVERY_STATUS_LABELS;

  private readonly pageSize = 20;

  readonly statusControl = new FormControl<AdminDeliveryStatus | ''>('', { nonNullable: true });

  readonly columns: readonly TableColumn<AdminPushMessageDto>[] = [
    { header: 'Título', value: (m) => m.title },
    { header: 'Mensaje', value: (m) => m.body },
    {
      header: 'Plataforma',
      value: (m) => m.platform,
      badgeClass: (m) => PLATFORM_BADGE[m.platform] ?? '',
    },
    {
      header: 'Estado',
      value: (m) => DELIVERY_STATUS_LABELS[m.status] ?? m.status,
      badgeClass: (m) => DELIVERY_STATUS_BADGE[m.status] ?? '',
    },
    { header: 'Intentos', value: (m) => m.attempts, class: 'text-end' },
    { header: 'Enviado', value: (m) => this.formatDate(m.sentAtUtc), class: 'text-secondary' },
  ];

  readonly rowKey = (message: AdminPushMessageDto): string => message.id;

  constructor() {
    this.statusControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const status = this.statusControl.value || undefined;
    this.pushService.list(page, this.pageSize, status);
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
