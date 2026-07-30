import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { PagedResult } from '../../../core/models/paged-result';
import { TenantsService } from '../data-access/tenants.service';
import {
  TENANT_STATUS_BADGES,
  TENANT_STATUS_LABELS,
  TenantFeatureDto,
  TenantStatus,
  TenantType,
} from '../data-access/tenant.models';
import { ApartmentsService } from '../../apartments/data-access/apartments.service';
import {
  APARTMENT_STATUS_BADGES,
  APARTMENT_STATUS_LABELS,
  APARTMENT_TYPE_LABELS,
  ApartmentDto,
} from '../../apartments/data-access/apartment.models';

/** Create or edit a tenant (conjunto). Mode is resolved from the presence of `:id` in the route. */
@Component({
  selector: 'app-tenant-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SpinnerComponent, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-form.component.html',
})
export class TenantFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tenantsService = inject(TenantsService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';
  /** Exposed for apartment links so the apartment form can navigate back here. */
  readonly tenantId = this.id ?? '';

  readonly form = new FormGroup({
    // `slug` and `type` are set on create and immutable on edit (disabled below).
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    type: new FormControl<TenantType>('Conjunto', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    legalId: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    city: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    country: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    confirmInvitationRequired: new FormControl(false, { nonNullable: true }),
    // Create-only fields (not part of the update contract; disabled on edit).
    branding: new FormControl('', { nonNullable: true }),
    settings: new FormControl('', { nonNullable: true }),
  });

  readonly loadingTenant = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  readonly loading = this.loadingTenant;

  // Apartments embedded section (edit mode only).
  readonly tenantSlug = signal<string | null>(null);
  readonly tenantApartments = signal<ApartmentDto[]>([]);
  readonly apartmentsPaging = signal<PagedResult<ApartmentDto> | null>(null);
  readonly loadingApartments = signal(false);
  readonly apartmentsError = signal<string | null>(null);

  // Simple search: `tower` is filtered server-side; `number` is filtered client-side
  // over the loaded page because the list endpoint does not accept a number param.
  readonly towerSearch = new FormControl('', { nonNullable: true });
  readonly numberSearch = new FormControl('', { nonNullable: true });
  private readonly numberFilter = signal('');

  readonly filteredApartments = computed(() => {
    const term = this.numberFilter().trim().toLowerCase();
    if (!term) return this.tenantApartments();
    return this.tenantApartments().filter((a) => a.number.toLowerCase().includes(term));
  });

  readonly apartmentColumns: readonly TableColumn<ApartmentDto>[] = [
    { header: 'Número', value: (a) => a.number },
    { header: 'Torre', value: (a) => a.tower ?? '—' },
    {
      header: 'Tipo',
      value: (a) => APARTMENT_TYPE_LABELS[a.type] ?? a.type,
      badgeClass: () => 'badge bg-blue-lt',
    },
    {
      header: 'Estado',
      value: (a) => APARTMENT_STATUS_LABELS[a.status] ?? a.status,
      badgeClass: (a) => APARTMENT_STATUS_BADGES[a.status] ?? 'badge',
    },
  ];

  // Status section (edit mode only).
  readonly currentStatus = signal<TenantStatus | null>(null);
  readonly selectedStatus = signal<TenantStatus | null>(null);
  readonly changingStatus = signal(false);
  readonly confirmingStatus = signal(false);
  readonly statusError = signal<string | null>(null);
  readonly TENANT_STATUS_LABELS = TENANT_STATUS_LABELS;
  readonly TENANT_STATUS_BADGES = TENANT_STATUS_BADGES;
  readonly ALL_STATUSES: TenantStatus[] = ['Onboarding', 'Active', 'Suspended'];

  // Features section (edit mode only).
  readonly tenantFeatures = signal<TenantFeatureDto[]>([]);
  readonly loadingFeatures = signal(false);
  readonly featuresError = signal<string | null>(null);
  readonly newFeatureKey = new FormControl('', { nonNullable: true });
  readonly addingFeature = signal(false);
  readonly togglingFeature = signal<string | null>(null);

  readonly apartmentRowKey = (apt: ApartmentDto): string => apt.id;

  readonly apartmentEditLink = (apt: ApartmentDto): unknown[] => ['/apartments', apt.id, 'edit'];

  readonly apartmentQueryParams = (_apt: ApartmentDto): Record<string, string> => ({
    tenant: this.tenantSlug() ?? '',
    tenantId: this.tenantId,
  });

  constructor() {
    // Tower search hits the server; number search is applied client-side.
    this.towerSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadApartmentsPage(1));

    this.numberSearch.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => this.numberFilter.set(value));
  }

  ngOnInit(): void {
    if (this.mode === 'edit') {
      // Immutable / create-only fields cannot be changed once the tenant exists.
      this.form.controls.slug.disable();
      this.form.controls.type.disable();
      this.form.controls.branding.disable();
      this.form.controls.settings.disable();
      this.loadTenant(this.id!);
    }
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const name = raw.name.trim();
    const legalId = raw.legalId.trim() || null;
    const address = raw.address.trim();
    const city = raw.city.trim();
    const country = raw.country.trim();

    if (this.mode === 'create') {
      this.tenantsService
        .create({
          slug: raw.slug.trim(),
          name,
          type: raw.type,
          address,
          city,
          country,
          legalId,
          confirmInvitationRequired: raw.confirmInvitationRequired,
          branding: raw.branding.trim() || null,
          settings: raw.settings.trim() || null,
        })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Conjunto creado'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.tenantsService
        .update(this.id!, { name, legalId, address, city, country, confirmInvitationRequired: raw.confirmInvitationRequired })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Conjunto actualizado'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private loadTenant(id: string): void {
    this.loadingTenant.set(true);
    this.tenantsService
      .getById(id)
      .pipe(finalize(() => this.loadingTenant.set(false)))
      .subscribe({
        next: (tenant) => {
          this.form.patchValue({
            slug: tenant.slug,
            name: tenant.name,
            type: tenant.type,
            legalId: tenant.legalId ?? '',
            address: tenant.address,
            city: tenant.city,
            country: tenant.country,
            confirmInvitationRequired: tenant.confirmInvitationRequired,
            branding: tenant.branding ?? '',
            settings: tenant.settings ?? '',
          });
          this.tenantSlug.set(tenant.slug);
          this.currentStatus.set(tenant.status);
          this.selectedStatus.set(tenant.status);
          this.loadApartmentsPage(1);
          this.loadFeatures();
        },
        error: (err: unknown) => this.error.set(this.toMessage(err, 'No se pudo cargar el conjunto.')),
      });
  }

  onStatusChange(value: string): void {
    this.selectedStatus.set(value as TenantStatus);
    this.confirmingStatus.set(false);
  }

  requestStatusChange(): void {
    this.confirmingStatus.set(true);
  }

  cancelStatusChange(): void {
    this.confirmingStatus.set(false);
  }

  submitStatusChange(): void {
    const status = this.selectedStatus();
    if (!status || !this.id || status === this.currentStatus()) return;
    this.changingStatus.set(true);
    this.confirmingStatus.set(false);
    this.statusError.set(null);
    this.tenantsService
      .changeStatus(this.id, { status })
      .pipe(finalize(() => this.changingStatus.set(false)))
      .subscribe({
        next: () => {
          this.currentStatus.set(status);
          this.notifications.success('Estado actualizado');
        },
        error: (err: unknown) =>
          this.statusError.set(this.toMessage(err, 'No se pudo actualizar el estado.')),
      });
  }

  loadFeatures(): void {
    if (!this.id) return;
    this.loadingFeatures.set(true);
    this.featuresError.set(null);
    this.tenantsService
      .getFeatures(this.id)
      .pipe(finalize(() => this.loadingFeatures.set(false)))
      .subscribe({
        next: (features) => this.tenantFeatures.set(features),
        error: (err: unknown) =>
          this.featuresError.set(this.toMessage(err, 'No se pudieron cargar las features.')),
      });
  }

  addFeature(): void {
    const key = this.newFeatureKey.value.trim();
    if (!key || !this.id) return;
    this.addingFeature.set(true);
    this.tenantsService
      .setFeature(this.id, key, { enabled: true })
      .pipe(finalize(() => this.addingFeature.set(false)))
      .subscribe({
        next: () => {
          this.newFeatureKey.reset();
          this.loadFeatures();
        },
        error: (err: unknown) =>
          this.featuresError.set(this.toMessage(err, 'No se pudo agregar la feature.')),
      });
  }

  toggleFeature(feature: TenantFeatureDto): void {
    if (!this.id) return;
    this.togglingFeature.set(feature.featureKey);
    this.tenantsService
      .setFeature(this.id, feature.featureKey, { enabled: !feature.enabled })
      .pipe(finalize(() => this.togglingFeature.set(null)))
      .subscribe({
        next: () => this.loadFeatures(),
        error: (err: unknown) =>
          this.featuresError.set(this.toMessage(err, 'No se pudo actualizar la feature.')),
      });
  }

  loadApartmentsPage(page: number): void {
    const slug = this.tenantSlug();
    if (!slug) return;
    const tower = this.towerSearch.value.trim() || undefined;
    this.loadingApartments.set(true);
    this.apartmentsService
      .query(slug, page, 10, tower)
      .pipe(finalize(() => this.loadingApartments.set(false)))
      .subscribe({
        next: (result) => {
          this.tenantApartments.set(result.items);
          this.apartmentsPaging.set(result);
        },
        error: (err: unknown) =>
          this.apartmentsError.set(this.toMessage(err, 'No se pudieron cargar los apartamentos.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/tenants']);
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

      if (err.status === 409) {
        const message = problem?.detail ?? problem?.title ?? 'Ya existe un conjunto con ese slug.';
        this.form.controls.slug.setErrors({ server: message });
        this.error.set(message);
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar el conjunto.');
      return;
    }
    this.error.set('No se pudo guardar el conjunto.');
  }

  private mapPropertyToControl(property: string): string {
    // API property names are PascalCase; controls are camelCase.
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
