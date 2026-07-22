import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Small presentational loading indicator using the Tabler/Bootstrap spinner.
 * Centered within its host by default.
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex justify-content-center align-items-center py-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">{{ label() }}</span>
      </div>
    </div>
  `,
})
export class SpinnerComponent {
  /** Accessible label announced to screen readers. */
  readonly label = input('Cargando…');
}
