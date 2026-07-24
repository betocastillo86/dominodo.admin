import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTablerIcons } from 'angular-tabler-icons';
import {
  IconApps,
  IconBell,
  IconBuildingCommunity,
  IconChevronRight,
  IconDeviceMobile,
  IconEdit,
  IconInfoCircle,
  IconLogout,
  IconMail,
  IconMenu2,
  IconSettings,
  IconShieldLock,
  IconUser,
  IconUserCircle,
  IconUserPlus,
} from 'angular-tabler-icons/icons';
import { provideQuillConfig } from 'ngx-quill';

import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // Icons used across the app are registered here; add more as features need them.
    provideTablerIcons({
      IconShieldLock,
      IconUserCircle,
      IconLogout,
      IconMenu2,
      IconEdit,
      IconInfoCircle,
      IconSettings,
      IconUser,
      IconBuildingCommunity,
      IconBell,
      IconChevronRight,
      IconMail,
      IconDeviceMobile,
      IconApps,
      IconUserPlus,
    }),
    // WYSIWYG editor (notification-templates email body). Toolbar kept intentionally small.
    provideQuillConfig({
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link'],
          ['clean'],
        ],
      },
    }),
  ],
};
