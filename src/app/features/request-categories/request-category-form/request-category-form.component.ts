import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { RequestCategoriesService } from '../data-access/request-categories.service';

/** Create or edit a request category. Mode is resolved from the presence of `:id` in the route. */
@Component({
  selector: 'app-request-category-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-category-form.component.html',
})
export class RequestCategoryFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(RequestCategoriesService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';

  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  readonly loadingDetail = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.mode === 'edit') {
      this.form.controls.code.disable();
      this.loadCategory(this.id!);
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
    const name = raw.name.trim();
    const description = raw.description.trim() || null;

    if (this.mode === 'create') {
      this.service
        .create({ code: raw.code.trim(), name, description, isActive: raw.isActive })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Categoría creada'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.service
        .update(this.id!, { name, description, isActive: raw.isActive })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Categoría actualizada'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private loadCategory(id: string): void {
    this.loadingDetail.set(true);
    this.service
      .getById(id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (cat) => {
          this.form.patchValue({
            code: cat.code,
            name: cat.name,
            description: cat.description ?? '',
            isActive: cat.isActive,
          });
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudo cargar la categoría.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/request-categories']);
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
          problem?.detail ?? problem?.title ?? 'Ya existe una categoría con ese código.';
        if (this.mode === 'create') {
          this.form.controls.code.setErrors({ server: message });
        } else {
          this.form.controls.name.setErrors({ server: message });
        }
        this.error.set(message);
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar la categoría.');
      return;
    }
    this.error.set('No se pudo guardar la categoría.');
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
