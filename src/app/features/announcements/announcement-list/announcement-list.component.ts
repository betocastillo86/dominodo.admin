import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../../shared/ui/multi-select/multi-select.component';
import { AnnouncementsService } from '../data-access/announcements.service';
import {
  AnnouncementDto,
  AnnouncementPriority,
  AnnouncementStatus,
} from '../data-access/announcement.models';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import { RequestCategoriesService } from '../../request-categories/data-access/request-categories.service';

/** Server-paginated listing of announcements with status, category and tenant filters. */
@Component({
  selector: 'app-announcement-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, MultiSelectComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-list.component.html',
})
export class AnnouncementListComponent {
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly requestCategoriesService = inject(RequestCategoriesService);

  readonly announcements = this.announcementsService.announcements;
  readonly paging = this.announcementsService.paging;
  readonly loading = this.announcementsService.loading;
  readonly error = this.announcementsService.error;

  readonly tenants = signal<TenantDto[]>([]);
  private readonly tenantsMap = signal<Map<string, string>>(new Map());

  readonly categories = this.requestCategoriesService.categories;

  private readonly categoriesMap = computed(() => {
    const m = new Map<string, string>();
    for (const c of this.categories()) m.set(c.id, c.name);
    return m;
  });

  readonly categoryOptions = computed<MultiSelectOption[]>(() =>
    this.categories().map((c) => ({ value: c.id, label: c.name })),
  );

  private readonly pageSize = 20;

  readonly categoryControl = new FormControl<string[]>([], { nonNullable: true });
  readonly statusControl = new FormControl<AnnouncementStatus | ''>('', { nonNullable: true });
  readonly tenantControl = new FormControl('', { nonNullable: true });
  readonly priorityControl = new FormControl<AnnouncementPriority | ''>('', { nonNullable: true });

  private readonly statusLabels: Record<AnnouncementStatus, string> = {
    Draft: 'Borrador',
    Published: 'Publicado',
    Archived: 'Archivado',
  };

  private readonly audienceLabels: Record<string, string> = {
    AllTenant: 'Todos',
    ByTower: 'Por torre',
    ByApartments: 'Por apartamento',
  };

  private readonly statusBadges: Record<AnnouncementStatus, string> = {
    Draft: 'badge bg-secondary-lt',
    Published: 'badge bg-green-lt',
    Archived: 'badge bg-red-lt',
  };

  private readonly priorityLabels: Record<AnnouncementPriority, string> = {
    High: 'Alta',
    Medium: 'Media',
    Low: 'Baja',
  };

  private readonly priorityBadges: Record<AnnouncementPriority, string> = {
    High: 'badge bg-red-lt',
    Medium: 'badge bg-yellow-lt',
    Low: 'badge bg-green-lt',
  };

  readonly columns = computed((): readonly TableColumn<AnnouncementDto>[] => [
    { header: 'Título', value: (r) => r.title },
    {
      header: 'Conjunto',
      value: (r) => this.tenantsMap().get(r.tenantId) ?? r.tenantId.slice(0, 8) + '…',
    },
    {
      header: 'Estado',
      value: (r) => this.statusLabels[r.status] ?? r.status,
      badgeClass: (r) => this.statusBadges[r.status] ?? 'badge',
    },
    {
      header: 'Categoría',
      value: (r) =>
        r.categoryId
          ? (this.categoriesMap().get(r.categoryId) ?? r.categoryId.slice(0, 8) + '…')
          : '—',
    },
    { header: 'Audiencia', value: (r) => this.audienceLabels[r.audienceType] ?? r.audienceType },
    {
      header: 'Prioridad',
      value: (r) => this.priorityLabels[r.priority] ?? r.priority,
      badgeClass: (r) => this.priorityBadges[r.priority] ?? 'badge',
    },
    { header: 'Vence', value: (r) => (r.expiresAtUtc ? r.expiresAtUtc.slice(0, 10) : '—') },
  ]);

  readonly rowKey = (a: AnnouncementDto): string => a.id;
  readonly editLink = (a: AnnouncementDto): unknown[] => ['/announcements', a.id, 'edit'];

  constructor() {
    this.announcementsService.listTenants().subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.tenantsMap.set(new Map(tenants.map((t) => [t.id, t.name])));
      },
    });

    this.requestCategoriesService.list(1, 200);

    this.categoryControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.statusControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.tenantControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.priorityControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const categoryIds = this.categoryControl.value;
    const status = (this.statusControl.value as AnnouncementStatus) || undefined;
    const tenantId = this.tenantControl.value || undefined;
    const priority = (this.priorityControl.value as AnnouncementPriority) || undefined;
    this.announcementsService.list(
      page,
      this.pageSize,
      status,
      categoryIds.length ? categoryIds : undefined,
      tenantId,
      priority,
    );
  }
}
