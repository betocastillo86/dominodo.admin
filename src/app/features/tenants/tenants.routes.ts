import { Routes } from '@angular/router';

export const tenantsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tenant-list/tenant-list.component').then((m) => m.TenantListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./tenant-form/tenant-form.component').then((m) => m.TenantFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./tenant-form/tenant-form.component').then((m) => m.TenantFormComponent),
  },
];
