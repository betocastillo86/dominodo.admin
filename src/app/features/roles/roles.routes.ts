import { Routes } from '@angular/router';

export const rolesRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./role-list/role-list.component').then((m) => m.RoleListComponent),
  },
];
