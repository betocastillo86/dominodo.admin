import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { AnnouncementsService } from '../data-access/announcements.service';
import { AnnouncementDto, AnnouncementStatus } from '../data-access/announcement.models';
import { TenantDto } from '../../tenants/data-access/tenant.models';

/** Server-paginated listing of announcements with status, category and tenant filters. */
@Component({
  selector: 'app-announcement-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-list.component.html',
})
export class AnnouncementListComponent {
  private readonly announcementsService = inject(AnnouncementsService);

  readonly announcements = this.announcementsService.announcements;
  readonly paging = this.announcementsService.paging;
  readonly loading = this.announcementsService.loading;
  readonly error = this.announcementsService.error;

  readonly tenants = signal<TenantDto[]>([]);
  private readonly tenantsMap = signal<Map<string, string>>(new Map());

  private readonly pageSize = 20;

  readonly categoryControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<AnnouncementStatus | ''>('', { nonNullable: true });
  readonly tenantControl = new FormControl('', { nonNullable: true });

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

  readonly columns: readonly TableColumn<AnnouncementDto>[] = [
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
    { header: 'Categoría', value: (r) => r.category ?? '—' },
    { header: 'Audiencia', value: (r) => this.audienceLabels[r.audienceType] ?? r.audienceType },
    { header: 'Prioridad', value: (r) => r.priority, class: 'text-end w-1' },
    { header: 'Vence', value: (r) => (r.expiresAtUtc ? r.expiresAtUtc.slice(0, 10) : '—') },
  ];

  readonly rowKey = (a: AnnouncementDto): string => a.id;
  readonly editLink = (a: AnnouncementDto): unknown[] => ['/announcements', a.id, 'edit'];

  constructor() {
    this.announcementsService.listTenants().subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        this.tenantsMap.set(new Map(tenants.map((t) => [t.id, t.name])));
      },
    });

    this.categoryControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.statusControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.tenantControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const category = this.categoryControl.value || undefined;
    const status = (this.statusControl.value as AnnouncementStatus) || undefined;
    const tenantId = this.tenantControl.value || undefined;
    this.announcementsService.list(page, this.pageSize, status, category, tenantId);
  }
}
