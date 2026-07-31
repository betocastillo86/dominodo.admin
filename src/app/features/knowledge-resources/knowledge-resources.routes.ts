import { Routes } from '@angular/router';

export const knowledgeResourcesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./knowledge-resource-list/knowledge-resource-list.component').then(
        (m) => m.KnowledgeResourceListComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./knowledge-resource-form/knowledge-resource-form.component').then(
        (m) => m.KnowledgeResourceFormComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./knowledge-resource-form/knowledge-resource-form.component').then(
        (m) => m.KnowledgeResourceFormComponent,
      ),
  },
];
