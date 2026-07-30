import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../../shared/ui/multi-select/multi-select.component';
import { RequestsService, RequestFilters } from '../data-access/requests.service';
import {
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  RequestCategoryDto,
  RequestDto,
  RequestPriority,
  RequestStatus,
  RequestType,
  RequestVisibility,
} from '../data-access/request.models';
import { TenantDto } from '../../tenants/data-access/tenant.models';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, MultiSelectComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-list.component.html',
})
export class RequestListComponent {
  private readonly requestsService = inject(RequestsService);

  readonly requests = this.requestsService.requests;
  readonly paging = this.requestsService.paging;
  readonly loading = this.requestsService.loading;
  readonly error = this.requestsService.error;

  private readonly pageSize = 20;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<RequestStatus[]>([], { nonNullable: true });
  readonly typeControl = new FormControl<RequestType | ''>('', { nonNullable: true });
  readonly priorityControl = new FormControl<RequestPriority | ''>('', { nonNullable: true });
  readonly visibilityControl = new FormControl<RequestVisibility | ''>('', { nonNullable: true });
  readonly tenantControl = new FormControl<string>('', { nonNullable: true });
  /** Disabled until a tenant is selected — categories are tenant-scoped. */
  readonly categoryControl = new FormControl<string[]>({ value: [], disabled: true }, { nonNullable: true });

  readonly tenants = signal<TenantDto[]>([]);
  /** Categories of the currently selected tenant; empty when no tenant is chosen. */
  readonly categories = signal<RequestCategoryDto[]>([]);
  readonly categoriesLoading = signal(false);

  private readonly tenantMap = computed(() => {
    const m = new Map<string, string>();
    for (const t of this.tenants()) m.set(t.id, t.name);
    return m;
  });

  readonly statusOptions: MultiSelectOption[] = [
    { value: 'New', label: 'Nuevo' },
    { value: 'InReview', label: 'En revisión' },
    { value: 'InProgress', label: 'En progreso' },
    { value: 'Resolved', label: 'Resuelto' },
    { value: 'Closed', label: 'Cerrado' },
    { value: 'Rejected', label: 'Rechazado' },
    { value: 'Cancelled', label: 'Cancelado' },
    { value: 'Reopened', label: 'Reabierto' },
  ];

  /** Category options for the multi-select, derived from the selected tenant's catalog. */
  readonly categoryOptions = computed<MultiSelectOption[]>(() =>
    this.categories().map((c) => ({ value: c.id, label: c.name })),
  );

  readonly typeOptions: { value: RequestType; label: string }[] = [
    { value: 'Peticion', label: 'Petición' },
    { value: 'Queja', label: 'Queja' },
    { value: 'Reclamo', label: 'Reclamo' },
    { value: 'Sugerencia', label: 'Sugerencia' },
    { value: 'Maintenance', label: 'Mantenimiento' },
  ];

  readonly priorityOptions: { value: RequestPriority; label: string }[] = [
    { value: 'Low', label: 'Baja' },
    { value: 'Medium', label: 'Media' },
    { value: 'High', label: 'Alta' },
  ];

  readonly columns = computed((): readonly TableColumn<RequestDto>[] => [
    { header: 'Código', value: (r) => r.code, class: 'text-secondary w-1' },
    {
      header: 'Conjunto',
      value: (r) => this.tenantMap().get(r.tenantId) ?? r.tenantId.slice(0, 8) + '…',
      class: 'text-nowrap',
    },
    { header: 'Título', value: (r) => r.title },
    {
      header: 'Tipo',
      value: (r) => REQUEST_TYPE_LABELS[r.type as RequestType] ?? r.type,
      badgeClass: () => 'badge bg-blue-lt',
    },
    {
      header: 'Estado',
      value: (r) => REQUEST_STATUS_LABELS[r.status as RequestStatus] ?? r.status,
      badgeClass: (r) => this.statusBadge(r.status),
    },
    {
      header: 'Prioridad',
      value: (r) => REQUEST_PRIORITY_LABELS[r.priority as RequestPriority] ?? r.priority,
      badgeClass: (r) => this.priorityBadge(r.priority),
    },
    { header: 'Registro', value: (r) => this.formatDate(r.createdAtUtc), class: 'text-secondary text-nowrap' },
  ]);

  readonly rowKey = (r: RequestDto): string => r.id;
  readonly editLink = (r: RequestDto): unknown[] => ['/requests', r.id, 'edit'];
  readonly editQueryParams = (r: RequestDto): Record<string, string> => ({
    tenantId: r.tenantId,
  });

  constructor() {
    this.requestsService.tenantCatalog().subscribe({
      next: (tenants) => this.tenants.set(tenants),
      error: () => { /* non-critical; column falls back to UUID prefix */ },
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    const filterControls: AbstractControl[] = [
      this.statusControl,
      this.typeControl,
      this.priorityControl,
      this.visibilityControl,
      this.categoryControl,
    ];
    filterControls.forEach((ctrl) => {
      ctrl.valueChanges
        .pipe(distinctUntilChanged(), takeUntilDestroyed())
        .subscribe(() => this.reload(1));
    });

    // Tenant drives the category filter: switching tenant reloads its categories
    // and resets the (tenant-specific) category selection.
    this.tenantControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((tenantId) => {
        this.onTenantChange(tenantId);
        this.reload(1);
      });

    this.reload(1);
  }

  private onTenantChange(tenantId: string): void {
    this.categoryControl.setValue([], { emitEvent: false });
    this.categories.set([]);

    const slug = this.tenants().find((t) => t.id === tenantId)?.slug;
    if (!slug) {
      this.categoryControl.disable({ emitEvent: false });
      return;
    }
    this.categoryControl.enable({ emitEvent: false });

    this.categoriesLoading.set(true);
    this.requestsService.categoryCatalog(slug).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
      },
      error: () => this.categoriesLoading.set(false),
    });
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private statusBadge(status: string): string {
    const map: Record<string, string> = {
      New: 'badge bg-blue-lt',
      InReview: 'badge bg-yellow-lt',
      InProgress: 'badge bg-orange-lt',
      Resolved: 'badge bg-green-lt',
      Closed: 'badge bg-secondary-lt',
      Rejected: 'badge bg-red-lt',
      Cancelled: 'badge bg-secondary-lt',
      Reopened: 'badge bg-purple-lt',
    };
    return map[status] ?? 'badge';
  }

  private priorityBadge(priority: string): string {
    const map: Record<string, string> = {
      Low: 'badge bg-green-lt',
      Medium: 'badge bg-yellow-lt',
      High: 'badge bg-red-lt',
    };
    return map[priority] ?? 'badge';
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }

  private reload(page: number): void {
    const statuses = this.statusControl.value;
    const categoryIds = this.categoryControl.value;
    const filters: RequestFilters = {
      search: this.searchControl.value || undefined,
      statuses: statuses.length ? statuses : undefined,
      type: (this.typeControl.value as RequestType) || undefined,
      priority: (this.priorityControl.value as RequestPriority) || undefined,
      visibility: (this.visibilityControl.value as RequestVisibility) || undefined,
      tenantId: this.tenantControl.value || undefined,
      categoryIds: categoryIds.length ? categoryIds : undefined,
    };
    this.requestsService.list(page, this.pageSize, filters);
  }
}
