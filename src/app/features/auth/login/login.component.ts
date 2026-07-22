import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TablerIconComponent } from 'angular-tabler-icons';
import { AuthService } from '../../../core/auth/auth.service';
import { ProblemDetails } from '../../../core/http/problem-details';

/** Public sign-in screen. Restricted to SuperAdmin by `AuthService.login`. */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly pending = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    phone: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid || this.pending()) {
      this.form.markAllAsTouched();
      return;
    }

    this.pending.set(true);
    this.errorMessage.set(null);

    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.pending.set(false);
        void this.router.navigate(['/roles']);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.errorMessage.set(this.toMessage(error));
      },
    });
  }

  private toMessage(error: unknown): string {
    // Invalid credentials (HTTP): surface the API ProblemDetails detail.
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? 'No se pudo iniciar sesión. Verifica tus credenciales.';
    }
    // Client-side SuperAdmin rejection throws a plain Error ("Acceso no autorizado").
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'No se pudo iniciar sesión. Verifica tus credenciales.';
  }
}
