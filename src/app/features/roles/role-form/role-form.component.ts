import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { SpinnerComponent } from '../../../shared/ui/spinner/spinner.component';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ProblemDetails } from '../../../core/http/problem-details';
import { RolesService } from '../data-access/roles.service';
import { PermissionsService } from '../data-access/permissions.service';
import { RoleScope } from '../data-access/role.models';
import { PermissionDto } from '../data-access/permission.models';

interface PermissionGroup {
  group: string;
  permissions: PermissionDto[];
}

/** Create or edit a role. Mode is resolved from the presence of `:id` in the route. */
@Component({
  selector: 'app-role-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    SpinnerComponent,
    TablerIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-form.component.html',
})
export class RoleFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rolesService = inject(RolesService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly notifications = inject(NotificationService);

  private readonly id = this.route.snapshot.paramMap.get('id');
  readonly mode: 'create' | 'edit' = this.id ? 'edit' : 'create';

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    description: new FormControl('', { nonNullable: true }),
    scope: new FormControl<RoleScope>('Tenant', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /** Selected permission ids, managed via toggle/isChecked helpers. */
  private readonly selectedPermissionIds = signal<Set<number>>(new Set());

  readonly permissionGroups = signal<PermissionGroup[]>([]);
  readonly loadingPermissions = signal(false);
  readonly loadingRole = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly readOnly = signal(false);
  /** True once the user has attempted to submit — gates the permissions error display. */
  readonly submitted = signal(false);

  readonly loading = computed(() => this.loadingPermissions() || this.loadingRole());
  /** At least one permission must be selected. */
  readonly hasPermissions = computed(() => this.selectedPermissionIds().size > 0);
  readonly permissionsInvalid = computed(() => this.submitted() && !this.hasPermissions());

  ngOnInit(): void {
    this.loadPermissions();

    if (this.mode === 'edit') {
      this.form.controls.scope.disable();
      this.loadRole(Number(this.id));
    }
  }

  isChecked(id: number): boolean {
    return this.selectedPermissionIds().has(id);
  }

  toggle(id: number): void {
    if (this.readOnly()) return;
    this.selectedPermissionIds.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  onSubmit(): void {
    if (this.readOnly()) return;
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.hasPermissions()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const raw = this.form.getRawValue();
    const name = raw.name.trim();
    const description = raw.description.trim() || null;
    const permissionIds = [...this.selectedPermissionIds()];

    if (this.mode === 'create') {
      this.rolesService
        .create({ name, description, scope: raw.scope, permissionIds })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Rol creado'),
          error: (err: unknown) => this.handleError(err),
        });
    } else {
      this.rolesService
        .update(Number(this.id), { name, description, permissionIds })
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => this.onSuccess('Rol actualizado'),
          error: (err: unknown) => this.handleError(err),
        });
    }
  }

  private loadPermissions(): void {
    this.loadingPermissions.set(true);
    this.permissionsService
      .list()
      .pipe(finalize(() => this.loadingPermissions.set(false)))
      .subscribe({
        next: (permissions) => this.permissionGroups.set(this.groupPermissions(permissions)),
        error: (err: unknown) => this.error.set(this.toMessage(err, 'No se pudieron cargar los permisos.')),
      });
  }

  private loadRole(id: number): void {
    this.loadingRole.set(true);
    this.rolesService
      .getById(id)
      .pipe(finalize(() => this.loadingRole.set(false)))
      .subscribe({
        next: (role) => {
          this.form.patchValue({
            name: role.name,
            description: role.description ?? '',
            scope: role.scope,
          });
          this.selectedPermissionIds.set(new Set(role.permissions.map((p) => p.id)));

          if (role.isSystem) {
            this.readOnly.set(true);
            this.form.disable();
          }
        },
        error: (err: unknown) => this.error.set(this.toMessage(err, 'No se pudo cargar el rol.')),
      });
  }

  private groupPermissions(permissions: PermissionDto[]): PermissionGroup[] {
    const map = new Map<string, PermissionDto[]>();
    for (const permission of permissions) {
      const list = map.get(permission.group) ?? [];
      list.push(permission);
      map.set(permission.group, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, perms]) => ({
        group,
        permissions: perms.sort((a, b) => a.code.localeCompare(b.code)),
      }));
  }

  private onSuccess(message: string): void {
    this.notifications.success(message);
    this.router.navigate(['/roles']);
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
        const message = problem?.detail ?? problem?.title ?? 'Ya existe un rol con ese nombre.';
        this.form.controls.name.setErrors({ server: message });
        this.error.set(message);
        return;
      }

      this.error.set(problem?.detail ?? problem?.title ?? 'No se pudo guardar el rol.');
      return;
    }
    this.error.set('No se pudo guardar el rol.');
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
