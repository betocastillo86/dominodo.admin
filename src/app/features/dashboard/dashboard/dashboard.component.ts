import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import { HealthService } from '../data-access/health.service';
import { HealthState, HealthTargetKey } from '../data-access/health.models';

/** How each state is painted: yellow while checking, green when up, red when down. */
const STATE_UI: Record<HealthState, { stateLabel: string; statusClass: string; stripe: string }> = {
  checking: { stateLabel: 'Revisando…', statusClass: 'status-yellow', stripe: 'bg-yellow' },
  healthy: { stateLabel: 'Operativo', statusClass: 'status-green', stripe: 'bg-green' },
  down: { stateLabel: 'No disponible', statusClass: 'status-red', stripe: 'bg-red' },
};

const SERVICE_ICON: Record<HealthTargetKey, string> = {
  api: 'server',
  domi: 'message-chatbot',
};

/**
 * Default screen of the panel. Today it holds a single widget — the live status of the API and of
 * Domi — because both run on free App Service plans that sleep when idle, and an operator opening
 * the panel needs to know (and, by probing, wake up) what is actually running.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [PageHeaderComponent, TablerIconComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly health = inject(HealthService);

  /** Each target with its live status and its presentation, ready for the template. */
  readonly services = computed(() =>
    this.health.targets.map((target) => {
      const status = this.health.statusOf(target.key)();
      return { ...target, status, icon: SERVICE_ICON[target.key], ...STATE_UI[status.state] };
    }),
  );

  /** Drives the cold-start hint: only worth saying while something is not answering. */
  readonly anyDown = computed(() => this.services().some((s) => s.status.state === 'down'));

  constructor() {
    this.health.start();
    // The poll belongs to this screen: leaving it stops the requests.
    inject(DestroyRef).onDestroy(() => this.health.stop());
  }

  refresh(): void {
    this.health.refresh();
  }
}
