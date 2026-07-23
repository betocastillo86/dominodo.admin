import { Routes } from '@angular/router';

export const systemSettingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./system-setting-list/system-setting-list.component').then(
        (m) => m.SystemSettingListComponent,
      ),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./system-setting-form/system-setting-form.component').then(
        (m) => m.SystemSettingFormComponent,
      ),
  },
  {
    path: ':key/edit',
    loadComponent: () =>
      import('./system-setting-form/system-setting-form.component').then(
        (m) => m.SystemSettingFormComponent,
      ),
  },
];
