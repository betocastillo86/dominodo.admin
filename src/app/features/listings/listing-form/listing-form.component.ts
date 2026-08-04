import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, finalize } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { ListingsService } from '../data-access/listings.service';
import { ListingKind, ListingStatus } from '../data-access/listing.models';
import { TenantsService } from '../../tenants/data-access/tenants.service';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import { ApartmentsService } from '../../apartments/data-access/apartments.service';
import { ApartmentDto, APARTMENT_TYPE_LABELS } from '../../apartments/data-access/apartment.models';

/** Create or edit a listing. Mode is resolved from the presence of `:id` in the route. */
@Component({
  selector: 'app-listing-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    TablerIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './listing-form.component.html',
})
export class ListingFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly listingsService = inject(ListingsService);
  private readonly tenantsService = inject(TenantsService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';

  /** UI-only: selects which tenant's apartments to browse. Not sent to the API. */
  readonly tenantControl = new FormControl<string>('', { nonNullable: true });

  readonly form = new FormGroup({
    apartmentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    kind: new FormControl<ListingKind>('Sale', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    description: new FormControl('', { nonNullable: true }),
    price: new FormControl<number | null>(null),
    contactPhone: new FormControl('', { nonNullable: true }),
    area: new FormControl<number | null>(null),
    bedrooms: new FormControl<number | null>(null),
    status: new FormControl<ListingStatus>('Active', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly loadingTenants = signal(false);
  readonly tenants = signal<TenantDto[]>([]);
  readonly loadingApartments = signal(false);
  readonly apartments = signal<ApartmentDto[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  /** True if navigated directly to edit URL without passing through the list. */
  readonly notFound = signal(false);

  readonly apartmentTypeLabels = APARTMENT_TYPE_LABELS;

  constructor() {
    // When the user picks a different tenant: clear apartment and load new apartments.
    this.tenantControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe((tenantId) => {
      this.form.controls.apartmentId.setValue('');
      this.apartments.set([]);
      const tenant = this.tenants().find((t) => t.id === tenantId);
      if (tenant) this.loadApartments(tenant.slug);
    });
  }

  ngOnInit(): void {
    if (this.mode === 'edit') {
      const selected = this.listingsService.selected();

      if (!selected || selected.id !== this.id) {
        this.notFound.set(true);
        return;
      }

      this.form.patchValue({
        apartmentId: selected.apartmentId,
        kind: selected.kind,
        description: selected.description ?? '',
        price: selected.price ?? null,
        contactPhone: selected.contactPhone ?? '',
        area: selected.area ?? null,
        bedrooms: selected.bedrooms ?? null,
        status: selected.status,
      });

      // apartmentId and tenant are immutable after creation
      this.form.controls.apartmentId.disable();
      this.tenantControl.disable();

      // Load tenants to resolve the slug, then load apartments for display
      this.loadTenantsForEdit(selected.tenantId, selected.apartmentId);
    } else {
      // status is only meaningful in edit mode
      this.form.controls.status.disable();
      this.loadTenants();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();

    if (this.mode === 'create') {
      this.listingsService
        .create({
          apartmentId: raw.apartmentId.trim(),
          kind: raw.kind,
          description: raw.description.trim() || null,
          price: raw.price,
          contactPhone: raw.contactPhone.trim() || null,
          area: raw.area,
          bedrooms: raw.bedrooms,
        })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Publicación creada'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.listingsService
        .update(this.id!, {
          kind: raw.kind,
          description: raw.description.trim() || null,
          price: raw.price,
          contactPhone: raw.contactPhone.trim() || null,
          area: raw.area,
          bedrooms: raw.bedrooms,
          status: raw.status,
        })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Publicación actualizada'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  aptLabel(apt: ApartmentDto): string {
    const tower = apt.tower ? `${apt.tower} · ` : '';
    const type = this.apartmentTypeLabels[apt.type] ?? apt.type;
    return `${tower}${apt.number} (${type})`;
  }

  private loadTenants(): void {
    this.loadingTenants.set(true);
    this.tenantsService
      .listAll()
      .pipe(finalize(() => this.loadingTenants.set(false)))
      .subscribe({
        next: (tenants) => this.tenants.set(tenants),
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudieron cargar los conjuntos.')),
      });
  }

  private loadTenantsForEdit(tenantId: string, apartmentId: string): void {
    this.loadingTenants.set(true);
    this.tenantsService
      .listAll()
      .pipe(finalize(() => this.loadingTenants.set(false)))
      .subscribe({
        next: (tenants) => {
          this.tenants.set(tenants);
          const tenant = tenants.find((t) => t.id === tenantId);
          if (tenant) {
            // emitEvent: false prevents the subscription from clearing apartmentId
            this.tenantControl.setValue(tenant.id, { emitEvent: false });
            this.loadApartments(tenant.slug, apartmentId);
          }
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudieron cargar los conjuntos.')),
      });
  }

  private loadApartments(tenantSlug: string, _preselectId?: string): void {
    this.loadingApartments.set(true);
    this.apartmentsService
      .listForTenant(tenantSlug)
      .pipe(finalize(() => this.loadingApartments.set(false)))
      .subscribe({
        next: (apartments) => this.apartments.set(apartments),
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudieron cargar los apartamentos.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/listings']);
  }

  private handleError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const problem = err.error as ProblemDetails | undefined;

      if (problem?.errors?.length) {
        for (const fieldError of problem.errors) {
          const control = this.form.get(this.mapPropertyToControl(fieldError.property));
          control?.setErrors({ server: fieldError.message });
        }
        this.error.set(problem.detail ?? problem.title ?? 'Revisa los campos marcados.');
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar la publicación.');
      return;
    }
    this.error.set('No se pudo guardar la publicación.');
  }

  private mapPropertyToControl(property: string): string {
    return property.charAt(0).toLowerCase() + property.slice(1);
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const problem = err.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? fallback;
    }
    return fallback;
  }
}
