import { Routes } from '@angular/router';

export const listingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./listing-list/listing-list.component').then((m) => m.ListingListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./listing-form/listing-form.component').then((m) => m.ListingFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./listing-form/listing-form.component').then((m) => m.ListingFormComponent),
  },
];
