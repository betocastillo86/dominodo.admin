import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../../../../environments/environment';

/**
 * Names the deployment the panel is talking to.
 *
 * The environment tint from `applyEnvTheme` is what catches the eye; this is what says
 * out loud which environment the colour means, so nobody has to remember the convention
 * — or read the URL — before editing a tenant.
 */
@Component({
  selector: 'app-env-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge text-bg-{{ tone }}" title="Ambiente">{{ name }}</span>`,
})
export class EnvBadgeComponent {
  readonly name = environment.envName;
  readonly tone = environment.envTone;
}
