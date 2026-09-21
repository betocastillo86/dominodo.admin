import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PagedResult } from '../../../core/models/paged-result';
import { SpinnerComponent } from '../spinner/spinner.component';

/** Definition of a single column for the generic data table. */
export interface TableColumn<T> {
  /** Column header text. */
  header: string;
  /** Extracts the display value for a row. */
  value: (row: T) => string | number;
  /** When it returns a non-empty class, the value is rendered as a badge. */
  badgeClass?: (row: T) => string;
  /** Optional CSS class applied to the header and cells. */
  class?: string;
  /**
   * Renders the value inside a fixed-width cell, clipped with an ellipsis when
   * it does not fit (the full text stays available as the cell's tooltip).
   */
  truncate?: boolean;
  /** When set, the header becomes a Tabler sort button emitting this key. */
  sortKey?: string;
}

/** Current sort state: which column key and in which direction. */
export interface TableSort {
  key: string;
  direction: 'asc' | 'desc';
}

/**
 * Generic, presentational paged table (Tabler markup). Emits `pageChange` for
 * server-side pagination; rendering of loading/error/empty states included.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [SpinnerComponent, RouterLink, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './data-table.component.html',
})
export class DataTableComponent<T> {
  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly paging = input<PagedResult<T> | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  /** Stable key for `@for` tracking; defaults to the row reference. */
  readonly rowKey = input<(row: T) => unknown>((row) => row);
  /** When set, renders a final action column linking to `actionLink(row)`. */
  readonly actionLink = input<((row: T) => string | unknown[]) | null>(null);
  /** Icon name for the action column link. */
  readonly actionIcon = input<string>('edit');
  /** Optional query params merged into each row's action link. */
  readonly actionQueryParams = input<((row: T) => Record<string, string>) | null>(null);
  /** Alternative to actionLink: invokes a callback with the row instead of navigating. */
  readonly actionFn = input<((row: T) => void) | null>(null);
  /**
   * When set, renders a destructive action next to the regular one. The first click only
   * arms the row: the callback runs after the user confirms, so the caller never has to
   * build its own dialog.
   */
  readonly deleteFn = input<((row: T) => void) | null>(null);
  /** Key of the row whose deletion is in flight; its buttons show a spinner and lock. */
  readonly deletingKey = input<unknown>(null);
  /** When set, its result is applied as the CSS class of the row's `<tr>`. */
  readonly rowClass = input<((row: T, index: number) => string) | null>(null);

  /** Pages rendered to each side of the current one in the numbered window. */
  readonly windowSize = input(1);

  /** Current sort state (controlled); drives the asc/desc arrow on headers. */
  readonly sort = input<TableSort | null>(null);

  readonly pageChange = output<number>();
  readonly sortChange = output<TableSort>();

  /** Key of the row currently asking for delete confirmation, if any. */
  private readonly confirmingKey = signal<unknown>(null);

  /** True when the table renders a trailing column of row actions. */
  readonly hasActions = computed(() => !!(this.actionLink() || this.actionFn() || this.deleteFn()));

  /** True when the page count is large enough to warrant the "jump to page" input. */
  readonly showJump = computed(() => (this.paging()?.totalPages ?? 0) > 5);

  /**
   * Sequence of numbered pages to render, with `'ellipsis'` markers where a gap
   * is collapsed. Always includes the first and last page plus a window around
   * the current one. Returns `[]` when there is no paging.
   */
  readonly pages = computed<(number | 'ellipsis')[]>(() => {
    const paging = this.paging();
    if (!paging) {
      return [];
    }
    const total = paging.totalPages;
    const current = paging.page;
    const window = this.windowSize();

    const visible = new Set<number>([1, total]);
    for (let p = current - window; p <= current + window; p++) {
      if (p >= 1 && p <= total) {
        visible.add(p);
      }
    }

    const sorted = [...visible].sort((a, b) => a - b);
    const result: (number | 'ellipsis')[] = [];
    let prev = 0;
    for (const page of sorted) {
      if (prev && page - prev > 1) {
        result.push('ellipsis');
      }
      result.push(page);
      prev = page;
    }
    return result;
  });

  isConfirming(row: T): boolean {
    return this.confirmingKey() === this.rowKey()(row);
  }

  isDeleting(row: T): boolean {
    return this.deletingKey() !== null && this.deletingKey() === this.rowKey()(row);
  }

  /** Arms the row: swaps the trash button for the confirm/cancel pair. */
  askDelete(row: T): void {
    this.confirmingKey.set(this.rowKey()(row));
  }

  cancelDelete(): void {
    this.confirmingKey.set(null);
  }

  confirmDelete(row: T, fn: (row: T) => void): void {
    this.confirmingKey.set(null);
    fn(row);
  }

  /**
   * CSS class for a sortable header button: `asc`/`desc` when this column is the
   * active sort, empty otherwise (Tabler renders the direction arrow from it).
   */
  sortClass(key: string): string {
    const sort = this.sort();
    return sort?.key === key ? sort.direction : '';
  }

  /**
   * Toggle sorting for a column: flip direction if it is already the active
   * sort, otherwise start it descending. Emits the new state for the parent.
   */
  toggleSort(key: string): void {
    const sort = this.sort();
    const direction: 'asc' | 'desc' =
      sort?.key === key && sort.direction === 'desc' ? 'asc' : 'desc';
    this.sortChange.emit({ key, direction });
  }

  goTo(page: number): void {
    const paging = this.paging();
    if (!paging || page < 1 || page > paging.totalPages || page === paging.page) {
      return;
    }
    this.pageChange.emit(page);
  }

  /** Jump to a page number typed into the "Ir a la página" input. */
  goToInput(value: string | number): void {
    const page = typeof value === 'number' ? value : parseInt(value, 10);
    if (Number.isNaN(page)) {
      return;
    }
    this.goTo(page);
  }
}
