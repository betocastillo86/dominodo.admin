import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HealthState } from '../../../core/health/health.models';

/**
 * State → Spanish label + Tabler colors. Shared so the login strip and the dashboard cards can
 * never drift into naming or coloring the same state differently.
 */
export const HEALTH_STATE_UI: Record<
  HealthState,
  { label: string; statusClass: string; stripe: string }
> = {
  checking: { label: 'Revisando…', statusClass: 'status-yellow', stripe: 'bg-yellow' },
  healthy: { label: 'Operativo', statusClass: 'status-green', stripe: 'bg-green' },
  down: { label: 'No disponible', statusClass: 'status-red', stripe: 'bg-red' },
};

/** The colored status pill — the one piece both screens render identically. */
@Component({
  selector: 'app-service-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="status {{ ui().statusClass }}">
      <span class="status-dot" [class.status-dot-animated]="state() === 'checking'"></span>
      {{ ui().label }}
    </span>
  `,
})
export class ServiceStatusComponent {
  readonly state = input.required<HealthState>();

  protected readonly ui = computed(() => HEALTH_STATE_UI[this.state()]);
}
