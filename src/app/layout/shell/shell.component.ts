import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

/** Authenticated panel shell: Tabler sidebar + navbar around the routed content. */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-sidebar />
      <app-navbar />
      <div class="page-wrapper">
        <div class="page-body">
          <div class="container-xl">
            <router-outlet />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ShellComponent {}
