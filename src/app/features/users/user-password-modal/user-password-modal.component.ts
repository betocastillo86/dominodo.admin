import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs';
import { ProblemDetails } from '../../../core/http/problem-details';
import { UsersService } from '../data-access/users.service';

/** Both fields must carry the same value; flagged on the group, not on either control. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  return password && confirmation && password !== confirmation ? { mismatch: true } : null;
}

/**
 * Sets a new password for another user, without proving the current one. Opened from the user
 * detail; the opener passes the target through `componentInstance` and reports the success.
 * Closes with no value on success, and is dismissed on cancel.
 */
@Component({
  selector: 'app-user-password-modal',
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-password-modal.component.html',
})
export class UserPasswordModalComponent {
  readonly activeModal = inject(NgbActiveModal);
  private readonly usersService = inject(UsersService);

  /** Target user. Both are set by the opener through `componentInstance`. */
  userId = '';
  /** Full name, shown so the operator can see whose credential they are replacing. */
  userName = '';

  /** Mirrors the API's own rules (SetUserPasswordCommandValidator) so a typo fails here first. */
  readonly form = new FormGroup(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(128),
          Validators.pattern(/(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])/),
        ],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatch },
  );

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.usersService
      .setPassword(this.userId, { newPassword: this.form.controls.password.value })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.activeModal.close(),
        error: (err: unknown) => this.error.set(this.toMessage(err)),
      });
  }

  private toMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const problem = err.error as ProblemDetails | undefined;

      if (err.status === 403) {
        return 'No tenés permiso para cambiar la contraseña de este usuario.';
      }
      if (problem?.errors?.length) {
        return problem.errors.map((e) => e.message).join(' ');
      }
      return problem?.detail ?? problem?.title ?? 'No se pudo cambiar la contraseña.';
    }
    return 'No se pudo cambiar la contraseña.';
  }
}
