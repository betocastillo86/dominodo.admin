import { Routes } from '@angular/router';

export const membershipsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./membership-list/membership-list.component').then(
        (m) => m.MembershipListComponent,
      ),
  },
  {
    path: 'invite',
    loadComponent: () =>
      import('./membership-invite/membership-invite.component').then(
        (m) => m.MembershipInviteComponent,
      ),
  },
];
