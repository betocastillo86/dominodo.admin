import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  Observable,
  of,
  OperatorFunction,
  switchMap,
} from 'rxjs';
import { NgbTypeahead, NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn, TableSort } from '../../../shared/ui/data-table/data-table.component';
import {
  MultiSelectComponent,
  MultiSelectOption,
} from '../../../shared/ui/multi-select/multi-select.component';
import { MembershipsService } from '../../memberships/data-access/memberships.service';
import { MembershipDto } from '../../memberships/data-access/membership.models';
import { UsersService } from '../../users/data-access/users.service';
import { RequestsService, RequestFilters } from '../data-access/requests.service';
import {
  REQUEST_PRIORITY_BADGES,
  REQUEST_PRIORITY_LABELS,
  REQUEST_STATUS_BADGES,
  REQUEST_STATUS_LABELS,
  REQUEST_VISIBILITY_LABELS,
  RequestCategoryDto,
  RequestDto,
  RequestPriority,
  RequestSortBy,
  RequestStatus,
  RequestType,
  RequestVisibility,
} from '../data-access/request.models';
import { TenantDto } from '../../tenants/data-access/tenant.models';

/** Sort applied when the URL carries none: newest first. */
const DEFAULT_SORT: TableSort = { key: 'Date', direction: 'desc' };

/** Query params that describe the view rather than a filter — ignored by "Limpiar filtros". */
const VIEW_PARAMS = ['page', 'sortBy', 'direction'];

/**
 * What the participant filter needs to show and to query. A membership from the
 * typeahead satisfies it, and so does a user resolved by id when the filter is
 * restored from the URL.
 */
interface ParticipantRef {
  userId: string;
  userName: string;
  phone: string;
}

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [
    PageHeaderComponent,
    DataTableComponent,
    MultiSelectComponent,
    ReactiveFormsModule,
    NgbTypeahead,
    TablerIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-list.component.html',
})
export class RequestListComponent {
  private readonly requestsService = inject(RequestsService);
  private readonly membershipsService = inject(MembershipsService);
  private readonly usersService = inject(UsersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly requests = this.requestsService.requests;
  readonly paging = this.requestsService.paging;
  readonly loading = this.requestsService.loading;
  readonly error = this.requestsService.error;

  private readonly pageSize = 20;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<RequestStatus[]>([], { nonNullable: true });
  readonly typeControl = new FormControl<RequestType | ''>('', { nonNullable: true });
  readonly priorityControl = new FormControl<RequestPriority | ''>('', { nonNullable: true });
  readonly visibilityControl = new FormControl<RequestVisibility | ''>('', { nonNullable: true });
  readonly tenantControl = new FormControl<string>('', { nonNullable: true });

  /** Column sort state; defaults to newest first (Date/Desc). */
  readonly sort = signal<TableSort>({ ...DEFAULT_SORT });
  /** Disabled until a tenant is selected — categories are tenant-scoped. */
  readonly categoryControl = new FormControl<string[]>({ value: [], disabled: true }, { nonNullable: true });

  /**
   * Participant filter — the typeahead's raw input model (a typed string or the
   * picked membership). Cross-tenant: works without a conjunto selected; when
   * one is selected the search is scoped to it.
   */
  readonly participantControl = new FormControl<string | ParticipantRef>('', { nonNullable: true });
  /** The user the filter is on; set from the typeahead or restored from the URL. */
  readonly participantUserId = signal<string | null>(null);
  /** Name + phone of that user, for the input and the hint; null until resolved. */
  readonly selectedParticipant = signal<ParticipantRef | null>(null);

  readonly tenants = signal<TenantDto[]>([]);
  /** Categories of the currently selected tenant; empty when no tenant is chosen. */
  readonly categories = signal<RequestCategoryDto[]>([]);
  readonly categoriesLoading = signal(false);

  /**
   * The listing state as it stands in the URL. Keeping it here (rather than reading
   * the snapshot back) gives the row links a `back` payload and tells the "Limpiar
   * filtros" button whether there is anything to clear.
   */
  private readonly urlParams = signal<Params>({});

  /** True when at least one filter (not just paging/sorting) is applied. */
  readonly hasFilters = computed(() =>
    Object.keys(this.urlParams()).some((key) => !VIEW_PARAMS.includes(key)),
  );

  private readonly tenantMap = computed(() => {
    const m = new Map<string, string>();
    for (const t of this.tenants()) m.set(t.id, t.name);
    return m;
  });

  /**
   * Typeahead search: debounced, cross-tenant free-text lookup against GET /memberships.
   * When a conjunto is selected the search is scoped to it via tenantId.
   */
  readonly searchUsers: OperatorFunction<string, readonly MembershipDto[]> = (
    text$: Observable<string>,
  ) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term) => {
        if (term.trim().length < 2) return of([] as MembershipDto[]);
        return this.membershipsService
          .searchAcrossTenants(term.trim(), this.tenantControl.value || undefined)
          .pipe(catchError(() => of([] as MembershipDto[])));
      }),
    );

  /** Renders a result row / the selected value as "Usuario · teléfono". */
  readonly userFormatter = (m: string | ParticipantRef): string =>
    typeof m === 'string' ? m : `${m.userName} · ${m.phone}`;

  readonly statusOptions: MultiSelectOption[] = [
    { value: 'New', label: 'Nuevo' },
    { value: 'InProgress', label: 'En progreso' },
    { value: 'Resolved', label: 'Resuelto' },
    { value: 'Closed', label: 'Cerrado' },
  ];

  /** Category options for the multi-select, derived from the selected tenant's catalog. */
  readonly categoryOptions = computed<MultiSelectOption[]>(() =>
    this.categories().map((c) => ({ value: c.id, label: c.name })),
  );

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

  readonly columns = computed((): readonly TableColumn<RequestDto>[] => [
    { header: 'Código', value: (r) => r.code, class: 'text-secondary w-1' },
    {
      header: 'Conjunto',
      value: (r) => this.tenantMap().get(r.tenantId) ?? r.tenantId.slice(0, 8) + '…',
      class: 'text-nowrap',
    },
    { header: 'Título', value: (r) => r.title, truncate: true },
    {
      header: 'Visibilidad',
      value: (r) => REQUEST_VISIBILITY_LABELS[r.visibility as RequestVisibility] ?? r.visibility,
      badgeClass: (r) => r.visibility === 'Public' ? 'badge bg-teal-lt' : 'badge bg-secondary-lt',
    },
    {
      header: 'Estado',
      value: (r) => REQUEST_STATUS_LABELS[r.status as RequestStatus] ?? r.status,
      badgeClass: (r) => REQUEST_STATUS_BADGES[r.status] ?? 'badge',
      sortKey: 'Status',
    },
    {
      header: 'Prioridad',
      value: (r) => REQUEST_PRIORITY_LABELS[r.priority as RequestPriority] ?? r.priority,
      badgeClass: (r) => REQUEST_PRIORITY_BADGES[r.priority] ?? 'badge',
      sortKey: 'Priority',
    },
    {
      header: 'Registro',
      value: (r) => this.formatDate(r.createdAtUtc),
      class: 'text-secondary text-nowrap',
      sortKey: 'Date',
    },
  ]);

  readonly rowKey = (r: RequestDto): string => r.id;
  readonly editLink = (r: RequestDto): unknown[] => ['/requests', r.id, 'edit'];
  /**
   * The detail needs the request's tenant; `back` carries this listing's own query
   * string so its "Volver al listado" lands on the very same filtered page.
   */
  readonly editQueryParams = (r: RequestDto): Record<string, string> => {
    const back = serializeParams(this.urlParams());
    return back ? { tenantId: r.tenantId, back } : { tenantId: r.tenantId };
  };

  constructor() {
    const page = this.restoreFromUrl();

    this.requestsService.tenantCatalog().subscribe({
      next: (tenants) => {
        this.tenants.set(tenants);
        // A restored tenant filter still has to pull its categories, keeping the
        // selection the URL carried.
        if (this.tenantControl.value) this.loadCategories(this.tenantControl.value, true);
      },
      error: () => { /* non-critical; column falls back to UUID prefix */ },
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.reload(1));

    const filterControls: AbstractControl[] = [
      this.statusControl,
      this.typeControl,
      this.priorityControl,
      this.visibilityControl,
      this.categoryControl,
    ];
    filterControls.forEach((ctrl) => {
      ctrl.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.reload(1));
    });

    // Tenant drives the category filter: switching tenant reloads its categories
    // and resets the (tenant-specific) category selection. These filter streams carry
    // no `distinctUntilChanged`: seeding the controls from the URL is silent
    // (`emitEvent: false`), which would leave the operator holding a stale last value
    // and swallow a later, genuine pick of it.
    this.tenantControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((tenantId) => {
        this.loadCategories(tenantId);
        this.reload(1);
      });

    this.reload(page);

    // A URL change this page did not make — the sidebar link back to /requests, a
    // pasted link, the browser's back/forward — re-seeds the filters from it.
    this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
      if (serializeParams(params) === serializeParams(this.urlParams())) return;
      const restoredPage = this.restoreFromUrl();
      if (this.tenantControl.value) this.loadCategories(this.tenantControl.value, true);
      else this.loadCategories('');
      this.reload(restoredPage);
    });
  }

  onSelectParticipant(event: NgbTypeaheadSelectItemEvent<MembershipDto>): void {
    const { userId, userName, phone } = event.item;
    this.selectedParticipant.set({ userId, userName, phone });
    this.participantUserId.set(userId);
    this.reload(1);
  }

  /** Clears the participant filter (the "x" button or picking a new tenant). */
  clearParticipant(): void {
    if (!this.participantUserId() && !this.participantControl.value) return;
    this.selectedParticipant.set(null);
    this.participantUserId.set(null);
    this.participantControl.setValue('', { emitEvent: false });
    this.reload(1);
  }

  /** Drops every filter (sorting and page size stay) and reloads from the first page. */
  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.statusControl.setValue([], { emitEvent: false });
    this.typeControl.setValue('', { emitEvent: false });
    this.priorityControl.setValue('', { emitEvent: false });
    this.visibilityControl.setValue('', { emitEvent: false });
    this.tenantControl.setValue('', { emitEvent: false });
    this.categoryControl.setValue([], { emitEvent: false });
    this.categoryControl.disable({ emitEvent: false });
    this.categories.set([]);
    this.participantControl.setValue('', { emitEvent: false });
    this.participantUserId.set(null);
    this.selectedParticipant.set(null);
    this.reload(1);
  }

  /** Loads the categories of a tenant; `keepSelection` survives a restore from the URL. */
  private loadCategories(tenantId: string, keepSelection = false): void {
    if (!keepSelection) this.categoryControl.setValue([], { emitEvent: false });
    this.categories.set([]);

    const slug = this.tenants().find((t) => t.id === tenantId)?.slug;
    if (!slug) {
      this.categoryControl.setValue([], { emitEvent: false });
      this.categoryControl.disable({ emitEvent: false });
      return;
    }
    this.categoryControl.enable({ emitEvent: false });

    this.categoriesLoading.set(true);
    this.requestsService.categoryCatalog(slug).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.categoriesLoading.set(false);
      },
      error: () => this.categoriesLoading.set(false),
    });
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  /** A header sort click: store the new state and reload from the first page. */
  onSortChange(sort: TableSort): void {
    this.sort.set(sort);
    this.reload(1);
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }

  /**
   * Seeds the filters from the query string so a reload, a shared link or a return
   * from the detail all land on the same listing. Returns the page to open on.
   */
  private restoreFromUrl(): number {
    const qp = this.route.snapshot.queryParamMap;

    this.searchControl.setValue(qp.get('search') ?? '', { emitEvent: false });
    this.statusControl.setValue(qp.getAll('statuses') as RequestStatus[], { emitEvent: false });
    this.typeControl.setValue((qp.get('type') as RequestType) ?? '', { emitEvent: false });
    this.priorityControl.setValue((qp.get('priority') as RequestPriority) ?? '', { emitEvent: false });
    this.visibilityControl.setValue((qp.get('visibility') as RequestVisibility) ?? '', { emitEvent: false });
    this.tenantControl.setValue(qp.get('tenantId') ?? '', { emitEvent: false });
    // Stays disabled until the tenant's catalog lands; a disabled control keeps its
    // value, so the first query already carries the restored categories.
    this.categoryControl.setValue(qp.getAll('categoryIds'), { emitEvent: false });

    const sortBy = qp.get('sortBy');
    this.sort.set(
      sortBy
        ? { key: sortBy, direction: qp.get('direction') === 'asc' ? 'asc' : 'desc' }
        : { ...DEFAULT_SORT },
    );

    // Only re-resolve when the participant actually changed: the lookup is a request,
    // and this runs again on every URL change that did not come from this page.
    const participantUserId = qp.get('participantUserId');
    if (participantUserId !== this.participantUserId()) {
      this.participantUserId.set(participantUserId);
      this.selectedParticipant.set(null);
      this.participantControl.setValue('', { emitEvent: false });
      if (participantUserId) this.resolveParticipant(participantUserId);
    }

    const page = Number(qp.get('page'));
    return Number.isInteger(page) && page > 0 ? page : 1;
  }

  /** Puts a name and phone on a participant filter restored as a bare id. */
  private resolveParticipant(userId: string): void {
    this.usersService.getById(userId).subscribe({
      next: (user) => {
        const participant: ParticipantRef = {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          phone: user.phone,
        };
        this.selectedParticipant.set(participant);
        this.participantControl.setValue(participant, { emitEvent: false });
      },
      error: () => { /* the filter still applies; only its label stays unresolved */ },
    });
  }

  /**
   * Mirrors the listing state into the query string. `replaceUrl` keeps a run of
   * filter edits to a single history entry, so the browser's back button from the
   * detail returns straight to the filtered listing.
   */
  private syncUrl(page: number, filters: RequestFilters): void {
    const sort = this.sort();
    const params: Params = {};
    if (filters.search) params['search'] = filters.search;
    if (filters.tenantId) params['tenantId'] = filters.tenantId;
    if (filters.statuses?.length) params['statuses'] = filters.statuses;
    if (filters.categoryIds?.length) params['categoryIds'] = filters.categoryIds;
    if (filters.type) params['type'] = filters.type;
    if (filters.priority) params['priority'] = filters.priority;
    if (filters.visibility) params['visibility'] = filters.visibility;
    if (filters.participantUserId) params['participantUserId'] = filters.participantUserId;
    if (sort.key !== DEFAULT_SORT.key || sort.direction !== DEFAULT_SORT.direction) {
      params['sortBy'] = sort.key;
      params['direction'] = sort.direction;
    }
    if (page > 1) params['page'] = page;

    this.urlParams.set(params);
    // Skip the navigation when the URL already says this — the restore on entry
    // would otherwise re-navigate on top of the one that just activated the route.
    if (serializeParams(params) === serializeParams(this.route.snapshot.queryParams)) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: params, replaceUrl: true });
  }

  private reload(page: number): void {
    const statuses = this.statusControl.value;
    const categoryIds = this.categoryControl.value;
    const sort = this.sort();
    const filters: RequestFilters = {
      search: this.searchControl.value || undefined,
      statuses: statuses.length ? statuses : undefined,
      type: (this.typeControl.value as RequestType) || undefined,
      priority: (this.priorityControl.value as RequestPriority) || undefined,
      visibility: (this.visibilityControl.value as RequestVisibility) || undefined,
      tenantId: this.tenantControl.value || undefined,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      participantUserId: this.participantUserId() ?? undefined,
      sortBy: sort.key as RequestSortBy,
      direction: sort.direction === 'asc' ? 'Asc' : 'Desc',
    };
    this.syncUrl(page, filters);
    this.requestsService.list(page, this.pageSize, filters);
  }
}

/**
 * Query params as a canonical string: keys sorted and repeated for array values, so
 * two equivalent param sets always serialize the same. Used both to compare against
 * the current URL and to hand the detail page a `back` payload.
 */
function serializeParams(params: Params): string {
  const search = new URLSearchParams();
  for (const key of Object.keys(params).sort()) {
    const value = params[key];
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.append(key, String(value));
  }
  return search.toString();
}
