import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { TenantsService } from '../../tenants/data-access/tenants.service';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import { KnowledgeResourcesService } from '../data-access/knowledge-resources.service';
import { KnowledgeResourceStatus } from '../data-access/knowledge-resource.models';

/**
 * Create or edit a knowledge resource. Mode is resolved from the presence of `:id` in the route.
 *
 * Reads/writes are tenant-scoped (the API needs an `X-Tenant` slug), so:
 * - **create**: the user picks a conjunto; its slug is resolved from the loaded catalog.
 * - **edit**: the `tenantId` arrives as a query param (set by the list's edit link) and its
 *   slug is resolved via `TenantsService.getById`. The conjunto is immutable on edit.
 */
@Component({
  selector: 'app-knowledge-resource-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './knowledge-resource-form.component.html',
})
export class KnowledgeResourceFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly resourcesService = inject(KnowledgeResourcesService);
  private readonly tenantsService = inject(TenantsService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  /** On edit, the list passes the resource's tenant so we can resolve its slug. */
  private readonly tenantIdParam = this.route.snapshot.queryParamMap.get('tenantId');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';

  /** Resolved tenant slug used for the `X-Tenant` header on every read/write. */
  private readonly tenantSlug = signal<string | null>(null);

  /** Tenant catalog for the create-mode selector. */
  readonly tenants = signal<TenantDto[]>([]);
  /** Tenant name shown (read-only) in edit mode. */
  readonly tenantName = signal<string | null>(null);

  readonly form = new FormGroup({
    tenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    category: new FormControl('', { nonNullable: true }),
    // Only used in edit mode; create always yields a Draft.
    status: new FormControl<KnowledgeResourceStatus>('Draft', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  readonly loadingDetail = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly loading = computed(() => this.loadingDetail());

  ngOnInit(): void {
    if (this.mode === 'edit') {
      // Tenant is fixed on edit — the select is not shown.
      this.form.controls.tenantId.disable();
      this.loadForEdit();
    } else {
      this.loadTenants();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();

    if (this.mode === 'create') {
      const slug = this.tenants().find((t) => t.id === raw.tenantId)?.slug;
      if (!slug) {
        this.error.set('Selecciona un conjunto válido.');
        return;
      }
      this.saving.set(true);
      this.error.set(null);
      this.resourcesService
        .create(
          {
            title: raw.title.trim(),
            body: raw.body.trim(),
            category: raw.category.trim() || null,
          },
          slug,
        )
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Recurso creado'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      const slug = this.tenantSlug();
      if (!slug) {
        this.error.set('No se pudo determinar el conjunto de este recurso.');
        return;
      }
      this.saving.set(true);
      this.error.set(null);
      this.resourcesService
        .update(
          this.id!,
          {
            title: raw.title.trim(),
            body: raw.body.trim(),
            category: raw.category.trim() || null,
            status: raw.status,
          },
          slug,
        )
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Recurso actualizado'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private loadTenants(): void {
    this.resourcesService.listTenants().subscribe({
      next: (tenants) => this.tenants.set(tenants),
      error: (err: unknown) =>
        this.error.set(this.toMessage(err, 'No se pudieron cargar los conjuntos.')),
    });
  }

  private loadForEdit(): void {
    if (!this.tenantIdParam) {
      this.error.set('No se pudo determinar el conjunto de este recurso.');
      return;
    }

    this.loadingDetail.set(true);
    this.tenantsService.getById(this.tenantIdParam).subscribe({
      next: (tenant) => {
        this.tenantSlug.set(tenant.slug);
        this.tenantName.set(tenant.name);
        this.form.controls.tenantId.setValue(tenant.id);
        this.loadDetail(tenant.slug);
      },
      error: (err: unknown) => {
        this.loadingDetail.set(false);
        this.error.set(this.toMessage(err, 'No se pudo cargar el conjunto del recurso.'));
      },
    });
  }

  private loadDetail(slug: string): void {
    this.resourcesService
      .getById(this.id!, slug)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => {
          this.form.patchValue({
            title: detail.title,
            body: detail.body,
            category: detail.category ?? '',
            status: detail.status,
          });
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudo cargar el recurso.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/knowledge-resources']);
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
        const message = problem?.detail ?? problem?.title ?? 'Ya existe un recurso con ese título.';
        this.form.controls.title.setErrors({ server: message });
        this.error.set(message);
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar el recurso.');
      return;
    }
    this.error.set('No se pudo guardar el recurso.');
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
