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
import { toSignal } from '@angular/core/rxjs-interop';
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
  MembershipDto,
  MEMBERSHIP_STATUS_BADGES,
  MEMBERSHIP_STATUS_LABELS,
  RESIDENT_ROLE_ID,
  ResidentRelationType,
  RoleSummaryDto,
  RESIDENT_RELATION_LABELS,
} from '../data-access/membership.models';
import { ApartmentsService } from '../../apartments/data-access/apartments.service';
import { ApartmentDto, APARTMENT_TYPE_LABELS } from '../../apartments/data-access/apartment.models';
import { UsersService } from '../../users/data-access/users.service';
import {
  USER_STATUS_BADGES,
  USER_STATUS_LABELS,
  UserListItemDto,
} from '../../users/data-access/user.models';

/** Step 1 looks the phone up; step 2 asks only for what that answer leaves open. */
type InviteStep = 'search' | 'details';
/** Whether step 2 is attaching a role to an existing account or opening a brand-new one. */
type InviteMode = 'existing' | 'new';

/** Same shape the API validator enforces on InviteMemberCommand.Phone. */
const E164 = /^\+[1-9]\d{6,14}$/;

/**
 * Invite flow, phone-first: the admin types a number, the panel searches
 * `GET /users?phone=` and only then decides what to ask. A hit means the person
 * already has an account — nothing to fill in but the role. A miss opens the rest
 * of the form.
 *
 * Step 2 is driven by the role, mirroring the API rules (InviteMemberCommandValidator):
 * only a Residente may carry an apartment (and must), an unknown phone invited as
 * Residente is pre-registered on the spot (name required, email optional), and any
 * other role on an unknown phone becomes a pending invitation sent by email
 * (email required, names ignored by the API so they are not asked for).
 */
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
  private readonly usersService = inject(UsersService);
  private readonly notifications = inject(NotificationService);

  readonly tenantSlug = this.route.snapshot.queryParamMap.get('tenant') ?? '';
  readonly tenantId = this.route.snapshot.queryParamMap.get('tenantId') ?? '';

  readonly backLink: unknown[] = ['/memberships'];
  readonly backQueryParams = { tenant: this.tenantSlug, tenantId: this.tenantId };

  // ── Step 1: phone lookup ────────────────────────────────────────────────────
  readonly step = signal<InviteStep>('search');
  readonly mode = signal<InviteMode | null>(null);

  readonly searchForm = new FormGroup({
    phone: new FormControl('', { nonNullable: true }),
  });
  private readonly searchValue = toSignal(this.searchForm.controls.phone.valueChanges, {
    initialValue: '',
  });

  /** The typed number stripped of spaces, dashes and parens — what actually gets queried. */
  readonly normalizedPhone = computed(() => normalizePhone(this.searchValue()));
  /** A brand-new user can only be invited with a full E.164 number, as the API demands. */
  readonly canInviteNew = computed(() => E164.test(this.normalizedPhone()));

  readonly searching = signal(false);
  readonly searchDone = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly matches = signal<UserListItemDto[]>([]);

  // ── Step 2: the invite itself ───────────────────────────────────────────────
  /** Phone resolved in step 1 (the picked account's, or the typed E.164 one). */
  readonly phone = signal('');
  readonly selectedUser = signal<UserListItemDto | null>(null);

  /** The membership the picked user already has here, looked up before sending anything. */
  readonly existingMembership = signal<MembershipDto | null>(null);
  readonly checkingMembership = signal(false);

  readonly form = new FormGroup({
    roleId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    apartmentId: new FormControl('', { nonNullable: true }),
    relationType: new FormControl<ResidentRelationType | ''>('', { nonNullable: true }),
    livesHere: new FormControl(false, { nonNullable: true }),
  });

  /** Current role selection, as a signal, so the template can branch on it. */
  readonly roleIdValue = toSignal(this.form.controls.roleId.valueChanges, {
    initialValue: '',
  });
  private readonly emailValue = toSignal(this.form.controls.email.valueChanges, {
    initialValue: '',
  });

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

  readonly selectedRole = computed(() =>
    this.roles().find((r) => String(r.id) === this.roleIdValue()) ?? null,
  );
  /** Apartment assignment is allowed — and required — only for the Residente role. */
  readonly isResident = computed(() => Number(this.roleIdValue()) === RESIDENT_ROLE_ID);

  /** A new Residente is pre-registered right here, so the panel needs their name. */
  readonly needsName = computed(() => this.mode() === 'new' && this.isResident());
  /** Any other new member is reached by email — the only channel for someone with no account. */
  readonly needsEmail = computed(() => this.mode() === 'new' && !this.isResident());
  /** Otherwise the email is a nice-to-have: shown only when there is none on file. */
  readonly showEmail = computed(
    () => this.mode() === 'new' || !this.selectedUser()?.email,
  );

  /** An active or invited membership already exists: the API would answer 409. */
  readonly alreadyMember = computed(() => {
    const membership = this.existingMembership();
    return !!membership && membership.status !== 'Suspended';
  });
  /** A suspended membership is readmitted into the same row with the new role. */
  readonly readmits = computed(() => this.existingMembership()?.status === 'Suspended');

  readonly roleError = computed(() => this.submitted() && !this.roleIdValue());
  readonly firstNameError = computed(
    () => this.submitted() && this.needsName() && !this.form.controls.firstName.value.trim(),
  );
  readonly emailError = computed(() => {
    if (!this.submitted()) return null;
    const value = this.emailValue().trim();
    if (this.needsEmail() && !value) return 'required';
    if (value && this.form.controls.email.hasError('email')) return 'invalid';
    return null;
  });
  readonly apartmentError = computed(
    () => this.submitted() && this.isResident() && !this.form.controls.apartmentId.value,
  );
  readonly relationError = computed(
    () => this.submitted() && this.isResident() && !this.form.controls.relationType.value,
  );

  ngOnInit(): void {
    this.loadRoles();
    if (this.tenantSlug) {
      this.loadApartments();
    }
  }

  // ── Step 1 actions ──────────────────────────────────────────────────────────

  /** Looks the typed number up. An exact, single hit skips straight to step 2. */
  onSearch(): void {
    const term = this.normalizedPhone();
    this.searchError.set(null);

    if (term.replace('+', '').length < 4) {
      this.searchError.set('Escribe al menos 4 dígitos del teléfono.');
      return;
    }

    this.searching.set(true);
    this.searchDone.set(false);
    this.matches.set([]);

    this.usersService
      .searchByPhone(term)
      .pipe(finalize(() => this.searching.set(false)))
      .subscribe({
        next: (users) => {
          this.searchDone.set(true);
          this.matches.set(users);

          // One unambiguous account: no reason to make the admin click it.
          const exact = users.filter((u) => normalizePhone(u.phone) === term);
          if (exact.length === 1) {
            this.selectUser(exact[0]);
          } else if (users.length === 1) {
            this.selectUser(users[0]);
          }
        },
        error: () => {
          this.searchDone.set(true);
          this.searchError.set('No se pudo buscar el teléfono. Intenta de nuevo.');
        },
      });
  }

  /** Picks an existing account: step 2 will only ask for the role. */
  selectUser(user: UserListItemDto): void {
    this.selectedUser.set(user);
    this.phone.set(user.phone);
    this.mode.set('existing');
    this.step.set('details');
    this.error.set(null);
    this.submitted.set(false);
    this.checkExistingMembership(user.id);
  }

  /** Nobody matched (or none of the matches is the right person): open the full form. */
  continueAsNew(): void {
    if (!this.canInviteNew()) return;
    this.selectedUser.set(null);
    this.existingMembership.set(null);
    this.phone.set(this.normalizedPhone());
    this.mode.set('new');
    this.step.set('details');
    this.error.set(null);
    this.submitted.set(false);
  }

  /** Back to the lookup, dropping whatever step 2 had collected. */
  changePhone(): void {
    this.step.set('search');
    this.mode.set(null);
    this.selectedUser.set(null);
    this.existingMembership.set(null);
    this.submitted.set(false);
    this.error.set(null);
    this.form.reset({
      roleId: '',
      firstName: '',
      lastName: '',
      email: '',
      apartmentId: '',
      relationType: '',
      livesHere: false,
    });
  }

  // ── Step 2 actions ──────────────────────────────────────────────────────────

  onSubmit(): void {
    this.submitted.set(true);
    this.form.markAllAsTouched();

    if (
      this.alreadyMember() ||
      this.roleError() ||
      this.firstNameError() ||
      this.emailError() ||
      this.apartmentError() ||
      this.relationError()
    ) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const email = raw.email.trim();

    const request: InviteMemberRequest = {
      phone: this.phone(),
      roleId: Number(raw.roleId),
      email: email || null,
    };

    // Names only matter when the panel is pre-registering the person (new Residente);
    // on every other path the API ignores them, so they are not sent.
    if (this.needsName()) {
      request.firstName = raw.firstName.trim();
      request.lastName = raw.lastName.trim() || null;
    }

    // The API rejects an apartment on any role other than Residente.
    if (this.isResident()) {
      request.apartmentId = raw.apartmentId;
      request.relationType = raw.relationType as ResidentRelationType;
      request.livesHere = raw.livesHere;
    }

    this.membershipsService
      .invite(request, this.tenantSlug)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (result) => {
          this.notifications.success(
            result?.kind === 'invitation'
              ? 'Invitación enviada por correo'
              : 'Miembro agregado al conjunto',
          );
          this.router.navigate(this.backLink, { queryParams: this.backQueryParams });
        },
        error: (err: unknown) => this.handleError(err),
      });
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  private checkExistingMembership(userId: string): void {
    if (!this.tenantSlug) return;
    this.checkingMembership.set(true);
    this.existingMembership.set(null);
    this.membershipsService
      .getByUser(this.tenantSlug, userId)
      .pipe(finalize(() => this.checkingMembership.set(false)))
      .subscribe({
        // Non-blocking: a failed pre-check just falls back to the API's 409.
        next: (membership) => this.existingMembership.set(membership),
        error: () => this.existingMembership.set(null),
      });
  }

  private loadRoles(): void {
    this.loadingRoles.set(true);
    this.membershipsService
      .listRoles('Tenant')
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
        this.error.set(
          problem?.detail ?? problem?.title ?? 'El usuario ya es miembro de este conjunto.',
        );
        return;
      }

      if (problem?.errors?.length) {
        const unmapped: string[] = [];
        for (const fieldError of problem.errors) {
          const key = fieldError.property.charAt(0).toLowerCase() + fieldError.property.slice(1);
          const control = this.form.get(key);
          if (control) {
            control.setErrors({ server: fieldError.message });
          } else {
            // e.g. `phone`, which step 1 owns and step 2 no longer renders.
            unmapped.push(fieldError.message);
          }
        }
        this.error.set(
          unmapped.join(' ') || problem.detail || problem.title || 'Revisa los campos marcados.',
        );
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo enviar la invitación.');
      return;
    }
    this.error.set('No se pudo enviar la invitación.');
  }

  // ── Display helpers ─────────────────────────────────────────────────────────

  apartmentTypeLabel(type: string): string {
    return APARTMENT_TYPE_LABELS[type as keyof typeof APARTMENT_TYPE_LABELS] ?? type;
  }

  userStatusLabel(user: UserListItemDto): string {
    return USER_STATUS_LABELS[user.status] ?? user.status;
  }

  userStatusBadge(user: UserListItemDto): string {
    return USER_STATUS_BADGES[user.status] ?? 'badge';
  }

  membershipStatusLabel(membership: MembershipDto): string {
    return MEMBERSHIP_STATUS_LABELS[membership.status] ?? membership.status;
  }

  membershipStatusBadge(membership: MembershipDto): string {
    return MEMBERSHIP_STATUS_BADGES[membership.status] ?? 'badge';
  }

  fullName(user: UserListItemDto): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }
}

/**
 * Strips the separators admins type (spaces, dashes, parens, dots) and keeps at most a
 * leading `+`, so `+57 300 123 4567` queries as `+573001234567` and a bare `3001234567`
 * still hits the stored E.164 number through the API's LIKE match.
 */
function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}
