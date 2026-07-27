import { Routes } from '@angular/router';

export const requestCategoriesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./request-category-list/request-category-list.component').then(
        (m) => m.RequestCategoryListComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./request-category-form/request-category-form.component').then(
        (m) => m.RequestCategoryFormComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./request-category-form/request-category-form.component').then(
        (m) => m.RequestCategoryFormComponent,
      ),
  },
];
