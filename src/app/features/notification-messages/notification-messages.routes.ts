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
    path: 'push',
    loadComponent: () =>
      import('./push-message-list/push-message-list.component').then(
        (m) => m.PushMessageListComponent,
      ),
  },
  {
    path: 'in-app',
    loadComponent: () =>
      import('./in-app-message-list/in-app-message-list.component').then(
        (m) => m.InAppMessageListComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'email' },
];
