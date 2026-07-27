import { Routes } from '@angular/router';

export const requestsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./request-list/request-list.component').then((m) => m.RequestListComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./request-detail/request-detail.component').then((m) => m.RequestDetailComponent),
  },
];
