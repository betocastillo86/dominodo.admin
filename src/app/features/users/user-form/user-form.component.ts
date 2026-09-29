import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { UsersService } from '../data-access/users.service';
import {
  UserMembershipRow,
  UserRequestRow,
  UserResidencyRow,
  UserStatus,
} from '../data-access/user.models';
import { MembershipsService } from '../../memberships/data-access/memberships.service';
import {
  MEMBERSHIP_STATUS_BADGES,
  MEMBERSHIP_STATUS_LABELS,
} from '../../memberships/data-access/membership.models';
import { TenantsService } from '../../tenants/data-access/tenants.service';
import { TenantDto } from '../../tenants/data-access/tenant.models';
import { ApartmentsService } from '../../apartments/data-access/apartments.service';
import {
  APARTMENT_TYPE_LABELS,
  RESIDENT_RELATION_LABELS,
} from '../../apartments/data-access/apartment.models';
import { RequestsService } from '../../requests/data-access/requests.service';
import {
  REQUEST_PRIORITY_BADGES,
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_BADGES,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  RequestDto,
  RequestPriority,
  RequestStatus,
  RequestType,
} from '../../requests/data-access/request.models';

/** Create or edit a user. Mode is resolved from the presence of `:id` in the route. */
@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    SpinnerComponent,
    DataTableComponent,
    TablerIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly membershipsService = inject(MembershipsService);
  private readonly tenantsService = inject(TenantsService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly requestsService = inject(RequestsService);
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
    /** Optional; editable in both create and edit mode. */
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

  readonly userStatus = signal<UserStatus | null>(null);
  readonly userPhone = signal<string>('');

  readonly otpRequested = signal(false);
  readonly otpSending = signal(false);
  readonly otpConfirming = signal(false);
  readonly otpError = signal<string | null>(null);
  readonly otpCode = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(4)] });

  // Memberships, residencies and requests sections (edit mode only): cross-tenant views of the
  // same person. Memberships and requests come straight from the API's userId filters;
  // residencies are stitched together per conjunto because those endpoints are tenant-scoped.
  // All three name their conjunto from this catalog, fetched once.
  private readonly tenantsById = signal<Map<string, TenantDto>>(new Map());

  readonly memberships = signal<UserMembershipRow[]>([]);
  readonly loadingMemberships = signal(false);
  readonly membershipsError = signal<string | null>(null);

  readonly residencies = signal<UserResidencyRow[]>([]);
  readonly loadingResidencies = signal(false);
  readonly residenciesError = signal<string | null>(null);
  /** Conjuntos scanned for residencies — kept so the section can be reloaded after a delete. */
  private readonly residencyTenants = signal<TenantDto[]>([]);
  /** Id of the residency being deleted, so the table can lock just that row. */
  readonly deletingResidency = signal<string | null>(null);
  /** Kept apart from `residenciesError` so a failed delete does not hide the table. */
  readonly residencyDeleteError = signal<string | null>(null);

  readonly requests = signal<UserRequestRow[]>([]);
  readonly loadingRequests = signal(false);
  readonly requestsError = signal<string | null>(null);
  /** True when the API had more requests than the cap this section fetches. */
  readonly requestsTruncated = signal(false);

  readonly membershipColumns: readonly TableColumn<UserMembershipRow>[] = [
    { header: 'Conjunto', value: (m) => m.tenantName },
    { header: 'Rol', value: (m) => m.roleName, badgeClass: () => 'badge bg-blue-lt' },
    {
      header: 'Estado',
      value: (m) => MEMBERSHIP_STATUS_LABELS[m.status] ?? m.status,
      badgeClass: (m) => MEMBERSHIP_STATUS_BADGES[m.status] ?? 'badge',
    },
    {
      header: 'Invitado',
      value: (m) => (m.invitedAtUtc ? new Date(m.invitedAtUtc).toLocaleDateString('es') : '—'),
    },
    {
      header: 'Se unió',
      value: (m) => (m.joinedAtUtc ? new Date(m.joinedAtUtc).toLocaleDateString('es') : '—'),
    },
  ];

  readonly residencyColumns: readonly TableColumn<UserResidencyRow>[] = [
    { header: 'Conjunto', value: (r) => r.tenantName },
    {
      header: 'Inmueble',
      value: (r) => (r.apartment.tower ? `${r.apartment.tower} - ${r.apartment.number}` : r.apartment.number),
    },
    { header: 'Tipo', value: (r) => APARTMENT_TYPE_LABELS[r.apartment.type] ?? r.apartment.type },
    {
      header: 'Relación',
      value: (r) => RESIDENT_RELATION_LABELS[r.relationType] ?? r.relationType,
      badgeClass: (r) => (r.relationType === 'Owner' ? 'badge bg-purple-lt' : 'badge bg-azure-lt'),
    },
    { header: 'Reside aquí', value: (r) => (r.livesHere ? 'Sí' : 'No') },
    { header: 'Inicio', value: (r) => r.startDate ?? '—' },
    { header: 'Fin', value: (r) => r.endDate ?? '—' },
    {
      header: 'Estado',
      value: (r) => (r.isActive ? 'Activo' : 'Finalizado'),
      badgeClass: (r) => (r.isActive ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
  ];

  readonly requestColumns: readonly TableColumn<UserRequestRow>[] = [
    { header: 'Código', value: (r) => r.code, class: 'text-secondary w-1' },
    { header: 'Conjunto', value: (r) => r.tenantName, class: 'text-nowrap' },
    { header: 'Título', value: (r) => r.title, truncate: true },
    { header: 'Participación', value: (r) => r.involvement, class: 'text-nowrap' },
    { header: 'Tipo', value: (r) => REQUEST_TYPE_LABELS[r.type as RequestType] ?? r.type },
    {
      header: 'Estado',
      value: (r) => REQUEST_STATUS_LABELS[r.status as RequestStatus] ?? r.status,
      badgeClass: (r) => REQUEST_STATUS_BADGES[r.status] ?? 'badge',
    },
    {
      header: 'Prioridad',
      value: (r) => REQUEST_PRIORITY_LABELS[r.priority as RequestPriority] ?? r.priority,
      badgeClass: (r) => REQUEST_PRIORITY_BADGES[r.priority] ?? 'badge',
    },
    {
      header: 'Registro',
      value: (r) => new Date(r.createdAtUtc).toLocaleDateString('es'),
      class: 'text-secondary text-nowrap',
    },
  ];

  readonly membershipRowKey = (m: UserMembershipRow): string => `${m.tenantId}:${m.userId}`;
  readonly residencyRowKey = (r: UserResidencyRow): string => r.id;
  readonly requestRowKey = (r: UserRequestRow): string => r.id;

  /** Opens the conjunto's memberships page, which needs both the slug and the id. */
  readonly membershipLink = (): unknown[] => ['/memberships'];
  readonly membershipQueryParams = (m: UserMembershipRow): Record<string, string> => ({
    tenant: m.tenantSlug,
    tenantId: m.tenantId,
  });

  readonly residencyLink = (r: UserResidencyRow): unknown[] => ['/apartments', r.apartmentId, 'edit'];
  readonly residencyQueryParams = (r: UserResidencyRow): Record<string, string> => ({
    tenant: r.tenantSlug,
    tenantId: r.apartment.tenantId,
  });

  readonly requestLink = (r: UserRequestRow): unknown[] => ['/requests', r.id, 'edit'];
  readonly requestQueryParams = (r: UserRequestRow): Record<string, string> => ({
    tenantId: r.tenantId,
  });

  /** Bound to the table's destructive action; the table asks for confirmation first. */
  readonly removeResidency = (residency: UserResidencyRow): void => {
    this.residencyDeleteError.set(null);
    this.deletingResidency.set(residency.id);
    this.apartmentsService
      .removeResident(residency.apartmentId, residency.id, residency.tenantSlug)
      .pipe(finalize(() => this.deletingResidency.set(null)))
      .subscribe({
        next: () => {
          this.notifications.success('Residencia eliminada');
          this.loadResidencies(this.id!);
        },
        error: (err: unknown) =>
          this.residencyDeleteError.set(this.toMessage(err, 'No se pudo eliminar la residencia.')),
      });
  };

  ngOnInit(): void {
    if (this.mode === 'edit') {
      this.form.controls.phone.disable();
      this.form.controls.password.disable();
      this.loadUser(this.id!);
      this.loadRelated(this.id!);
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

  requestOtp(): void {
    this.otpError.set(null);
    this.otpSending.set(true);
    this.usersService
      .requestVerification({ phone: this.userPhone() })
      .pipe(finalize(() => this.otpSending.set(false)))
      .subscribe({
        next: () => {
          this.otpRequested.set(true);
          this.otpCode.reset('');
          this.notifications.success('Código OTP enviado al teléfono del usuario.');
        },
        error: (err: unknown) => this.otpError.set(this.toMessage(err, 'No se pudo enviar el OTP.')),
      });
  }

  confirmOtp(): void {
    if (this.otpCode.invalid) {
      this.otpCode.markAsTouched();
      return;
    }
    this.otpError.set(null);
    this.otpConfirming.set(true);
    this.usersService
      .confirmVerification({ phone: this.userPhone(), code: this.otpCode.value.trim() })
      .pipe(finalize(() => this.otpConfirming.set(false)))
      .subscribe({
        next: () => {
          this.otpRequested.set(false);
          this.otpCode.reset('');
          this.userStatus.set('Active');
          this.notifications.success('Teléfono verificado. El usuario ahora está activo.');
        },
        error: (err: unknown) => this.otpError.set(this.toMessage(err, 'Código inválido o expirado.')),
      });
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
          this.userStatus.set(user.status);
          this.userPhone.set(user.phone);
        },
        error: (err: unknown) =>
          this.error.set(this.toMessage(err, 'No se pudo cargar el usuario.')),
      });
  }

  /**
   * Fetches the tenants catalog once — every section below the form names its conjunto from
   * it — and then fans out into the sections that need it.
   */
  private loadRelated(userId: string): void {
    this.loadingMemberships.set(true);
    this.loadingResidencies.set(true);
    this.loadingRequests.set(true);
    this.membershipsError.set(null);
    this.residenciesError.set(null);
    this.requestsError.set(null);

    this.tenantsService.listAll().subscribe({
      next: (tenants) => {
        this.tenantsById.set(new Map(tenants.map((t) => [t.id, t])));
        this.loadMemberships(userId);
        this.loadRequests(userId);
      },
      error: (err: unknown) => {
        const message = this.toMessage(err, 'No se pudo cargar el catálogo de conjuntos.');
        this.membershipsError.set(message);
        this.residenciesError.set(message);
        this.requestsError.set(message);
        this.loadingMemberships.set(false);
        this.loadingResidencies.set(false);
        this.loadingRequests.set(false);
      },
    });
  }

  /**
   * Every membership of the user, across conjuntos. The conjuntos found here are also the
   * ones scanned for residencies.
   */
  private loadMemberships(userId: string): void {
    this.membershipsService
      .listByUser(userId)
      .pipe(finalize(() => this.loadingMemberships.set(false)))
      .subscribe({
        next: (memberships) => {
          const byId = this.tenantsById();

          this.memberships.set(
            memberships.map((m) => ({
              ...m,
              tenantName: byId.get(m.tenantId)?.name ?? '—',
              tenantSlug: byId.get(m.tenantId)?.slug ?? '',
            })),
          );

          this.residencyTenants.set(
            [...new Set(memberships.map((m) => m.tenantId))]
              .map((id) => byId.get(id))
              .filter((t): t is TenantDto => !!t),
          );
          this.loadResidencies(userId);
        },
        error: (err: unknown) => {
          const message = this.toMessage(err, 'No se pudieron cargar las membresías.');
          this.membershipsError.set(message);
          this.residenciesError.set(message);
          this.loadingResidencies.set(false);
        },
      });
  }

  /**
   * Requests the user takes part in. The API splits involvement in two filters that never
   * overlap — `participantUserId` covers reporter and follower, `assignedToUserId` the
   * assignee — so both are queried and merged here, newest first.
   */
  private loadRequests(userId: string): void {
    const pageSize = 100;

    forkJoin({
      participating: this.requestsService.query(1, pageSize, { participantUserId: userId }),
      assigned: this.requestsService.query(1, pageSize, { assignedToUserId: userId }),
    })
      .pipe(finalize(() => this.loadingRequests.set(false)))
      .subscribe({
        next: ({ participating, assigned }) => {
          const byId = this.tenantsById();
          const merged = new Map<string, RequestDto>();
          for (const request of [...participating.items, ...assigned.items]) {
            merged.set(request.id, request);
          }

          this.requests.set(
            [...merged.values()]
              .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
              .map((r) => ({
                ...r,
                tenantName: byId.get(r.tenantId)?.name ?? '—',
                involvement: this.involvementLabel(r, userId),
              })),
          );
          this.requestsTruncated.set(
            participating.totalCount > participating.items.length ||
              assigned.totalCount > assigned.items.length,
          );
        },
        error: (err: unknown) =>
          this.requestsError.set(this.toMessage(err, 'No se pudieron cargar las solicitudes.')),
      });
  }

  /**
   * How the user takes part in a request. Reporter and assignee are read off the row; anything
   * else reaching this list came back from the participant filter, i.e. a follower.
   */
  private involvementLabel(request: RequestDto, userId: string): string {
    const roles: string[] = [];
    if (request.createdByUserId === userId) roles.push('Reportante');
    if (request.assignedToUserId === userId) roles.push('Asignado');
    if (!roles.length) roles.push('Participante');
    return roles.join(' · ');
  }

  /**
   * Residencies have no cross-tenant endpoint: for every conjunto the user belongs to we ask
   * for the apartments where they are an active resident, then read that apartment's residents
   * to recover the relation, dates and history. A conjunto that fails contributes no rows
   * instead of breaking the whole section. Also re-run after deleting a residency.
   */
  private loadResidencies(userId: string): void {
    const tenants = this.residencyTenants();
    if (!tenants.length) {
      this.residencies.set([]);
      this.loadingResidencies.set(false);
      return;
    }

    forkJoin(tenants.map((tenant) => this.residenciesForTenant(userId, tenant)))
      .pipe(finalize(() => this.loadingResidencies.set(false)))
      .subscribe({
        next: (perTenant) => this.residencies.set(perTenant.flat()),
        error: (err: unknown) =>
          this.residenciesError.set(this.toMessage(err, 'No se pudieron cargar las residencias.')),
      });
  }

  private residenciesForTenant(userId: string, tenant: TenantDto): Observable<UserResidencyRow[]> {
    return this.apartmentsService.query(tenant.slug, 1, 100, userId).pipe(
      switchMap((page) =>
        page.items.length
          ? forkJoin(
              page.items.map((apartment) =>
                this.apartmentsService.getResidents(apartment.id, tenant.slug).pipe(
                  map((residents) =>
                    residents
                      .filter((r) => r.userId === userId)
                      .map((r) => ({
                        ...r,
                        apartment,
                        tenantName: tenant.name,
                        tenantSlug: tenant.slug,
                      })),
                  ),
                  catchError(() => of<UserResidencyRow[]>([])),
                ),
              ),
            ).pipe(map((groups) => groups.flat()))
          : of<UserResidencyRow[]>([]),
      ),
      catchError(() => of<UserResidencyRow[]>([])),
    );
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
