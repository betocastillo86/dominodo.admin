import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { DataTableComponent, TableColumn } from '../../../shared/ui/data-table/data-table.component';
import { RolesService } from '../data-access/roles.service';
import { RoleDto, RoleScope } from '../data-access/role.models';

/** Read-only, server-paginated listing of roles. */
@Component({
  selector: 'app-role-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-list.component.html',
})
export class RoleListComponent {
  private readonly rolesService = inject(RolesService);

  readonly roles = this.rolesService.roles;
  readonly paging = this.rolesService.paging;
  readonly loading = this.rolesService.loading;
  readonly error = this.rolesService.error;

  private readonly pageSize = 20;

  readonly nameControl = new FormControl('', { nonNullable: true });
  readonly scopeControl = new FormControl<RoleScope | ''>('', { nonNullable: true });

  readonly columns: readonly TableColumn<RoleDto>[] = [
    { header: 'ID', value: (r) => r.id, class: 'text-secondary w-1' },
    { header: 'Nombre', value: (r) => r.name },
    {
      header: 'Scope',
      value: (r) => (r.scope === 'Platform' ? 'Plataforma' : 'Tenant'),
      badgeClass: (r) => (r.scope === 'Platform' ? 'badge bg-blue-lt' : 'badge bg-green-lt'),
    },
    { header: 'Descripción', value: (r) => r.description ?? '—' },
    {
      header: 'Sistema',
      value: (r) => (r.isSystem ? 'Sistema' : '—'),
      badgeClass: (r) => (r.isSystem ? 'badge bg-purple-lt' : ''),
    },
    { header: '# permisos', value: (r) => r.permissionIds.length, class: 'text-end' },
  ];

  readonly rowKey = (role: RoleDto): number => role.id;

  constructor() {
    this.nameControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(),
    ).subscribe(() => this.reload(1));

    this.scopeControl.valueChanges.pipe(
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
    const scope = (this.scopeControl.value as RoleScope) || undefined;
    this.rolesService.list(page, this.pageSize, name, scope);
  }
}
