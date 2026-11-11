import { Routes } from '@angular/router';

export const chatFeedbackRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./chat-feedback-list/chat-feedback-list.component').then(
        (m) => m.ChatFeedbackListComponent,
      ),
  },
];
