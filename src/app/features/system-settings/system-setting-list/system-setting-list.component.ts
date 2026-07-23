import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { SystemSettingsService } from '../data-access/system-settings.service';
import { SystemSettingDto } from '../data-access/system-setting.models';

const VALUE_TYPE_LABELS: Record<string, string> = {
  String: 'Texto',
  Int: 'Entero',
  Bool: 'Booleano',
  Json: 'JSON',
};

/** Server-paginated listing of global system settings, filterable by key. */
@Component({
  selector: 'app-system-setting-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './system-setting-list.component.html',
})
export class SystemSettingListComponent {
  private readonly settingsService = inject(SystemSettingsService);

  readonly settings = this.settingsService.settings;
  readonly paging = this.settingsService.paging;
  readonly loading = this.settingsService.loading;
  readonly error = this.settingsService.error;

  private readonly pageSize = 20;

  readonly keyControl = new FormControl('', { nonNullable: true });

  readonly columns: readonly TableColumn<SystemSettingDto>[] = [
    { header: 'Key', value: (s) => s.key },
    {
      header: 'Tipo',
      value: (s) => VALUE_TYPE_LABELS[s.valueType] ?? s.valueType,
      badgeClass: () => 'badge bg-blue-lt',
    },
    { header: 'Valor', value: (s) => this.truncate(s.value) },
    {
      header: 'Ámbito',
      value: (s) => (s.tenantId ? 'Tenant' : 'Global'),
      badgeClass: (s) => (s.tenantId ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
    { header: 'Actualizado', value: (s) => this.formatDate(s.updatedAtUtc), class: 'text-secondary' },
  ];

  readonly rowKey = (setting: SystemSettingDto): string => setting.key;

  readonly editLink = (setting: SystemSettingDto): unknown[] => ['/system-settings', setting.key, 'edit'];

  constructor() {
    this.keyControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const key = this.keyControl.value.trim() || undefined;
    this.settingsService.list(page, this.pageSize, key);
  }

  private truncate(value: string): string {
    return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  }

  private formatDate(iso: string): string {
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
