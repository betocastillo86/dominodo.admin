import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { TablerIconComponent } from 'angular-tabler-icons';

/** A selectable option for {@link MultiSelectComponent}. */
export interface MultiSelectOption {
  value: string;
  label: string;
}

/**
 * Tabler-styled multi-select filter: a dropdown button (ng-bootstrap `NgbDropdown`)
 * whose menu holds a checkbox per option. Implements `ControlValueAccessor` so it
 * binds to a `FormControl<string[]>` like any native control.
 *
 * No extra JS dependency (Tabler's own multi-select relies on Tom Select); this is
 * the checkbox-dropdown pattern from Tabler's docs driven by ng-bootstrap + Popper.
 */
@Component({
  selector: 'app-multi-select',
  standalone: true,
  imports: [NgbDropdownModule, TablerIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MultiSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div ngbDropdown class="d-inline-block w-100" autoClose="outside">
      <button
        type="button"
        class="form-select text-start d-flex align-items-center"
        [class.text-secondary]="selected().size === 0"
        [disabled]="isDisabled()"
        ngbDropdownToggle
      >
        <span class="text-truncate flex-fill">{{ buttonLabel() }}</span>
        @if (selected().size > 0) {
          <span class="badge bg-primary-lt ms-2">{{ selected().size }}</span>
        }
      </button>

      <div ngbDropdownMenu class="w-100 p-0" style="max-height: 20rem; overflow-y: auto;">
        @if (selected().size > 0) {
          <button type="button" class="dropdown-item text-secondary border-bottom" (click)="clear()">
            <i-tabler name="x" class="icon me-1"></i-tabler>
            Limpiar selección
          </button>
        }
        @for (opt of options(); track opt.value) {
          <label class="dropdown-item d-flex align-items-center gap-2 mb-0" style="cursor: pointer;">
            <input
              type="checkbox"
              class="form-check-input m-0"
              [checked]="selected().has(opt.value)"
              (change)="toggle(opt.value)"
            />
            <span>{{ opt.label }}</span>
          </label>
        } @empty {
          <div class="dropdown-item text-secondary">{{ emptyText() }}</div>
        }
      </div>
    </div>
  `,
})
export class MultiSelectComponent implements ControlValueAccessor {
  /** The options offered in the dropdown. */
  readonly options = input.required<readonly MultiSelectOption[]>();
  /** Text shown on the button when nothing is selected. */
  readonly placeholder = input('Seleccionar…');
  /** Text shown inside the menu when there are no options. */
  readonly emptyText = input('Sin opciones');

  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly isDisabled = signal(false);

  /** Button caption: placeholder when empty, otherwise the selected labels joined. */
  protected readonly buttonLabel = computed(() => {
    const set = this.selected();
    if (set.size === 0) return this.placeholder();
    return this.options()
      .filter((o) => set.has(o.value))
      .map((o) => o.label)
      .join(', ');
  });

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  toggle(value: string): void {
    const next = new Set(this.selected());
    next.has(value) ? next.delete(value) : next.add(value);
    this.selected.set(next);
    this.onChange([...next]);
    this.onTouched();
  }

  clear(): void {
    this.selected.set(new Set());
    this.onChange([]);
    this.onTouched();
  }

  // --- ControlValueAccessor ---
  writeValue(value: string[] | null): void {
    this.selected.set(new Set(value ?? []));
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }
}
