import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { MembershipsService } from '../data-access/memberships.service';
import {
  InvitationDto,
  InvitationFilters,
  INVITATION_STATUS_BADGES,
  INVITATION_STATUS_LABELS,
  MembershipDto,
  MembershipFilters,
  MEMBERSHIP_STATUS_BADGES,
  MEMBERSHIP_STATUS_LABELS,
  RoleSummaryDto,
} from '../data-access/membership.models';

@Component({
  selector: 'app-membership-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './membership-list.component.html',
})
export class MembershipListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly membershipsService = inject(MembershipsService);

  readonly tenantSlug = this.route.snapshot.queryParamMap.get('tenant') ?? '';
  readonly tenantId = this.route.snapshot.queryParamMap.get('tenantId') ?? '';

  readonly navQueryParams = { tenant: this.tenantSlug, tenantId: this.tenantId };
  readonly backLink: unknown[] = this.tenantId
    ? ['/tenants', this.tenantId, 'edit']
    : ['/tenants'];

  // Members section state.
  readonly members = this.membershipsService.members;
  readonly paging = this.membershipsService.paging;
  readonly loading = this.membershipsService.loading;
  readonly error = this.membershipsService.error;

  // Invitations section state.
  readonly invitations = this.membershipsService.invitations;
  readonly invitationsPaging = this.membershipsService.invitationsPaging;
  readonly invitationsLoading = this.membershipsService.invitationsLoading;
  readonly invitationsError = this.membershipsService.invitationsError;

  private readonly pageSize = 20;

  readonly roles = signal<RoleSummaryDto[]>([]);

  // Member filters.
  readonly memberSearchControl = new FormControl('', { nonNullable: true });
  readonly memberStatusControl = new FormControl('', { nonNullable: true });
  readonly memberRoleControl = new FormControl('', { nonNullable: true });

  // Invitation filters.
  readonly searchControl = new FormControl('', { nonNullable: true });
  /** '' = todas, 'false' = pendientes, 'true' = aceptadas. */
  readonly usedControl = new FormControl('', { nonNullable: true });
  readonly registeredControl = new FormControl('', { nonNullable: true });
  readonly expiredControl = new FormControl('', { nonNullable: true });
  readonly roleControl = new FormControl('', { nonNullable: true });

  readonly memberColumns: readonly TableColumn<MembershipDto>[] = [
    { header: 'Nombre', value: (m) => m.userName },
    { header: 'Teléfono', value: (m) => m.phone, class: 'text-secondary font-monospace' },
    { header: 'Rol', value: (m) => m.roleName, badgeClass: () => 'badge bg-blue-lt' },
    {
      header: 'Estado',
      value: (m) => MEMBERSHIP_STATUS_LABELS[m.status] ?? m.status,
      badgeClass: (m) => MEMBERSHIP_STATUS_BADGES[m.status] ?? 'badge',
    },
    {
      header: 'Invitado',
      value: (m) =>
        m.invitedAtUtc ? new Date(m.invitedAtUtc).toLocaleDateString('es') : '—',
    },
    {
      header: 'Se unió',
      value: (m) =>
        m.joinedAtUtc ? new Date(m.joinedAtUtc).toLocaleDateString('es') : '—',
    },
  ];

  readonly invitationColumns: readonly TableColumn<InvitationDto>[] = [
    { header: 'Teléfono', value: (i) => i.phone },
    { header: 'Correo', value: (i) => i.email || '—' },
    { header: 'Rol', value: (i) => i.roleName, badgeClass: () => 'badge bg-blue-lt' },
    {
      header: 'Estado',
      value: (i) => INVITATION_STATUS_LABELS[i.status] ?? i.status,
      badgeClass: (i) => INVITATION_STATUS_BADGES[i.status] ?? 'badge',
    },
    {
      header: 'Registrado',
      value: (i) => (i.isRegistered ? 'Sí' : 'No'),
      badgeClass: (i) => (i.isRegistered ? 'badge bg-green-lt' : 'badge bg-secondary-lt'),
    },
    {
      header: 'Expirada',
      value: (i) => (i.isExpired ? 'Sí' : 'No'),
      badgeClass: (i) => (i.isExpired ? 'badge bg-red-lt' : 'badge bg-secondary-lt'),
    },
    {
      header: 'Creada',
      value: (i) => new Date(i.createdAtUtc).toLocaleDateString('es'),
    },
    {
      header: 'Expira',
      value: (i) => new Date(i.expiresAtUtc).toLocaleDateString('es'),
    },
  ];

  readonly memberRowKey = (m: MembershipDto): string => m.userId;
  readonly invitationRowKey = (i: InvitationDto): string => i.id;

  constructor() {
    this.memberSearchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reloadMembers(1));

    for (const control of [this.memberStatusControl, this.memberRoleControl]) {
      control.valueChanges
        .pipe(distinctUntilChanged(), takeUntilDestroyed())
        .subscribe(() => this.reloadMembers(1));
    }

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reloadInvitations(1));

    for (const control of [
      this.usedControl,
      this.registeredControl,
      this.expiredControl,
      this.roleControl,
    ]) {
      control.valueChanges
        .pipe(distinctUntilChanged(), takeUntilDestroyed())
        .subscribe(() => this.reloadInvitations(1));
    }

    if (this.tenantSlug) {
      this.loadRoles();
      this.reloadMembers(1);
      this.reloadInvitations(1);
    }
  }

  onMembersPageChange(page: number): void {
    this.reloadMembers(page);
  }

  private reloadMembers(page: number): void {
    if (!this.tenantSlug) return;
    this.membershipsService.list(this.tenantSlug, page, this.pageSize, this.buildMemberFilters());
  }

  private buildMemberFilters(): MembershipFilters {
    const filters: MembershipFilters = {};
    const search = this.memberSearchControl.value.trim();
    if (search) filters.search = search;
    if (this.memberStatusControl.value) filters.status = this.memberStatusControl.value;
    if (this.memberRoleControl.value) filters.roleId = Number(this.memberRoleControl.value);
    return filters;
  }

  onInvitationsPageChange(page: number): void {
    this.reloadInvitations(page);
  }

  private reloadInvitations(page: number): void {
    if (!this.tenantSlug) return;
    this.membershipsService.listInvitations(
      this.tenantSlug,
      page,
      this.pageSize,
      this.buildInvitationFilters(),
    );
  }

  private buildInvitationFilters(): InvitationFilters {
    const filters: InvitationFilters = {};
    const search = this.searchControl.value.trim();
    if (search) filters.search = search;
    if (this.usedControl.value) filters.used = this.usedControl.value === 'true';
    if (this.registeredControl.value) filters.registered = this.registeredControl.value === 'true';
    if (this.expiredControl.value) filters.expired = this.expiredControl.value === 'true';
    if (this.roleControl.value) filters.roleId = Number(this.roleControl.value);
    return filters;
  }

  private loadRoles(): void {
    this.membershipsService.listRoles().subscribe({
      next: (roles) => this.roles.set(roles),
      error: () => { /* non-blocking: role filter just stays empty */ },
    });
  }
}
