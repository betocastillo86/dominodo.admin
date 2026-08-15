import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  forkJoin,
  from,
  Observable,
  of,
  OperatorFunction,
  switchMap,
  throwError,
} from 'rxjs';
import { NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { TenantsService } from '../../tenants/data-access/tenants.service';
import { ApartmentsService } from '../../apartments/data-access/apartments.service';
import { ApartmentDetailDto } from '../../apartments/data-access/apartment.models';
import { MembershipsService } from '../../memberships/data-access/memberships.service';
import { MembershipDto } from '../../memberships/data-access/membership.models';
import { UsersService } from '../../users/data-access/users.service';
import { UserDetailDto } from '../../users/data-access/user.models';
import { RequestsService } from '../data-access/requests.service';
import {
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  REQUEST_VISIBILITY_LABELS,
  RequestAttachmentDto,
  RequestCategoryDto,
  RequestDetailDto,
  RequestParticipantDto,
  RequestPriority,
  RequestStatus,
  RequestStatusHistoryDto,
  RequestType,
  RequestUpdateDto,
  RequestVisibility,
} from '../data-access/request.models';

/** Edit a request's fields, change its status, and add participants — all in one detail page. */
@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    NgbTypeahead,
    PageHeaderComponent,
    SpinnerComponent,
    TablerIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-detail.component.html',
})
export class RequestDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly requestsService = inject(RequestsService);
  private readonly tenantsService = inject(TenantsService);
  private readonly apartmentsService = inject(ApartmentsService);
  private readonly membershipsService = inject(MembershipsService);
  private readonly usersService = inject(UsersService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id')!;
  private readonly tenantId = this.route.snapshot.queryParamMap.get('tenantId');

  readonly tenantSlug = signal<string | null>(null);
  readonly tenantName = signal<string | null>(null);
  readonly detail = signal<RequestDetailDto | null>(null);
  readonly categories = signal<RequestCategoryDto[]>([]);
  readonly attachments = signal<RequestAttachmentDto[]>([]);

  /** Apartment linked to the request (fetched when the detail has an apartmentId). */
  readonly apartment = signal<ApartmentDetailDto | null>(null);

  /** Resolved participant users keyed by userId, so the table can show name + phone. */
  readonly participantUsers = signal<Record<string, UserDetailDto>>({});

  /** Router link to the request's conjunto (tenant) edit page. */
  readonly conjuntoLink = this.tenantId ? ['/tenants', this.tenantId, 'edit'] : null;

  /** Query params for the apartment edit page (tenant context is required there). */
  readonly apartmentLinkQueryParams = computed(() => ({
    tenant: this.tenantSlug(),
    tenantId: this.tenantId,
  }));

  readonly loadingInit = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly savingEdit = signal(false);
  readonly editError = signal<string | null>(null);

  readonly savingStatus = signal(false);
  readonly statusError = signal<string | null>(null);

  readonly savingParticipant = signal(false);
  readonly participantError = signal<string | null>(null);

  readonly uploadingFile = signal(false);
  readonly uploadError = signal<string | null>(null);

  readonly pageTitle = computed(() => {
    const d = this.detail();
    return d ? `Solicitud ${d.code}` : 'Solicitud';
  });

  readonly statusOptions: { value: RequestStatus; label: string }[] = [
    { value: 'New', label: 'Nuevo' },
    { value: 'InProgress', label: 'En progreso' },
    { value: 'Resolved', label: 'Resuelto' },
    { value: 'Closed', label: 'Cerrado' },
  ];

  readonly typeOptions: { value: RequestType; label: string }[] = [
    { value: 'Peticion', label: 'Petición' },
    { value: 'Queja', label: 'Queja' },
    { value: 'Reclamo', label: 'Reclamo' },
    { value: 'Sugerencia', label: 'Sugerencia' },
    { value: 'Maintenance', label: 'Mantenimiento' },
  ];

  readonly priorityOptions: { value: RequestPriority; label: string }[] = [
    { value: 'Low', label: 'Baja' },
    { value: 'Medium', label: 'Media' },
    { value: 'High', label: 'Alta' },
  ];

  readonly visibilityOptions: { value: RequestVisibility; label: string }[] = [
    { value: 'Private', label: 'Privada' },
    { value: 'Public', label: 'Pública' },
  ];

  /** Edit fields form — pre-populated from the loaded detail. */
  readonly editForm = new FormGroup({
    type: new FormControl<RequestType>('Peticion', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    priority: new FormControl<RequestPriority>('Medium', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    categoryId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    location: new FormControl('', { nonNullable: true }),
    metadata: new FormControl('', { nonNullable: true }),
    visibility: new FormControl<RequestVisibility>('Private', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /** Status change form. */
  readonly statusForm = new FormGroup({
    status: new FormControl<RequestStatus>('New', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    note: new FormControl('', { nonNullable: true }),
  });

  /** Add participant: the typeahead's raw input model (a typed string or the selected membership). */
  readonly participantSearch = new FormControl<string | MembershipDto>('', { nonNullable: true });
  /** The membership picked from the typeahead results; null until one is chosen. */
  readonly selectedUser = signal<MembershipDto | null>(null);
  /** True once the user tries to add without a selection — gates the inline error. */
  readonly participantSubmitted = signal(false);

  /** Typeahead search: debounced, tenant-scoped free-text lookup against GET /memberships. */
  readonly searchUsers: OperatorFunction<string, readonly MembershipDto[]> = (
    text$: Observable<string>,
  ) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => {
        const slug = this.tenantSlug();
        if (!slug || term.trim().length < 2) return of([] as MembershipDto[]);
        return this.membershipsService
          .search(slug, term.trim())
          .pipe(catchError(() => of([] as MembershipDto[])));
      }),
    );

  /**
   * Renders a result row / the selected value as "Usuario · teléfono".
   * Guards against the initial empty-string model so the input shows the
   * placeholder instead of "undefined · undefined".
   */
  readonly userFormatter = (m: string | MembershipDto): string =>
    typeof m === 'string' ? m : `${m.userName} · ${m.phone}`;

  ngOnInit(): void {
    if (!this.tenantId) {
      this.loadError.set('No se pudo determinar el conjunto de esta solicitud.');
      return;
    }
    this.loadDetail();
  }

  onSubmitEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const slug = this.tenantSlug();
    if (!slug) return;

    this.savingEdit.set(true);
    this.editError.set(null);

    const raw = this.editForm.getRawValue();
    this.requestsService
      .update(
        this.id,
        {
          type: raw.type,
          title: raw.title.trim(),
          description: raw.description.trim(),
          priority: raw.priority,
          categoryId: raw.categoryId,
          location: raw.location.trim() || null,
          metadata: raw.metadata.trim() || null,
          visibility: raw.visibility,
        },
        slug,
      )
      .pipe(finalize(() => this.savingEdit.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Solicitud actualizada');
          this.reloadDetail();
        },
        error: (err: unknown) => this.editError.set(this.toMessage(err, 'No se pudo guardar la solicitud.')),
      });
  }

  onSubmitStatus(): void {
    if (this.statusForm.invalid) {
      this.statusForm.markAllAsTouched();
      return;
    }
    const slug = this.tenantSlug();
    if (!slug) return;

    this.savingStatus.set(true);
    this.statusError.set(null);

    const raw = this.statusForm.getRawValue();
    this.requestsService
      .changeStatus(this.id, { status: raw.status, note: raw.note.trim() || null }, slug)
      .pipe(finalize(() => this.savingStatus.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Estado actualizado');
          this.statusForm.reset({ status: raw.status, note: '' });
          this.reloadDetail();
        },
        error: (err: unknown) => this.statusError.set(this.toMessage(err, 'No se pudo cambiar el estado.')),
      });
  }

  onSelectUser(event: NgbTypeaheadSelectItemEvent<MembershipDto>): void {
    this.selectedUser.set(event.item);
    this.participantError.set(null);
  }

  /** Clears the pending selection whenever the user edits the search text again. */
  onSearchInput(): void {
    if (this.selectedUser()) this.selectedUser.set(null);
  }

  clearSelectedUser(): void {
    this.selectedUser.set(null);
    this.participantSearch.setValue('');
  }

  onSubmitParticipant(): void {
    this.participantSubmitted.set(true);
    const user = this.selectedUser();
    const slug = this.tenantSlug();
    if (!user || !slug) return;

    this.savingParticipant.set(true);
    this.participantError.set(null);

    this.requestsService
      .addParticipant(this.id, { userId: user.userId }, slug)
      .pipe(finalize(() => this.savingParticipant.set(false)))
      .subscribe({
        next: () => {
          this.notifications.success('Participante agregado');
          this.selectedUser.set(null);
          this.participantSearch.setValue('');
          this.participantSubmitted.set(false);
          this.reloadDetail();
        },
        error: (err: unknown) => this.participantError.set(this.toMessage(err, 'No se pudo agregar el participante.')),
      });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const slug = this.tenantSlug();
    if (!slug) return;

    const contentType = file.type || 'application/octet-stream';
    this.uploadingFile.set(true);
    this.uploadError.set(null);

    this.requestsService
      .getUploadUrl(this.id, file.name, contentType, slug)
      .pipe(
        switchMap((ticket) =>
          from(
            fetch(ticket.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: {
                'Content-Type': contentType,
                'x-ms-blob-type': 'BlockBlob',
              },
            }),
          ).pipe(
            switchMap((response) =>
              response.ok
                ? of(ticket)
                : throwError(() => new Error(`Error al subir el archivo (${response.status})`)),
            ),
          ),
        ),
        switchMap((ticket) =>
          this.requestsService.confirmAttachment(
            this.id,
            { key: ticket.key, fileName: file.name, contentType },
            slug,
          ),
        ),
        finalize(() => {
          this.uploadingFile.set(false);
          input.value = '';
        }),
      )
      .subscribe({
        next: () => {
          this.notifications.success('Archivo adjunto guardado');
          this.reloadAttachments();
        },
        error: (err: unknown) =>
          this.uploadError.set(this.toMessage(err, 'No se pudo adjuntar el archivo.')),
      });
  }

  onDownload(attachment: RequestAttachmentDto): void {
    const slug = this.tenantSlug();
    if (!slug) return;
    this.requestsService
      .getDownloadUrl(this.id, attachment.id, slug)
      .pipe(
        switchMap(({ url }) => from(fetch(url))),
        switchMap((response) =>
          response.ok
            ? from(response.blob())
            : throwError(() => new Error(`Error al descargar (${response.status})`)),
        ),
      )
      .subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = attachment.fileName;
          anchor.click();
          URL.revokeObjectURL(objectUrl);
        },
        error: (err: unknown) =>
          this.notifications.error(this.toMessage(err, 'No se pudo descargar el archivo.')),
      });
  }

  labelFor(value: string, labels: Record<string, string>): string {
    return labels[value] ?? value;
  }

  statusLabel(status: string): string {
    return REQUEST_STATUS_LABELS[status as RequestStatus] ?? status;
  }

  typeLabel(type: string): string {
    return REQUEST_TYPE_LABELS[type as RequestType] ?? type;
  }

  priorityLabel(priority: string): string {
    return REQUEST_PRIORITY_LABELS[priority as RequestPriority] ?? priority;
  }

  visibilityLabel(visibility: string): string {
    return REQUEST_VISIBILITY_LABELS[visibility as RequestVisibility] ?? visibility;
  }

  /** Router link to the apartment's edit page. */
  apartmentLink(apartmentId: string): unknown[] {
    return ['/apartments', apartmentId, 'edit'];
  }

  statusBadge(status: string): string {
    const map: Record<string, string> = {
      New: 'badge bg-blue-lt',
      InProgress: 'badge bg-orange-lt',
      Resolved: 'badge bg-green-lt',
      Closed: 'badge bg-secondary-lt',
    };
    return map[status] ?? 'badge';
  }

  trackParticipant(_: number, p: RequestParticipantDto): string {
    return p.id;
  }

  trackHistoryEntry(_: number, h: RequestStatusHistoryDto): string {
    return h.id;
  }

  trackUpdate(_: number, u: RequestUpdateDto): string {
    return u.id;
  }

  private loadDetail(): void {
    this.loadingInit.set(true);
    this.loadError.set(null);

    this.tenantsService
      .getById(this.tenantId!)
      .pipe(
        switchMap((tenant) => {
          this.tenantName.set(tenant.name);
          this.tenantSlug.set(tenant.slug);
          // Categories are tenant-scoped; load them alongside the detail so the
          // selector is populated. A category-load failure must not block the detail.
          return forkJoin({
            detail: this.requestsService.getById(this.id, tenant.slug),
            categories: this.requestsService
              .categoryCatalog(tenant.slug)
              .pipe(catchError(() => of([] as RequestCategoryDto[]))),
            attachments: this.requestsService
              .listAttachments(this.id, tenant.slug)
              .pipe(catchError(() => of([] as RequestAttachmentDto[]))),
          });
        }),
        finalize(() => this.loadingInit.set(false)),
      )
      .subscribe({
        next: ({ detail, categories, attachments }) => {
          this.categories.set(categories);
          this.attachments.set(attachments);
          this.applyDetail(detail);
          if (detail.apartmentId) this.loadApartment(detail.apartmentId);
        },
        error: (err: unknown) => this.loadError.set(this.toMessage(err, 'No se pudo cargar la solicitud.')),
      });
  }

  /** Loads the linked apartment; supplementary info, so failures are ignored silently. */
  private loadApartment(apartmentId: string): void {
    const slug = this.tenantSlug();
    if (!slug) return;
    this.apartmentsService.getById(apartmentId, slug).subscribe({
      next: (a) => this.apartment.set(a),
      error: () => { /* silently ignore — apartment info is supplementary */ },
    });
  }

  private reloadDetail(): void {
    const slug = this.tenantSlug();
    if (!slug) return;
    this.requestsService.getById(this.id, slug).subscribe({
      next: (d) => this.applyDetail(d),
      error: () => { /* silently ignore reload errors */ },
    });
  }

  private reloadAttachments(): void {
    const slug = this.tenantSlug();
    if (!slug) return;
    this.requestsService.listAttachments(this.id, slug).subscribe({
      next: (list) => this.attachments.set(list),
      error: () => { /* silently ignore */ },
    });
  }

  private applyDetail(d: RequestDetailDto): void {
    this.detail.set(d);
    this.editForm.patchValue({
      type: d.type as RequestType,
      title: d.title,
      description: d.description,
      priority: d.priority as RequestPriority,
      categoryId: d.categoryId,
      location: d.location ?? '',
      metadata: d.metadata ?? '',
      visibility: d.visibility as RequestVisibility,
    });
    this.statusForm.patchValue({ status: d.status as RequestStatus });
    this.loadParticipantUsers(d.participants);
  }

  /**
   * Resolves each participant's user via GET /users/{id} so the table can show
   * name + phone instead of the raw id. One request per not-yet-resolved user;
   * failures are ignored so the row falls back to the id.
   */
  private loadParticipantUsers(participants: RequestParticipantDto[]): void {
    const known = this.participantUsers();
    const missing = [...new Set(participants.map((p) => p.userId))].filter((id) => !known[id]);
    for (const userId of missing) {
      this.usersService.getById(userId).subscribe({
        next: (user) => this.participantUsers.update((map) => ({ ...map, [userId]: user })),
        error: () => { /* silently ignore — the row falls back to the userId */ },
      });
    }
  }

  /** Full name of a resolved participant, or null if not resolved yet. */
  participantName(userId: string): string | null {
    const user = this.participantUsers()[userId];
    return user ? `${user.firstName} ${user.lastName}`.trim() : null;
  }

  /** Phone of a resolved participant, or null if not resolved yet. */
  participantPhone(userId: string): string | null {
    return this.participantUsers()[userId]?.phone ?? null;
  }

  private toMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      const problem = err.error as ProblemDetails | undefined;
      return problem?.detail ?? problem?.title ?? fallback;
    }
    return fallback;
  }
}
