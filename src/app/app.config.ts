import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideTablerIcons } from 'angular-tabler-icons';
import {
  IconAlertCircle,
  IconApps,
  IconBell,
  IconBook,
  IconBrandWhatsapp,
  IconBuildingCommunity,
  IconBuildingStore,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconCopy,
  IconDeviceMobile,
  IconDownload,
  IconEdit,
  IconEye,
  IconInfoCircle,
  IconListDetails,
  IconLogout,
  IconMail,
  IconMenu2,
  IconMessageChatbot,
  IconMessagePlus,
  IconMessages,
  IconPlus,
  IconRefresh,
  IconSend,
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
      IconSpeakerphone,
      IconBook,
      IconBuildingStore,
      IconUserCircle,
      IconLogout,
      IconMenu2,
      IconEdit,
      IconEye,
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
      IconBrandWhatsapp,
      IconTrash,
      IconPlus,
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
