import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TablerIconComponent } from 'angular-tabler-icons';
import { VersionCheckService } from '../../../core/version/version-check.service';

/**
 * Sticky notice shown when a new release was published while the user had the
 * app open. Deliberately a prompt, not a forced reload: the user may be halfway
 * through a form, and losing that to an automatic refresh is worse than running
 * the previous build for another minute.
 */
@Component({
  selector: 'app-version-banner',
  standalone: true,
  imports: [TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (versions.updateAvailable()) {
      <div class="alert alert-info alert-important m-0 rounded-0 border-0 d-print-none">
        <div class="container-xl d-flex align-items-center gap-2">
          <tabler-icon name="refresh"></tabler-icon>
          <span class="flex-fill">Hay una versión nueva disponible.</span>
          <button type="button" class="btn btn-sm btn-white" (click)="versions.reload()">
            Actualizar ahora
          </button>
        </div>
      </div>
    }
  `,
})
export class VersionBannerComponent {
  readonly versions = inject(VersionCheckService);

  constructor() {
    this.versions.start();
  }
}
