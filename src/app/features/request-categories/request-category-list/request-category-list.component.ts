import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { RequestCategoriesService } from '../data-access/request-categories.service';
import { RequestCategoryDto } from '../data-access/request-category.models';

@Component({
  selector: 'app-request-category-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-category-list.component.html',
})
export class RequestCategoryListComponent {
  private readonly service = inject(RequestCategoriesService);

  readonly categories = this.service.categories;
  readonly paging = this.service.paging;
  readonly loading = this.service.loading;
  readonly error = this.service.error;

  private readonly pageSize = 20;

  readonly nameControl = new FormControl('', { nonNullable: true });
  readonly isActiveControl = new FormControl<'' | 'true' | 'false'>('', { nonNullable: true });

  readonly columns: readonly TableColumn<RequestCategoryDto>[] = [
    { header: 'Código', value: (r) => r.code, class: 'w-1 text-nowrap' },
    { header: 'Nombre', value: (r) => r.name },
    {
      header: 'Estado',
      value: (r) => (r.isActive ? 'Activo' : 'Inactivo'),
      badgeClass: (r) => (r.isActive ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
  ];

  readonly rowKey = (cat: RequestCategoryDto): string => cat.id;
  readonly editLink = (cat: RequestCategoryDto): unknown[] => ['/request-categories', cat.id, 'edit'];

  constructor() {
    this.nameControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.isActiveControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const search = this.nameControl.value || undefined;
    const isActiveStr = this.isActiveControl.value;
    const isActive =
      isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;
    this.service.list(page, this.pageSize, search, isActive);
  }
}
