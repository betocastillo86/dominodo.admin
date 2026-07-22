import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TablerIconComponent } from 'angular-tabler-icons';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';

/** Top navbar: shows the signed-in user and a logout action. */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [NgbDropdownModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'navbar navbar-expand-md d-print-none',
  },
  templateUrl: './navbar.component.html',
})
export class NavbarComponent {
  private readonly auth = inject(AuthService);
  readonly store = inject(AuthStore);

  logout(): void {
    this.auth.logout().subscribe();
  }
}
