import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { NotificationTemplatesService } from '../data-access/notification-templates.service';
import {
  AdminNotificationTemplateDto,
  AdminNotificationType,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
} from '../data-access/notification-template.models';

/** Read-only, server-paginated listing of notification templates. */
@Component({
  selector: 'app-notification-template-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-template-list.component.html',
})
export class NotificationTemplateListComponent {
  private readonly templatesService = inject(NotificationTemplatesService);

  readonly templates = this.templatesService.templates;
  readonly paging = this.templatesService.paging;
  readonly loading = this.templatesService.loading;
  readonly error = this.templatesService.error;

  readonly types = NOTIFICATION_TYPES;
  readonly typeLabels = NOTIFICATION_TYPE_LABELS;

  private readonly pageSize = 20;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly activeControl = new FormControl<'' | 'true' | 'false'>('', { nonNullable: true });
  readonly typeControl = new FormControl<AdminNotificationType | ''>('', { nonNullable: true });

  readonly columns: readonly TableColumn<AdminNotificationTemplateDto>[] = [
    { header: 'Nombre', value: (t) => t.name },
    {
      header: 'Tipo',
      value: (t) => NOTIFICATION_TYPE_LABELS[t.type] ?? t.type,
      badgeClass: () => 'badge bg-blue-lt',
    },
    { header: 'Canales', value: (t) => this.channelsLabel(t) },
    {
      header: 'Estado',
      value: (t) => (t.isActive ? 'Activa' : 'Inactiva'),
      badgeClass: (t) => (t.isActive ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
  ];

  readonly rowKey = (template: AdminNotificationTemplateDto): string => template.id;

  readonly editLink = (template: AdminNotificationTemplateDto): unknown[] => [
    '/notification-templates',
    template.id,
    'edit',
  ];

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.activeControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.typeControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private channelsLabel(template: AdminNotificationTemplateDto): string {
    const channels: string[] = [];
    if (template.emailEnabled) channels.push('Email');
    if (template.pushEnabled) channels.push('Push');
    if (template.inAppEnabled) channels.push('In-App');
    return channels.length ? channels.join(', ') : '—';
  }

  private reload(page: number): void {
    const search = this.searchControl.value || undefined;
    const activeValue = this.activeControl.value;
    const active = activeValue === '' ? undefined : activeValue === 'true';
    const type = this.typeControl.value || undefined;
    this.templatesService.list(page, this.pageSize, search, active, type);
  }
}
