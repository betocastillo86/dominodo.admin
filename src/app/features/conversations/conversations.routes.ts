import { Routes } from '@angular/router';

export const conversationsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./conversation-list/conversation-list.component').then(
        (m) => m.ConversationListComponent,
      ),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./conversation-detail/conversation-detail.component').then(
        (m) => m.ConversationDetailComponent,
      ),
  },
];
