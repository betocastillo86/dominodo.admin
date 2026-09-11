import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TablerIconComponent } from 'angular-tabler-icons';
import { PageHeaderComponent } from '../../../shared/ui/page-header/page-header.component';
import {
  HEALTH_STATE_UI,
  ServiceStatusComponent,
} from '../../../shared/ui/service-status/service-status.component';
import { HealthService } from '../../../core/health/health.service';
import { HealthTargetKey } from '../../../core/health/health.models';

const SERVICE_ICON: Record<HealthTargetKey, string> = {
  api: 'server',
  domi: 'message-chatbot',
};

/**
 * Default screen of the panel. Today it holds a single widget — the live status of the API and of
 * Domi — because both run on free App Service plans that sleep when idle, and an operator opening
 * the panel needs to know (and, by probing, wake up) what is actually running.
 *
 * The same status is shown on the login screen, in a stripped-down strip: an API that is down is
 * exactly what keeps a user from ever reaching this page.
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [PageHeaderComponent, ServiceStatusComponent, TablerIconComponent, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly health = inject(HealthService);

  /** Each target with its live status and the card's chrome, ready for the template. */
  readonly services = computed(() =>
    this.health.snapshot().map((service) => ({
      ...service,
      icon: SERVICE_ICON[service.key],
      stripe: HEALTH_STATE_UI[service.status.state].stripe,
    })),
  );

  /** Drives the cold-start hint: only worth saying while something is not answering. */
  readonly anyDown = computed(() => this.services().some((s) => s.status.state === 'down'));

  constructor() {
    this.health.start();
    // The poll belongs to this screen: leaving it releases the watch.
    inject(DestroyRef).onDestroy(() => this.health.stop());
  }

  refresh(): void {
    this.health.refresh();
  }
}
