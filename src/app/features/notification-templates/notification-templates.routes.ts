import { Routes } from '@angular/router';

export const notificationTemplatesRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./notification-template-list/notification-template-list.component').then(
        (m) => m.NotificationTemplateListComponent,
      ),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./notification-template-form/notification-template-form.component').then(
        (m) => m.NotificationTemplateFormComponent,
      ),
  },
];
