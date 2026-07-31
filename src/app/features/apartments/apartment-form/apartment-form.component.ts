import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { ApartmentsService } from '../data-access/apartments.service';
import { ApartmentType, RESIDENT_RELATION_LABELS, ResidentDto } from '../data-access/apartment.models';

/** Create or edit an apartment. Requires ?tenant=<slug> query param for tenant context. */
@Component({
  selector: 'app-apartment-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SpinnerComponent, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './apartment-form.component.html',
})
export class ApartmentFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';

  /** Tenant slug passed via ?tenant= query param. Required by all apartment API calls. */
  readonly tenantSlug = this.route.snapshot.queryParamMap.get('tenant') ?? '';
  /** Tenant id passed via ?tenantId=; used to return to the tenant edit page. */
  private readonly tenantId = this.route.snapshot.queryParamMap.get('tenantId') ?? '';

  /** Route back to the originating tenant (or the tenant list as a fallback). */
  readonly backLink: unknown[] = this.tenantId ? ['/tenants', this.tenantId, 'edit'] : ['/tenants'];

  readonly form = new FormGroup({
    number: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(20)],
    }),
    type: new FormControl<ApartmentType>('Apartment', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    tower: new FormControl('', { nonNullable: true }),
    attributes: new FormControl('', { nonNullable: true }),
  });

  readonly loadingDetail = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly loading = this.loadingDetail;

  // Residents section (edit mode only).
  readonly residents = signal<ResidentDto[]>([]);
  readonly loadingResidents = signal(false);
  readonly residentsError = signal<string | null>(null);

  readonly residentColumns: readonly TableColumn<ResidentDto>[] = [
    { header: 'Nombre', value: (r) => r.user?.fullName ?? '—' },
    { header: 'Teléfono', value: (r) => r.user?.phone ?? '—' },
    {
      header: 'Relación',
      value: (r) => RESIDENT_RELATION_LABELS[r.relationType] ?? r.relationType,
      badgeClass: (r) => (r.relationType === 'Owner' ? 'badge bg-purple-lt' : 'badge bg-azure-lt'),
    },
    { header: 'Reside aquí', value: (r) => (r.livesHere ? 'Sí' : 'No') },
    { header: 'Inicio', value: (r) => r.startDate ?? '—' },
    { header: 'Fin', value: (r) => r.endDate ?? '—' },
    {
      header: 'Estado',
      value: (r) => (r.isActive ? 'Activo' : 'Finalizado'),
      badgeClass: (r) => (r.isActive ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
  ];

  readonly residentRowKey = (r: ResidentDto): string => r.id;

  ngOnInit(): void {
    if (this.mode === 'edit' && this.tenantSlug) {
      this.loadApartment(this.id!);
      this.loadResidents(this.id!);
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
    const number = raw.number.trim();
    const tower = raw.tower.trim() || null;
    const attributes = raw.attributes.trim() || null;
    const type = raw.type;

    if (this.mode === 'create') {
      this.apartmentsService
        .create({ number, type, tower, attributes }, this.tenantSlug)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Apartamento creado'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.apartmentsService
        .update(this.id!, { number, type, tower, attributes }, this.tenantSlug)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Apartamento actualizado'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private loadApartment(id: string): void {
    this.loadingDetail.set(true);
    this.apartmentsService
      .getById(id, this.tenantSlug)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (apt) => {
          this.form.patchValue({
            number: apt.number,
            type: apt.type,
            tower: apt.tower ?? '',
            attributes: apt.attributes ?? '',
          });
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudo cargar el apartamento.')),
      });
  }

  private loadResidents(id: string): void {
    this.loadingResidents.set(true);
    this.apartmentsService
      .getResidents(id, this.tenantSlug)
      .pipe(finalize(() => this.loadingResidents.set(false)))
      .subscribe({
        next: (residents) => this.residents.set(residents),
        error: (err: unknown) =>
          this.residentsError.set(this.toMessage(err, 'No se pudieron cargar los residentes.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(this.backLink);
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
        const message =
          problem?.detail ?? problem?.title ?? 'Ya existe un apartamento con ese número.';
        this.form.controls.number.setErrors({ server: message });
        this.error.set(message);
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar el apartamento.');
      return;
    }
    this.error.set('No se pudo guardar el apartamento.');
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
