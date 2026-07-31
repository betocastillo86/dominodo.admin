import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { AnnouncementsService } from '../data-access/announcements.service';
import { AudienceType } from '../data-access/announcement.models';
import { RequestCategoriesService } from '../../request-categories/data-access/request-categories.service';

/** Create or edit an announcement. Mode is resolved from the presence of `:id` in the route. */
@Component({
  selector: 'app-announcement-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './announcement-form.component.html',
})
export class AnnouncementFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly announcementsService = inject(AnnouncementsService);
  private readonly requestCategoriesService = inject(RequestCategoriesService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';

  readonly categories = this.requestCategoriesService.categories;

  readonly form = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    body: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    priority: new FormControl<number>(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0)],
    }),
    audienceType: new FormControl<AudienceType>('AllTenant', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    audienceFilter: new FormControl('', { nonNullable: true }),
    categoryId: new FormControl('', { nonNullable: true }),
    expiresAtUtc: new FormControl('', { nonNullable: true }),
  });

  /** Reactive signal tracking the current audience type to drive conditional visibility. */
  readonly audienceTypeValue = toSignal(
    this.form.controls.audienceType.valueChanges,
    { initialValue: this.form.controls.audienceType.value },
  );

  /** audienceFilter is only relevant when the audience is scoped (not AllTenant). */
  readonly showAudienceFilter = computed(() => this.audienceTypeValue() !== 'AllTenant');

  readonly audienceFilterLabel = computed(() =>
    this.audienceTypeValue() === 'ByTower' ? 'ID de torre' : 'IDs de apartamentos',
  );

  readonly loadingDetail = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly loading = computed(() => this.loadingDetail());

  ngOnInit(): void {
    this.requestCategoriesService.list(1, 200);

    if (this.mode === 'edit') {
      this.loadDetail(this.id!);
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
    const requestBody = {
      title: raw.title.trim(),
      body: raw.body.trim(),
      priority: raw.priority,
      audienceType: raw.audienceType,
      audienceFilter: raw.audienceFilter.trim() || null,
      categoryId: raw.categoryId || null,
      expiresAtUtc: raw.expiresAtUtc ? raw.expiresAtUtc + ':00.000Z' : null,
    };

    if (this.mode === 'create') {
      this.announcementsService
        .create(requestBody)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Anuncio creado'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.announcementsService
        .update(this.id!, requestBody)
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Anuncio actualizado'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private loadDetail(id: string): void {
    this.loadingDetail.set(true);
    this.announcementsService
      .getById(id)
      .pipe(finalize(() => this.loadingDetail.set(false)))
      .subscribe({
        next: (detail) => {
          this.form.patchValue({
            title: detail.title,
            body: detail.body,
            priority: detail.priority,
            audienceType: detail.audienceType,
            audienceFilter: detail.audienceFilter ?? '',
            categoryId: detail.categoryId ?? '',
            expiresAtUtc: detail.expiresAtUtc ? detail.expiresAtUtc.slice(0, 16) : '',
          });
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudo cargar el anuncio.')),
      });
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/announcements']);
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
        const message = problem?.detail ?? problem?.title ?? 'Ya existe un anuncio con ese título.';
        this.form.controls.title.setErrors({ server: message });
        this.error.set(message);
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar el anuncio.');
      return;
    }
    this.error.set('No se pudo guardar el anuncio.');
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
