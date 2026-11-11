import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import {
  DataTableComponent,
  TableColumn,
  TableSort,
} from '../../../shared/ui/data-table/data-table.component';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import { ChatFeedbackService } from '../data-access/chat-feedback.service';
import {
  ChatFeedbackItemDto,
  ChatFeedbackScope,
  ChatFeedbackSummaryDto,
} from '../data-access/chat-feedback.models';
import { ChatFeedbackModalComponent } from '../chat-feedback-modal/chat-feedback-modal.component';

/** The only sortable column: the API orders by `createdAtUtc` and takes just a direction. */
const DATE_SORT_KEY = 'createdAtUtc';

/** A tri-state boolean filter as a select value: `''` means "no filter". */
type BoolFilter = '' | 'true' | 'false';

/**
 * Cross-tenant listing of the questions Domi deflected and the residents' verdicts, with the
 * totals of the same tenant/date scope on top.
 */
@Component({
  selector: 'app-chat-feedback-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './chat-feedback-list.component.html',
})
export class ChatFeedbackListComponent {
  private readonly chatFeedbackService = inject(ChatFeedbackService);
  private readonly modal = inject(NgbModal);

  readonly feedback = this.chatFeedbackService.feedback;
  readonly paging = this.chatFeedbackService.paging;
  readonly loading = this.chatFeedbackService.loading;
  readonly error = this.chatFeedbackService.error;

  private readonly pageSize = 20;

  /** Holds the tenant slug: the API filters feedback by slug, not by tenant id. */
  readonly tenantControl = new FormControl('', { nonNullable: true });
  readonly fromControl = new FormControl('', { nonNullable: true });
  readonly toControl = new FormControl('', { nonNullable: true });
  readonly wasHelpfulControl = new FormControl<BoolFilter>('', {
    nonNullable: true,
  });
  readonly answeredControl = new FormControl<BoolFilter>('', {
    nonNullable: true,
  });

  readonly sort = signal<TableSort>({ key: DATE_SORT_KEY, direction: 'desc' });

  readonly tenants = signal<TenantDto[]>([]);
  readonly summary = signal<ChatFeedbackSummaryDto | null>(null);

  private readonly tenantNames = computed(() => {
    const map = new Map<string, string>();
    for (const t of this.tenants()) map.set(t.slug, t.name);
    return map;
  });

  readonly columns = computed((): readonly TableColumn<ChatFeedbackItemDto>[] => [
    {
      header: 'Fecha',
      value: (f) => this.formatDate(f.createdAtUtc),
      class: 'text-secondary text-nowrap',
      sortKey: DATE_SORT_KEY,
    },
    {
      header: 'Conjunto',
      value: (f) => this.tenantNames().get(f.tenantSlug) ?? f.tenantSlug,
      class: 'text-nowrap',
    },
    { header: 'Teléfono', value: (f) => f.senderId, class: 'text-nowrap' },
    {
      header: 'Encuesta',
      value: (f) => (f.asked ? 'Enviada' : 'No enviada'),
      badgeClass: (f) => (f.asked ? 'badge bg-blue-lt' : 'badge bg-secondary-lt'),
    },
    {
      header: 'Valoración',
      value: (f) => (f.wasHelpful === null ? 'Sin respuesta' : f.wasHelpful ? 'Útil' : 'No útil'),
      badgeClass: (f) =>
        f.wasHelpful === null
          ? 'badge bg-secondary-lt'
          : f.wasHelpful
            ? 'badge bg-green-lt'
            : 'badge bg-red-lt',
    },
    {
      // Only whether there is one: the text itself lives in the detail modal.
      header: 'Comentario',
      value: (f) => (f.comment?.trim() ? 'Sí' : 'No'),
      badgeClass: (f) => (f.comment?.trim() ? 'badge bg-blue-lt' : 'badge bg-secondary-lt'),
    },
    { header: 'Episodio', value: (f) => f.episode, class: 'text-end' },
  ]);

  readonly rowKey = (f: ChatFeedbackItemDto): string => f.id;

  /** The question and the comment do not fit the table, so a row opens them in a modal. */
  readonly openDetail = (f: ChatFeedbackItemDto): void => {
    const ref = this.modal.open(ChatFeedbackModalComponent, {
      size: 'lg',
      centered: true,
      scrollable: true,
    });
    ref.componentInstance.item = f;
    ref.componentInstance.tenant = this.tenantNames().get(f.tenantSlug) ?? f.tenantSlug;
  };

  constructor() {
    this.chatFeedbackService.tenantCatalog().subscribe({
      next: (tenants) => this.tenants.set(tenants),
      error: () => {
        /* non-critical: the column falls back to the raw slug */
      },
    });

    // The summary only depends on the scope, so the verdict filters reload just the list.
    for (const control of [this.tenantControl, this.fromControl, this.toControl]) {
      control.valueChanges.pipe(distinctUntilChanged(), takeUntilDestroyed()).subscribe(() => {
        this.reload(1);
        this.loadSummary();
      });
    }
    for (const control of [this.wasHelpfulControl, this.answeredControl]) {
      control.valueChanges
        .pipe(distinctUntilChanged(), takeUntilDestroyed())
        .subscribe(() => this.reload(1));
    }

    this.reload(1);
    this.loadSummary();
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  onSortChange(sort: TableSort): void {
    this.sort.set(sort);
    this.reload(1);
  }

  /** A rate (0–1) as a whole percentage; `—` when the API reports no denominator. */
  formatRate(rate: number | null): string {
    return rate === null ? '—' : `${Math.round(rate * 100)} %`;
  }

  private reload(page: number): void {
    this.chatFeedbackService.list(page, this.pageSize, {
      ...this.scope(),
      wasHelpful: this.toBool(this.wasHelpfulControl.value),
      answered: this.toBool(this.answeredControl.value),
      direction: this.sort().direction === 'asc' ? 'Asc' : 'Desc',
    });
  }

  private loadSummary(): void {
    this.chatFeedbackService.summary(this.scope()).subscribe({
      next: (summary) => this.summary.set(summary),
      // The list reports the same failure (Domi down, from > to), so the cards just clear.
      error: () => this.summary.set(null),
    });
  }

  private scope(): ChatFeedbackScope {
    const from = this.fromControl.value;
    const to = this.toControl.value;
    return {
      tenant: this.tenantControl.value || undefined,
      // The date inputs are day-precision; widen them to cover the whole day.
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T23:59:59` : undefined,
    };
  }

  private toBool(value: BoolFilter): boolean | undefined {
    return value === '' ? undefined : value === 'true';
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
