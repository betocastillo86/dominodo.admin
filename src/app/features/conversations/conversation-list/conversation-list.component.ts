import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import { ConversationsService } from '../data-access/conversations.service';
import { ConversationSummaryDto } from '../data-access/conversation.models';

/** Cross-tenant listing of the conversations Domi persisted, newest first. */
@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './conversation-list.component.html',
})
export class ConversationListComponent {
  private readonly conversationsService = inject(ConversationsService);

  readonly conversations = this.conversationsService.conversations;
  readonly paging = this.conversationsService.paging;
  readonly loading = this.conversationsService.loading;
  readonly error = this.conversationsService.error;

  private readonly pageSize = 20;

  readonly phoneControl = new FormControl('', { nonNullable: true });
  /** Holds the tenant slug: the API filters conversations by slug, not by tenant id. */
  readonly tenantControl = new FormControl('', { nonNullable: true });
  readonly fromControl = new FormControl('', { nonNullable: true });
  readonly toControl = new FormControl('', { nonNullable: true });

  readonly tenants = signal<TenantDto[]>([]);

  private readonly tenantNames = computed(() => {
    const map = new Map<string, string>();
    for (const t of this.tenants()) map.set(t.slug, t.name);
    return map;
  });

  readonly columns = computed((): readonly TableColumn<ConversationSummaryDto>[] => [
    { header: 'Teléfono', value: (c) => c.senderId, class: 'text-nowrap' },
    {
      header: 'Conjunto',
      value: (c) => this.tenantNames().get(c.tenantSlug) ?? c.tenantSlug,
      class: 'text-nowrap',
    },
    { header: 'Mensajes', value: (c) => c.messageCount, class: 'text-end' },
    { header: 'Decisiones', value: (c) => c.decisionCount, class: 'text-end' },
    {
      header: 'Sesión',
      value: (c) => (c.hasLiveSession ? 'Activa' : 'Expirada'),
      badgeClass: (c) => (c.hasLiveSession ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
    {
      header: 'Último turno',
      value: (c) => this.formatDate(c.lastTurnAtUtc),
      class: 'text-secondary text-nowrap',
    },
    {
      header: 'Creada',
      value: (c) => this.formatDate(c.createdAtUtc),
      class: 'text-secondary text-nowrap',
    },
  ]);

  readonly rowKey = (c: ConversationSummaryDto): string => c.conversationId;
  readonly detailLink = (c: ConversationSummaryDto): string[] => [c.conversationId];

  constructor() {
    this.conversationsService.tenantCatalog().subscribe({
      next: (tenants) => this.tenants.set(tenants),
      error: () => {
        /* non-critical: the column falls back to the raw slug */
      },
    });

    this.phoneControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    for (const control of [this.tenantControl, this.fromControl, this.toControl]) {
      control.valueChanges
        .pipe(distinctUntilChanged(), takeUntilDestroyed())
        .subscribe(() => this.reload(1));
    }

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const from = this.fromControl.value;
    const to = this.toControl.value;
    this.conversationsService.list(page, this.pageSize, {
      senderId: this.phoneControl.value.trim() || undefined,
      tenant: this.tenantControl.value || undefined,
      // The date inputs are day-precision; widen them to cover the whole day.
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T23:59:59` : undefined,
    });
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
