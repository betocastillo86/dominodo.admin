import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { QuillEditorComponent } from 'ngx-quill';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { NotificationTemplatesService } from '../data-access/notification-templates.service';
import {
  AdminNotificationParameterDto,
  AdminNotificationType,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
} from '../data-access/notification-template.models';

/** Edit a notification template. The API exposes no create, so this is edit-only. */
@Component({
  selector: 'app-notification-template-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    SpinnerComponent,
    TablerIconComponent,
    QuillEditorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './notification-template-form.component.html',
})
export class NotificationTemplateFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templatesService = inject(NotificationTemplatesService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;

  /** `localization` is read-only but part of the PUT body; kept to re-send unchanged. */
  private loadedLocalization: string | null = null;

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', { nonNullable: true }),
    // Immutable / read-only fields (disabled in ngOnInit, shown for context).
    type: new FormControl<AdminNotificationType | ''>('', { nonNullable: true }),
    localization: new FormControl('', { nonNullable: true }),
    // Channel toggles.
    emailEnabled: new FormControl(false, { nonNullable: true }),
    pushEnabled: new FormControl(false, { nonNullable: true }),
    inAppEnabled: new FormControl(false, { nonNullable: true }),
    // Channel content.
    emailSubject: new FormControl('', { nonNullable: true }),
    emailBodyHtml: new FormControl('', { nonNullable: true }),
    inAppText: new FormControl('', { nonNullable: true }),
    pushText: new FormControl('', { nonNullable: true }),
    // Global state.
    isActive: new FormControl(false, { nonNullable: true }),
  });

  readonly typeLabels = NOTIFICATION_TYPE_LABELS;
  readonly types = NOTIFICATION_TYPES;
  /** Placeholders available for this template's channel content. Informative only. */
  readonly parameters = signal<AdminNotificationParameterDto[]>([]);
  readonly loadingDetail = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly submitted = signal(false);

  ngOnInit(): void {
    this.form.controls.type.disable();
    this.form.controls.localization.disable();
    this.loadTemplate();
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

    this.templatesService
      .update(this.id, {
        name: raw.name.trim(),
        description: raw.description.trim() || null,
        emailEnabled: raw.emailEnabled,
        pushEnabled: raw.pushEnabled,
        inAppEnabled: raw.inAppEnabled,
        emailSubject: raw.emailEnabled ? raw.emailSubject.trim() || null : null,
        emailBodyHtml: raw.emailEnabled ? raw.emailBodyHtml || null : null,
        inAppText: raw.inAppEnabled ? raw.inAppText.trim() || null : null,
        pushText: raw.pushEnabled ? raw.pushText.trim() || null : null,
        isActive: raw.isActive,
        localization: this.loadedLocalization,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.onSuccess('Plantilla actualizada'),
        error: (err: unknown) => this.handleError(err),
      });
  }

  private loadTemplate(): void {
    this.loadingDetail.set(true);
    this.templatesService
      .getById(this.id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (template) => {
          this.loadedLocalization = template.localization ?? null;
          this.parameters.set(template.parameters ?? []);
          this.form.patchValue({
            name: template.name,
            description: template.description ?? '',
            type: template.type,
            localization: template.localization ?? '',
            emailEnabled: template.emailEnabled,
            pushEnabled: template.pushEnabled,
            inAppEnabled: template.inAppEnabled,
            emailSubject: template.emailSubject ?? '',
            emailBodyHtml: template.emailBodyHtml ?? '',
            inAppText: template.inAppText ?? '',
            pushText: template.pushText ?? '',
            isActive: template.isActive,
          });
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudo cargar la plantilla.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/notification-templates']);
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

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar la plantilla.');
      return;
    }
    this.error.set('No se pudo guardar la plantilla.');
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
