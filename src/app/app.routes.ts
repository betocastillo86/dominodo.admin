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
      { path: '', pathMatch: 'full', redirectTo: 'roles' },
    ],
  },
  { path: '**', redirectTo: '' },
];
