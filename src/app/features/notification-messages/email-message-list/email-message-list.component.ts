import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { EmailMessagesService } from '../data-access/email-messages.service';
import {
  AdminDeliveryStatus,
  AdminEmailMessageDto,
  DELIVERY_STATUS_BADGE,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUSES,
} from '../data-access/notification-message.models';

/** Read-only, server-paginated listing of materialized email messages. */
@Component({
  selector: 'app-email-message-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './email-message-list.component.html',
})
export class EmailMessageListComponent {
  private readonly emailService = inject(EmailMessagesService);

  readonly messages = this.emailService.messages;
  readonly paging = this.emailService.paging;
  readonly loading = this.emailService.loading;
  readonly error = this.emailService.error;

  readonly statuses = DELIVERY_STATUSES;
  readonly statusLabels = DELIVERY_STATUS_LABELS;

  private readonly pageSize = 20;

  readonly statusControl = new FormControl<AdminDeliveryStatus | ''>('', { nonNullable: true });

  readonly columns: readonly TableColumn<AdminEmailMessageDto>[] = [
    { header: 'Destinatario', value: (m) => (m.toName ? `${m.toName} <${m.to}>` : m.to) },
    { header: 'Asunto', value: (m) => m.subject },
    {
      header: 'Estado',
      value: (m) => DELIVERY_STATUS_LABELS[m.status] ?? m.status,
      badgeClass: (m) => DELIVERY_STATUS_BADGE[m.status] ?? '',
    },
    { header: 'Intentos', value: (m) => m.attempts, class: 'text-end' },
    { header: 'Programado', value: (m) => this.formatDate(m.scheduledAtUtc), class: 'text-secondary' },
    { header: 'Enviado', value: (m) => this.formatDate(m.sentAtUtc), class: 'text-secondary' },
  ];

  readonly rowKey = (message: AdminEmailMessageDto): string => message.id;

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
    this.emailService.list(page, this.pageSize, status);
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
