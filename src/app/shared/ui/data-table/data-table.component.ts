import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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

  readonly pageChange = output<number>();

  goTo(page: number): void {
    const paging = this.paging();
    if (!paging || page < 1 || page > paging.totalPages || page === paging.page) {
      return;
    }
    this.pageChange.emit(page);
  }
}
