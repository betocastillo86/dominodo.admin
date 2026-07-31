import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { KnowledgeResourcesService } from '../data-access/knowledge-resources.service';
import {
  KNOWLEDGE_RESOURCE_STATUS_BADGES,
  KNOWLEDGE_RESOURCE_STATUS_LABELS,
  KnowledgeResourceDto,
  KnowledgeResourceStatus,
} from '../data-access/knowledge-resource.models';
import { TenantDto } from '../../tenants/data-access/tenant.models';

/** Cross-tenant, server-paginated listing of knowledge resources with status, search and tenant filters. */
@Component({
  selector: 'app-knowledge-resource-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './knowledge-resource-list.component.html',
})
export class KnowledgeResourceListComponent {
  private readonly resourcesService = inject(KnowledgeResourcesService);

  readonly resources = this.resourcesService.resources;
  readonly paging = this.resourcesService.paging;
  readonly loading = this.resourcesService.loading;
  readonly error = this.resourcesService.error;

  readonly tenants = signal<TenantDto[]>([]);
  private readonly tenantsMap = computed(() => {
    const m = new Map<string, string>();
    for (const t of this.tenants()) m.set(t.id, t.name);
    return m;
  });

  private readonly pageSize = 20;

  readonly statusControl = new FormControl<KnowledgeResourceStatus | ''>('', { nonNullable: true });
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly tenantControl = new FormControl('', { nonNullable: true });

  readonly columns = computed((): readonly TableColumn<KnowledgeResourceDto>[] => [
    { header: 'Título', value: (r) => r.title },
    {
      header: 'Conjunto',
      value: (r) => this.tenantsMap().get(r.tenantId) ?? r.tenantId.slice(0, 8) + '…',
      class: 'text-nowrap',
    },
    { header: 'Categoría', value: (r) => r.category || '—' },
    {
      header: 'Estado',
      value: (r) => KNOWLEDGE_RESOURCE_STATUS_LABELS[r.status] ?? r.status,
      badgeClass: (r) => KNOWLEDGE_RESOURCE_STATUS_BADGES[r.status] ?? 'badge',
    },
    { header: 'Publicado', value: (r) => (r.publishedAtUtc ? r.publishedAtUtc.slice(0, 10) : '—') },
    { header: 'Actualizado', value: (r) => (r.updatedAtUtc ? r.updatedAtUtc.slice(0, 10) : '—') },
  ]);

  readonly rowKey = (r: KnowledgeResourceDto): string => r.id;
  readonly editLink = (r: KnowledgeResourceDto): unknown[] => ['/knowledge-resources', r.id, 'edit'];
  readonly editQueryParams = (r: KnowledgeResourceDto): Record<string, string> => ({
    tenantId: r.tenantId,
  });

  constructor() {
    this.resourcesService.listTenants().subscribe({
      next: (tenants) => this.tenants.set(tenants),
      error: () => { /* non-critical; column falls back to UUID prefix */ },
    });

    this.statusControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
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
    const status = (this.statusControl.value as KnowledgeResourceStatus) || undefined;
    const search = this.searchControl.value.trim() || undefined;
    const tenantId = this.tenantControl.value || undefined;
    this.resourcesService.list(page, this.pageSize, status, search, tenantId);
  }
}
