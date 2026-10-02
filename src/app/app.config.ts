import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTablerIcons } from 'angular-tabler-icons';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconApps,
  IconBell,
  IconBook,
  IconBrandWhatsapp,
  IconBuildingCommunity,
  IconBuildingStore,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconClock,
  IconCopy,
  IconDeviceMobile,
  IconDownload,
  IconEdit,
  IconExternalLink,
  IconEye,
  IconFilterOff,
  IconHistory,
  IconInfoCircle,
  IconKey,
  IconLayoutDashboard,
  IconListDetails,
  IconLogout,
  IconMail,
  IconMenu2,
  IconMessageChatbot,
  IconMessagePlus,
  IconMessages,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRefresh,
  IconSend,
  IconServer,
  IconSettings,
  IconShieldLock,
  IconSpeakerphone,
  IconTrash,
  IconUpload,
  IconUser,
  IconUserCircle,
  IconUserPlus,
  IconVariable,
  IconX,
} from 'angular-tabler-icons/icons';
import { provideQuillConfig } from 'ngx-quill';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { AuthStore } from './core/auth/auth.store';
import { authInterceptor } from './core/http/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // A session rehydrated from storage carries no permissions — they are not in the JWT — so the
    // panel asks the API for them on boot. Deliberately not awaited: the gated UI is driven by a
    // signal and appears when the answer lands, and a slow or down API must not hold up bootstrap.
    provideAppInitializer(() => {
      const store = inject(AuthStore);
      const auth = inject(AuthService);
      if (store.isAuthenticated()) {
        auth.loadCurrentUser().subscribe({ error: () => undefined });
      }
    }),
    // Icons used across the app are registered here; add more as features need them.
    provideTablerIcons({
      IconShieldLock,
      IconLayoutDashboard,
      IconServer,
      IconSpeakerphone,
      IconBook,
      IconBuildingStore,
      IconUserCircle,
      IconLogout,
      IconMenu2,
      IconEdit,
      IconEye,
      IconExternalLink,
      IconFilterOff,
      IconInfoCircle,
      IconKey,
      IconSettings,
      IconUser,
      IconBuildingCommunity,
      IconBell,
      IconChevronRight,
      IconChevronDown,
      IconChevronUp,
      IconMail,
      IconDeviceMobile,
      IconApps,
      IconUserPlus,
      IconListDetails,
      IconVariable,
      IconX,
      IconDownload,
      IconUpload,
      IconMessageChatbot,
      IconMessagePlus,
      IconMessages,
      IconRefresh,
      IconSend,
      IconClock,
      IconCopy,
      IconCheck,
      IconAlertCircle,
      IconAlertTriangle,
      IconBrandWhatsapp,
      IconTrash,
      IconPlus,
      IconHistory,
      IconPlayerPause,
      IconPlayerPlay,
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
