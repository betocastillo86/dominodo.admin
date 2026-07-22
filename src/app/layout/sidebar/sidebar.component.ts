import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TablerIconComponent } from 'angular-tabler-icons';

interface NavItem {
  label: string;
  path: string;
  icon: string;
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

  readonly navItems: readonly NavItem[] = [
    { label: 'Roles', path: '/roles', icon: 'shield-lock' },
  ];

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
