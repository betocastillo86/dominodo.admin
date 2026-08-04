import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TablerIconComponent } from 'angular-tabler-icons';

interface NavChild {
  label: string;
  path: string;
}

interface NavItem {
  label: string;
  /** Leaf items link to `path`; grouping items omit it and provide `children`. */
  path?: string;
  icon: string;
  children?: NavChild[];
}

/** Tabler vertical sidebar with the panel's navigation items. */
@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'navbar navbar-vertical navbar-expand-lg',
    'data-bs-theme': 'dark',
  },
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  /** Mobile collapse state (avoids depending on Bootstrap's JS). */
  readonly menuOpen = signal(false);
  /** Labels of expanded nav groups (avoids depending on Bootstrap's JS). */
  private readonly openGroups = signal<Set<string>>(new Set(['Notificaciones', 'Solicitudes']));

  readonly navItems: readonly NavItem[] = [
    { label: 'Roles', path: '/roles', icon: 'shield-lock' },
    { label: 'Conjuntos', path: '/tenants', icon: 'building-community' },
    { label: 'Usuarios', path: '/users', icon: 'user' },
    { label: 'Anuncios', path: '/announcements', icon: 'speakerphone' },
    { label: 'Base de conocimiento', path: '/knowledge-resources', icon: 'book' },
    {
      label: 'Solicitudes',
      icon: 'list-details',
      children: [
        { label: 'Lista', path: '/requests' },
        { label: 'Categorías', path: '/request-categories' },
      ],
    },
    { label: 'Publicaciones', path: '/listings', icon: 'building-store' },
    { label: 'Configuración', path: '/system-settings', icon: 'settings' },
    {
      label: 'Notificaciones',
      icon: 'bell',
      children: [
        { label: 'Plantillas', path: '/notification-templates' },
        { label: 'Correos', path: '/notification-messages/email' },
        { label: 'Push', path: '/notification-messages/push' },
        { label: 'En la app', path: '/notification-messages/in-app' },
      ],
    },
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  isGroupOpen(label: string): boolean {
    return this.openGroups().has(label);
  }

  toggleGroup(label: string): void {
    this.openGroups.update((set) => {
      const next = new Set(set);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }
}
