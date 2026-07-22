import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tabler page header: a title (with optional pretitle) and an optional slot
 * for page-level actions projected via `[actions]`.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header d-print-none">
      <div class="container-xl">
        <div class="row g-2 align-items-center">
          <div class="col">
            @if (pretitle()) {
              <div class="page-pretitle">{{ pretitle() }}</div>
            }
            <h2 class="page-title">{{ title() }}</h2>
          </div>
          <div class="col-auto ms-auto d-print-none">
            <ng-content select="[actions]"></ng-content>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  /** Main heading shown in the page header. */
  readonly title = input.required<string>();
  /** Optional small text shown above the title. */
  readonly pretitle = input<string>();
}
