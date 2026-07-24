import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.authRoutes),
  },
  {
    path: '',
    canActivate: [authGuard, superAdminGuard],
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'roles',
        loadChildren: () => import('./features/roles/roles.routes').then((m) => m.rolesRoutes),
      },
      {
        path: 'tenants',
        loadChildren: () =>
          import('./features/tenants/tenants.routes').then((m) => m.tenantsRoutes),
      },
      {
        path: 'apartments',
        loadChildren: () =>
          import('./features/apartments/apartments.routes').then((m) => m.apartmentsRoutes),
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.usersRoutes),
      },
      {
        path: 'system-settings',
        loadChildren: () =>
          import('./features/system-settings/system-settings.routes').then(
            (m) => m.systemSettingsRoutes,
          ),
      },
      {
        path: 'notification-templates',
        loadChildren: () =>
          import('./features/notification-templates/notification-templates.routes').then(
            (m) => m.notificationTemplatesRoutes,
          ),
      },
      {
        path: 'notification-messages',
        loadChildren: () =>
          import('./features/notification-messages/notification-messages.routes').then(
            (m) => m.notificationMessagesRoutes,
          ),
      },
      {
        path: 'memberships',
        loadChildren: () =>
          import('./features/memberships/memberships.routes').then((m) => m.membershipsRoutes),
      },
      { path: '', pathMatch: 'full', redirectTo: 'roles' },
    ],
  },
  { path: '**', redirectTo: '' },
];
