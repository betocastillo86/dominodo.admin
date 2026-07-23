import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { TenantsService } from '../data-access/tenants.service';
import { TenantDto, TenantStatus } from '../data-access/tenant.models';

const STATUS_LABELS: Record<TenantStatus, string> = {
  Onboarding: 'Onboarding',
  Active: 'Activo',
  Suspended: 'Suspendido',
};

const STATUS_BADGES: Record<TenantStatus, string> = {
  Onboarding: 'badge bg-yellow-lt',
  Active: 'badge bg-green-lt',
  Suspended: 'badge bg-red-lt',
};

/** Read-only, server-paginated listing of tenants (conjuntos). */
@Component({
  selector: 'app-tenant-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-list.component.html',
})
export class TenantListComponent {
  private readonly tenantsService = inject(TenantsService);

  readonly tenants = this.tenantsService.tenants;
  readonly paging = this.tenantsService.paging;
  readonly loading = this.tenantsService.loading;
  readonly error = this.tenantsService.error;

  private readonly pageSize = 20;

  // NOTE: the API does not filter by these yet (see TenantsService.list). The
  // controls are wired now so the UX is ready when the backend adds support.
  readonly nameControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<TenantStatus | ''>('', { nonNullable: true });

  readonly columns: readonly TableColumn<TenantDto>[] = [
    { header: 'Slug', value: (t) => t.slug, class: 'text-secondary' },
    { header: 'Nombre', value: (t) => t.name },
    { header: 'Tipo', value: (t) => t.type, badgeClass: () => 'badge bg-blue-lt' },
    {
      header: 'Estado',
      value: (t) => STATUS_LABELS[t.status],
      badgeClass: (t) => STATUS_BADGES[t.status],
    },
    { header: 'Ciudad', value: (t) => t.city ?? '—' },
  ];

  readonly rowKey = (tenant: TenantDto): string => tenant.id;

  readonly editLink = (tenant: TenantDto): unknown[] => ['/tenants', tenant.id, 'edit'];

  constructor() {
    this.nameControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.statusControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const name = this.nameControl.value || undefined;
    const status = (this.statusControl.value as TenantStatus) || undefined;
    this.tenantsService.list(page, this.pageSize, name, status);
  }
}
