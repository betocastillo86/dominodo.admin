import { Routes } from '@angular/router';

/** Public auth area — a blank (shell-less) centered layout hosting login. */
export const authRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./login/login.component').then((m) => m.LoginComponent),
  },
];
