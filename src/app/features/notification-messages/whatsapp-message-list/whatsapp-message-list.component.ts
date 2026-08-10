import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { WhatsAppMessagesService } from '../data-access/whatsapp-messages.service';
import {
  AdminDeliveryStatus,
  AdminWhatsAppMessageDto,
  DELIVERY_STATUS_BADGE,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUSES,
} from '../data-access/notification-message.models';

/** Read-only, server-paginated listing of materialized WhatsApp messages. */
@Component({
  selector: 'app-whatsapp-message-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './whatsapp-message-list.component.html',
})
export class WhatsAppMessageListComponent {
  private readonly whatsAppService = inject(WhatsAppMessagesService);

  readonly messages = this.whatsAppService.messages;
  readonly paging = this.whatsAppService.paging;
  readonly loading = this.whatsAppService.loading;
  readonly error = this.whatsAppService.error;

  readonly statuses = DELIVERY_STATUSES;
  readonly statusLabels = DELIVERY_STATUS_LABELS;

  private readonly pageSize = 20;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly recipientControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<AdminDeliveryStatus | ''>('', { nonNullable: true });
  readonly fromControl = new FormControl('', { nonNullable: true });
  readonly toControl = new FormControl('', { nonNullable: true });

  readonly columns: readonly TableColumn<AdminWhatsAppMessageDto>[] = [
    { header: 'Destinatario', value: (m) => m.to },
    { header: 'Mensaje', value: (m) => m.body },
    {
      header: 'Estado',
      value: (m) => DELIVERY_STATUS_LABELS[m.status] ?? m.status,
      badgeClass: (m) => DELIVERY_STATUS_BADGE[m.status] ?? '',
    },
    { header: 'Intentos', value: (m) => m.attempts, class: 'text-end' },
    { header: 'Enviado', value: (m) => this.formatDate(m.sentAtUtc), class: 'text-secondary' },
    { header: 'Creado', value: (m) => this.formatDate(m.createdAtUtc), class: 'text-secondary' },
  ];

  readonly rowKey = (message: AdminWhatsAppMessageDto): string => message.id;

  readonly actionLink = (message: AdminWhatsAppMessageDto): string[] => [message.id];

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.recipientControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.statusControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.fromControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.toControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    this.whatsAppService.list(page, this.pageSize, {
      status: this.statusControl.value || undefined,
      search: this.searchControl.value.trim() || undefined,
      recipient: this.recipientControl.value.trim() || undefined,
      from: this.fromControl.value || undefined,
      to: this.toControl.value || undefined,
    });
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
