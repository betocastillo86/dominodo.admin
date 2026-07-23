import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTablerIcons } from 'angular-tabler-icons';
import {
  IconBuildingCommunity,
  IconEdit,
  IconInfoCircle,
  IconLogout,
  IconMenu2,
  IconSettings,
  IconShieldLock,
  IconUser,
  IconUserCircle,
} from 'angular-tabler-icons/icons';

import { routes } from './app.routes';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // Icons used across the app are registered here; add more as features need them.
    provideTablerIcons({ IconShieldLock, IconUserCircle, IconLogout, IconMenu2, IconEdit, IconInfoCircle, IconSettings, IconUser, IconBuildingCommunity }),
  ],
};
