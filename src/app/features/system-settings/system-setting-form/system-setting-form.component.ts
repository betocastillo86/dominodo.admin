import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { SystemSettingsService } from '../data-access/system-settings.service';
import { SystemSettingValueType } from '../data-access/system-setting.models';

/** Requires the value to parse as JSON. */
const jsonValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as string;
  if (!value) return null;
  try {
    JSON.parse(value);
    return null;
  } catch {
    return { json: true };
  }
};

/** Create or edit a system setting. Mode is resolved from the presence of `:key` in the route. */
@Component({
  selector: 'app-system-setting-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    SpinnerComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './system-setting-form.component.html',
})
export class SystemSettingFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly settingsService = inject(SystemSettingsService);
  private readonly notifications = inject(NotificationService);

  private readonly key = this.route.snapshot.paramMap.get('key');
  readonly mode: 'create' | 'edit' = this.key ? 'edit' : 'create';

  readonly form = new FormGroup({
    key: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    valueType: new FormControl<SystemSettingValueType>('String', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    value: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /** Mirrors the valueType control so the template can `@switch` on the current type. */
  readonly valueType = signal<SystemSettingValueType>('String');

  readonly loadingDetail = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  ngOnInit(): void {
    this.form.controls.valueType.valueChanges.subscribe((vt) => this.onValueTypeChange(vt));

    if (this.mode === 'edit') {
      this.form.controls.key.disable();
      this.loadSetting(this.key!);
    }
  }

  /** Reacts to a `Bool` checkbox toggle, writing the string 'true'/'false' into the value control. */
  onBoolChange(checked: boolean): void {
    this.form.controls.value.setValue(checked ? 'true' : 'false');
  }

  get isBoolChecked(): boolean {
    return this.form.controls.value.value === 'true';
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
    const value = raw.value.trim();
    const valueType = raw.valueType;

    if (this.mode === 'create') {
      this.settingsService
        .create({ key: raw.key.trim(), value, valueType })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Configuración creada'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.settingsService
        .update(this.key!, { value, valueType })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Configuración actualizada'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private onValueTypeChange(valueType: SystemSettingValueType): void {
    this.valueType.set(valueType);

    const value = this.form.controls.value;
    const validators: ValidatorFn[] = [Validators.required];
    switch (valueType) {
      case 'Int':
        validators.push(Validators.pattern(/^-?\d+$/));
        break;
      case 'Bool':
        validators.push(Validators.pattern(/^(true|false)$/));
        if (value.value !== 'true' && value.value !== 'false') {
          value.setValue('false');
        }
        break;
      case 'Json':
        validators.push(jsonValidator);
        break;
    }
    value.setValidators(validators);
    value.updateValueAndValidity();
  }

  private loadSetting(key: string): void {
    this.loadingDetail.set(true);
    this.settingsService
      .getByKey(key)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (setting) => {
          const valueType = this.normalizeValueType(setting.valueType);
          this.form.patchValue({
            key: setting.key,
            valueType,
            value: setting.value,
          });
        },
        error: (err: unknown) => this.error.set(this.toMessage(err, 'No se pudo cargar la configuración.')),
      });
  }

  private normalizeValueType(valueType: string): SystemSettingValueType {
    const allowed: SystemSettingValueType[] = ['String', 'Int', 'Bool', 'Json'];
    return allowed.includes(valueType as SystemSettingValueType)
      ? (valueType as SystemSettingValueType)
      : 'String';
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/system-settings']);
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
        const message = problem?.detail ?? problem?.title ?? 'Ya existe una configuración con esa key.';
        this.form.controls.key.setErrors({ server: message });
        this.error.set(message);
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar la configuración.');
      return;
    }
    this.error.set('No se pudo guardar la configuración.');
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
