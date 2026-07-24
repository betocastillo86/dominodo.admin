import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { MembershipsService } from '../data-access/memberships.service';
import {
  InviteMemberRequest,
  ResidentRelationType,
  RoleSummaryDto,
  RESIDENT_RELATION_LABELS,
} from '../data-access/membership.models';
import { ApartmentsService } from '../../apartments/data-access/apartments.service';
import { ApartmentDto, APARTMENT_TYPE_LABELS } from '../../apartments/data-access/apartment.models';

@Component({
  selector: 'app-membership-invite',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PageHeaderComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './membership-invite.component.html',
})
export class MembershipInviteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly membershipsService = inject(MembershipsService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly notifications = inject(NotificationService);

  readonly tenantSlug = this.route.snapshot.queryParamMap.get('tenant') ?? '';
  readonly tenantId = this.route.snapshot.queryParamMap.get('tenantId') ?? '';

  readonly backLink: unknown[] = ['/memberships'];
  readonly backQueryParams = { tenant: this.tenantSlug, tenantId: this.tenantId };

  readonly form = new FormGroup({
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(30)],
    }),
    roleId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    email: new FormControl('', { nonNullable: true }),
    apartmentId: new FormControl('', { nonNullable: true }),
    relationType: new FormControl<ResidentRelationType | ''>('', { nonNullable: true }),
    livesHere: new FormControl(false, { nonNullable: true }),
  });

  readonly showApartment = signal(false);
  readonly submitted = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly roles = signal<RoleSummaryDto[]>([]);
  readonly loadingRoles = signal(false);

  readonly apartments = signal<ApartmentDto[]>([]);
  readonly loadingApartments = signal(false);

  readonly relationTypeOptions: { value: ResidentRelationType; label: string }[] = [
    { value: 'Owner', label: RESIDENT_RELATION_LABELS['Owner'] },
    { value: 'Renter', label: RESIDENT_RELATION_LABELS['Renter'] },
  ];

  readonly hasApartmentErrors = computed(
    () =>
      this.submitted() &&
      this.showApartment() &&
      !this.form.controls.apartmentId.value,
  );
  readonly hasRelationErrors = computed(
    () =>
      this.submitted() &&
      this.showApartment() &&
      !this.form.controls.relationType.value,
  );

  readonly apartmentLabel = computed(() => {
    const id = this.form.controls.apartmentId.value;
    const apt = this.apartments().find((a) => a.id === id);
    if (!apt) return '';
    return apt.tower ? `${apt.tower} – ${apt.number}` : apt.number;
  });

  ngOnInit(): void {
    this.loadRoles();
    if (this.tenantSlug) {
      this.loadApartments();
    }
  }

  toggleApartment(): void {
    const next = !this.showApartment();
    this.showApartment.set(next);
    if (!next) {
      this.form.controls.apartmentId.setValue('');
      this.form.controls.relationType.setValue('');
      this.form.controls.livesHere.setValue(false);
    }
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();

    const apartmentValid =
      !this.showApartment() ||
      (!!this.form.controls.apartmentId.value && !!this.form.controls.relationType.value);

    if (this.form.controls.phone.invalid || this.form.controls.roleId.invalid || !apartmentValid) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();

    const request: InviteMemberRequest = {
      phone: raw.phone.trim(),
      roleId: Number(raw.roleId),
      email: raw.email.trim() || null,
    };

    if (this.showApartment() && raw.apartmentId && raw.relationType) {
      request.apartmentId = raw.apartmentId;
      request.relationType = raw.relationType as ResidentRelationType;
      request.livesHere = raw.livesHere;
    }

    this.membershipsService
      .invite(request, this.tenantSlug)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Invitación enviada');
          this.router.navigate(this.backLink, { queryParams: this.backQueryParams });
        },
        error: (err: unknown) => this.handleError(err),
      });
  }

  private loadRoles(): void {
    this.loadingRoles.set(true);
    this.membershipsService
      .listRoles()
      .pipe(finalize(() => this.loadingRoles.set(false)))
      .subscribe({
        next: (roles) => this.roles.set(roles),
        error: () => this.error.set('No se pudieron cargar los roles.'),
      });
  }

  private loadApartments(): void {
    this.loadingApartments.set(true);
    this.apartmentsService
      .query(this.tenantSlug, 1, 200)
      .pipe(finalize(() => this.loadingApartments.set(false)))
      .subscribe({
        next: (result) => this.apartments.set(result.items),
        error: () => { /* non-blocking: apartment dropdown just stays empty */ },
      });
  }

  private handleError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const problem = err.error as ProblemDetails | undefined;

      if (err.status === 409) {
        const message =
          problem?.detail ?? problem?.title ?? 'El usuario ya es miembro de este conjunto.';
        this.error.set(message);
        return;
      }

      if (err.status === 404) {
        const message = problem?.detail ?? problem?.title ?? 'Usuario no encontrado.';
        this.form.controls.phone.setErrors({ server: message });
        this.error.set(message);
        return;
      }

      if (problem?.errors?.length) {
        for (const fieldError of problem.errors) {
          const key = fieldError.property.charAt(0).toLowerCase() + fieldError.property.slice(1);
          const control = this.form.get(key);
          control?.setErrors({ server: fieldError.message });
        }
        this.error.set(problem.detail ?? problem.title ?? 'Revisa los campos marcados.');
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo enviar la invitación.');
      return;
    }
    this.error.set('No se pudo enviar la invitación.');
  }

  apartmentTypeLabel(type: string): string {
    return APARTMENT_TYPE_LABELS[type as keyof typeof APARTMENT_TYPE_LABELS] ?? type;
  }
}
