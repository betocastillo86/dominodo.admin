import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { UsersService } from '../data-access/users.service';

/** Create or edit a user. Mode is resolved from the presence of `:id` in the route. */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SpinnerComponent, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';

  readonly form = new FormGroup({
    /** Immutable after creation — disabled in edit mode. */
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\+[1-9]\d{6,14}$/)],
    }),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    /** Optional; immutable in edit mode per panel policy. */
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    /** Only sent on create — not present in UpdateUserRequest. */
    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(128),
        Validators.pattern(/(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])/),
      ],
    }),
  });

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (this.mode === 'edit') {
      this.form.controls.phone.disable();
      this.form.controls.email.disable();
      this.form.controls.password.disable();
      this.loadUser(this.id!);
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
      this.usersService
        .create({
          phone: raw.phone.trim(),
          firstName: raw.firstName.trim(),
          lastName: raw.lastName.trim(),
          email: raw.email.trim() || null,
          password: raw.password,
        })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Usuario creado'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.usersService
        .update(this.id!, {
          firstName: raw.firstName.trim(),
          lastName: raw.lastName.trim(),
          email: raw.email.trim() || null,
          preferredLanguage: '',
        })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Usuario actualizado'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private loadUser(id: string): void {
    this.loading.set(true);
    this.usersService
      .getById(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (user) => {
          this.form.patchValue({
            phone: user.phone,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email ?? '',
          });
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudo cargar el usuario.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/users']);
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
        this.error.set(problem?.detail ?? problem?.title ?? 'El teléfono o email ya está registrado.');
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar el usuario.');
      return;
    }
    this.error.set('No se pudo guardar el usuario.');
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
