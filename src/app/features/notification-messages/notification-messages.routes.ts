import { Routes } from '@angular/router';

export const notificationMessagesRoutes: Routes = [
  {
    path: 'email',
    loadComponent: () =>
      import('./email-message-list/email-message-list.component').then(
        (m) => m.EmailMessageListComponent,
      ),
  },
  {
    path: 'email/:id',
    loadComponent: () =>
      import('./email-message-detail/email-message-detail.component').then(
        (m) => m.EmailMessageDetailComponent,
      ),
  },
  {
    path: 'push',
    loadComponent: () =>
      import('./push-message-list/push-message-list.component').then(
        (m) => m.PushMessageListComponent,
      ),
  },
  {
    path: 'push/:id',
    loadComponent: () =>
      import('./push-message-detail/push-message-detail.component').then(
        (m) => m.PushMessageDetailComponent,
      ),
  },
  {
    path: 'in-app',
    loadComponent: () =>
      import('./in-app-message-list/in-app-message-list.component').then(
        (m) => m.InAppMessageListComponent,
      ),
  },
  {
    path: 'in-app/:id',
    loadComponent: () =>
      import('./in-app-message-detail/in-app-message-detail.component').then(
        (m) => m.InAppMessageDetailComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'email' },
];
