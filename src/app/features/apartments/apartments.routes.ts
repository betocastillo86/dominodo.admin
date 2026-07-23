import { Routes } from '@angular/router';

export const apartmentsRoutes: Routes = [
  {
    path: 'new',
    loadComponent: () =>
      import('./apartment-form/apartment-form.component').then((m) => m.ApartmentFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./apartment-form/apartment-form.component').then((m) => m.ApartmentFormComponent),
  },
];
