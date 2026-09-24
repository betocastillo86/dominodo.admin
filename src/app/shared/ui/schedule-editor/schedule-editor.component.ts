import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TablerIconComponent } from 'angular-tabler-icons';
import {
  formatRanges,
  formatSchedule,
  HOLIDAY_KEY,
  isRangeValid,
  MAX_RANGES_PER_DAY,
  MAX_SERIALIZED_LENGTH,
  overlappingIndexes,
  parseSchedule,
  SCHEDULE_ENTRIES,
  ScheduleEntry,
  ScheduleKey,
  serializeSchedule,
  TimeRange,
  WeeklySchedule,
} from './schedule.model';

/** Range applied when a day is switched on with no hours yet. */
const DEFAULT_RANGE: TimeRange = { from: '08:00', to: '17:00' };

/**
 * Weekly opening-hours editor. Writes the JSON envelope described in
 * `schedule.model.ts` through `ControlValueAccessor`, so a parent form binds it
 * with a plain `formControlName` over a `string`.
 *
 * Tenants created before this editor existed hold free-text hours in the same
 * column, so a stored value that is not our envelope is surfaced read-only via
 * `previousText` — the admin sees what the save will replace instead of losing
 * it silently. Hours can only be entered as slots.
 *
 * Built from stock Tabler pieces: `form-check form-switch` per day,
 * `card`/`card-active` rows and `btn-icon btn-ghost-*` for the row actions.
 */
@Component({
  selector: 'app-schedule-editor',
  standalone: true,
  imports: [TablerIconComponent, NgbDropdownModule, NgbTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-editor.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ScheduleEditorComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => ScheduleEditorComponent),
      multi: true,
    },
  ],
})
export class ScheduleEditorComponent implements ControlValueAccessor, Validator {
  /** Surfaces validation messages only once the parent form was submitted. */
  readonly showErrors = input(false);

  /** The seven weekdays plus the holidays row, in render order. */
  readonly entries = SCHEDULE_ENTRIES;
  readonly holidayKey = HOLIDAY_KEY;
  readonly maxRangesPerDay = MAX_RANGES_PER_DAY;

  readonly schedule = signal<WeeklySchedule>({});
  readonly expanded = signal<ScheduleKey | null>(null);
  readonly disabled = signal(false);

  /**
   * The stored value when it was legacy free text instead of our envelope.
   * Shown read-only so the admin knows what saving will replace.
   */
  readonly previousText = signal('');

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  /** Human-readable preview of the current schedule, shown under the editor. */
  readonly preview = computed(() => formatSchedule(this.schedule()));

  readonly openDayCount = computed(
    () => Object.values(this.schedule()).filter((ranges) => ranges?.length).length,
  );

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: string | null): void {
    const parsed = parseSchedule(value);

    if (parsed) {
      this.schedule.set(parsed);
      this.previousText.set('');
      return;
    }

    // Not our envelope: either empty (fresh start) or legacy free text, which we
    // keep on screen so the replacement is a conscious act.
    this.schedule.set({});
    this.previousText.set(value?.trim() ?? '');
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // --- Validator ------------------------------------------------------------

  validate(_control: AbstractControl): ValidationErrors | null {
    if (this.openDayCount() === 0) return { required: true };

    for (const entry of SCHEDULE_ENTRIES) {
      const ranges = this.schedule()[entry.key] ?? [];
      if (ranges.some((range) => !isRangeValid(range))) {
        return { invalidRange: true };
      }
      if (overlappingIndexes(ranges).size > 0) {
        return { overlappingRanges: true };
      }
    }

    if (serializeSchedule(this.schedule()).length > MAX_SERIALIZED_LENGTH) {
      return { maxlength: true };
    }

    return null;
  }

  // --- Day rows -------------------------------------------------------------

  isOpen(key: ScheduleKey): boolean {
    return (this.schedule()[key]?.length ?? 0) > 0;
  }

  rangesFor(key: ScheduleKey): readonly TimeRange[] {
    return this.schedule()[key] ?? [];
  }

  summaryFor(key: ScheduleKey): string {
    return formatRanges(this.rangesFor(key));
  }

  toggleDay(key: ScheduleKey): void {
    if (this.disabled()) return;

    if (this.isOpen(key)) {
      this.mutate((draft) => delete draft[key]);
      if (this.expanded() === key) this.expanded.set(null);
    } else {
      this.mutate((draft) => {
        draft[key] = [{ ...DEFAULT_RANGE }];
      });
      this.expanded.set(key);
    }
    this.onTouched();
  }

  toggleExpanded(key: ScheduleKey): void {
    if (!this.isOpen(key)) return;
    this.expanded.update((current) => (current === key ? null : key));
  }

  addRange(key: ScheduleKey): void {
    if (this.disabled()) return;
    const ranges = this.rangesFor(key);
    if (ranges.length >= MAX_RANGES_PER_DAY) return;

    // Start the new slot after the last one so the common case needs no edit.
    const last = ranges.at(-1);
    const next: TimeRange = last ? { from: last.to, to: laterThan(last.to) } : { ...DEFAULT_RANGE };

    this.mutate((draft) => {
      draft[key] = [...(draft[key] ?? []), next];
    });
    this.onTouched();
  }

  removeRange(key: ScheduleKey, index: number): void {
    if (this.disabled()) return;
    this.mutate((draft) => {
      const remaining = (draft[key] ?? []).filter((_, i) => i !== index);
      if (remaining.length) {
        draft[key] = remaining;
      } else {
        // Removing the last range closes the day — same meaning as the switch.
        delete draft[key];
      }
    });
    this.onTouched();
  }

  updateRange(key: ScheduleKey, index: number, edge: 'from' | 'to', value: string): void {
    if (this.disabled()) return;
    this.mutate((draft) => {
      const ranges = [...(draft[key] ?? [])];
      if (!ranges[index]) return;
      ranges[index] = { ...ranges[index], [edge]: value };
      draft[key] = ranges;
    });
    this.onTouched();
  }

  /** Replace `target`'s hours with `source`'s (the copy action in the day row). */
  copyDayTo(source: ScheduleKey, target: ScheduleKey): void {
    if (this.disabled() || source === target) return;
    this.mutate((draft) => {
      draft[target] = (draft[source] ?? []).map((range) => ({ ...range }));
    });
    this.onTouched();
  }

  /** Every other row (holidays included), used by the copy dropdown. */
  otherEntries(key: ScheduleKey): readonly ScheduleEntry[] {
    return SCHEDULE_ENTRIES.filter((entry) => entry.key !== key);
  }

  isRangeInvalid(key: ScheduleKey, index: number): boolean {
    const range = this.rangesFor(key)[index];
    if (!range) return false;
    return !isRangeValid(range) || overlappingIndexes(this.rangesFor(key)).has(index);
  }

  markTouched(): void {
    this.onTouched();
  }

  // --- Internals ------------------------------------------------------------

  private mutate(change: (draft: WeeklySchedule) => void): void {
    const draft: WeeklySchedule = {};
    for (const [key, ranges] of Object.entries(this.schedule())) {
      draft[key as ScheduleKey] = ranges ? [...ranges] : ranges;
    }
    change(draft);
    this.schedule.set(draft);
    this.emit();
  }

  private emit(): void {
    this.onChange(this.openDayCount() > 0 ? serializeSchedule(this.schedule()) : null);
  }
}

/** `"17:00"` → `"18:00"`, clamped at the end of the day. */
function laterThan(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (hours >= 23) return '23:59';
  return `${String(hours + 1).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
