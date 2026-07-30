import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { UsersService } from '../data-access/users.service';
import { UserListItemDto, UserStatus } from '../data-access/user.models';

const STATUS_LABELS: Record<UserStatus, string> = {
  PendingVerification: 'Pendiente',
  Active: 'Activo',
  Disabled: 'Deshabilitado',
};

const STATUS_BADGE: Record<UserStatus, string> = {
  PendingVerification: 'badge bg-yellow-lt',
  Active: 'badge bg-green-lt',
  Disabled: 'badge bg-red-lt',
};

/** Read-only, server-paginated listing of users. */
@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './user-list.component.html',
})
export class UserListComponent {
  private readonly usersService = inject(UsersService);

  readonly users = this.usersService.users;
  readonly paging = this.usersService.paging;
  readonly loading = this.usersService.loading;
  readonly error = this.usersService.error;

  private readonly pageSize = 20;

  readonly nameControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<UserStatus | ''>('', { nonNullable: true });
  readonly tenantControl = new FormControl('', { nonNullable: true });

  readonly columns: readonly TableColumn<UserListItemDto>[] = [
    { header: 'Nombre', value: (u) => `${u.firstName} ${u.lastName}` },
    { header: 'Teléfono', value: (u) => u.phone, class: 'text-secondary' },
    { header: 'Email', value: (u) => u.email ?? '—', class: 'text-secondary' },
    {
      header: 'Estado',
      value: (u) => STATUS_LABELS[u.status] ?? u.status,
      badgeClass: (u) => STATUS_BADGE[u.status] ?? '',
    },
    {
      header: 'Tel. verificado',
      value: (u) => (u.phoneVerified ? 'Sí' : 'No'),
      badgeClass: (u) => (u.phoneVerified ? 'badge bg-green-lt' : ''),
    },
    { header: 'Registro', value: (u) => this.formatDate(u.createdAtUtc), class: 'text-secondary' },
  ];

  readonly rowKey = (user: UserListItemDto): string => user.id;
  readonly editLink = (user: UserListItemDto): unknown[] => ['/users', user.id, 'edit'];

  constructor() {
    this.nameControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.statusControl.valueChanges.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.tenantControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.reload(1);
  }

  onPageChange(page: number): void {
    this.reload(page);
  }

  private reload(page: number): void {
    const name = this.nameControl.value || undefined;
    const status = (this.statusControl.value as UserStatus) || undefined;
    const tenantId = this.tenantControl.value || undefined;
    this.usersService.list(page, this.pageSize, name, status, tenantId);
  }

  private formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString('es');
  }
}
