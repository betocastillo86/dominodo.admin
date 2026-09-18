import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TablerIconComponent } from 'angular-tabler-icons';
import { AuthService } from '../../../core/auth/auth.service';
import { HealthService } from '../../../core/health/health.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { ServiceStatusComponent } from '../../../shared/ui/service-status/service-status.component';

/**
 * Public sign-in screen. Restricted to SuperAdmin by `AuthService.login`.
 *
 * It carries the same service status the dashboard shows, reduced to name + state: when the API is
 * asleep nobody gets past this screen, so this is where knowing it — and waiting for the probes to
 * wake it up — actually helps. The dashboard keeps the detail.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TablerIconComponent, ServiceStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly health = inject(HealthService);

  /** Name + state of each back end, polled while this screen is open. */
  readonly services = this.health.snapshot;

  readonly pending = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    phone: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  constructor() {
    this.health.start();
    inject(DestroyRef).onDestroy(() => this.health.stop());
  }

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
        void this.router.navigate(['/dashboard']);
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
