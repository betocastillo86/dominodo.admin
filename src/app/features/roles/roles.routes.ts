import { Routes } from '@angular/router';

export const rolesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./role-list/role-list.component').then((m) => m.RoleListComponent),
  },
  {
    path: 'new',
    loadComponent: () => import('./role-form/role-form.component').then((m) => m.RoleFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./role-form/role-form.component').then((m) => m.RoleFormComponent),
  },
];
