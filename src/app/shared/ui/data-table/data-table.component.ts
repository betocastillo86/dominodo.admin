import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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

  /** Pages rendered to each side of the current one in the numbered window. */
  readonly windowSize = input(1);

  readonly pageChange = output<number>();

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
