import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { ListingsService } from '../data-access/listings.service';
import {
  ListingDto,
  ListingKind,
  ListingStatus,
  LISTING_KIND_LABELS,
  LISTING_KIND_BADGES,
  LISTING_STATUS_LABELS,
  LISTING_STATUS_BADGES,
} from '../data-access/listing.models';

/** Server-paginated listing of property publications. */
@Component({
  selector: 'app-listing-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listing-list.component.html',
})
export class ListingListComponent {
  private readonly listingsService = inject(ListingsService);
  private readonly router = inject(Router);

  readonly listings = this.listingsService.listings;
  readonly paging = this.listingsService.paging;
  readonly loading = this.listingsService.loading;
  readonly error = this.listingsService.error;

  private readonly pageSize = 20;

  readonly kindControl = new FormControl<ListingKind | ''>('', { nonNullable: true });
  readonly statusControl = new FormControl<ListingStatus | ''>('', { nonNullable: true });

  readonly columns: readonly TableColumn<ListingDto>[] = [
    {
      header: 'Tipo',
      value: (r) => LISTING_KIND_LABELS[r.kind],
      badgeClass: (r) => LISTING_KIND_BADGES[r.kind],
    },
    {
      header: 'Estado',
      value: (r) => LISTING_STATUS_LABELS[r.status],
      badgeClass: (r) => LISTING_STATUS_BADGES[r.status],
    },
    { header: 'Apartamento', value: (r) => r.apartmentId, class: 'text-secondary' },
    {
      header: 'Precio',
      value: (r) => (r.price != null ? `$${r.price.toLocaleString('es-CO')}` : '—'),
      class: 'text-end',
    },
    { header: 'Habitaciones', value: (r) => r.bedrooms ?? '—', class: 'text-end' },
    {
      header: 'Área (m²)',
      value: (r) => (r.area != null ? r.area.toLocaleString('es-CO') : '—'),
      class: 'text-end',
    },
  ];

  readonly rowKey = (listing: ListingDto): string => listing.id;

  readonly editFn = (listing: ListingDto): void => {
    this.listingsService.select(listing);
    this.router.navigate(['/listings', listing.id, 'edit']);
  };

  constructor() {
    this.kindControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.statusControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const kind = (this.kindControl.value as ListingKind) || undefined;
    const status = (this.statusControl.value as ListingStatus) || undefined;
    this.listingsService.list(page, this.pageSize, kind, status);
  }
}
