/**
 * Weekly opening-hours model shared by the schedule editor.
 *
 * WIRE FORMAT — the API stores this in a plain `string` column capped at 1000
 * chars (`TenantSettings.Schedules`), so the envelope is deliberately terse:
 *
 *   {"v":1,"d":{"mon":["08:00-12:00","14:00-18:00"],"tue":["08:00-17:00"]}}
 *
 * Only OPEN days appear as keys — an absent day is closed. A worst case of
 * 7 days x 6 ranges serializes to ~650 chars, comfortably inside the cap
 * (`MAX_SERIALIZED_LENGTH` enforces it anyway).
 *
 * The column is plain text as far as the API is concerned, and tenants created
 * before this editor existed hold free-text hours ("Lun-Vie 8:00-18:00"), so
 * `parseSchedule` returns `null` for anything that is not this exact envelope
 * and callers must preserve the original string instead of discarding it.
 *
 * Kept in lockstep with the sibling copy in `dominodo.nodo` — both panels write
 * the same column and there is no shared package between the repos, so a change
 * here has to land there too.
 */

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/** Public holidays. Not a weekday — it never joins a "Lunes a viernes" run. */
export const HOLIDAY_KEY = 'hol';
export type HolidayKey = typeof HOLIDAY_KEY;

/** Anything the schedule can be keyed by. */
export type ScheduleKey = WeekdayKey | HolidayKey;

export interface ScheduleEntry {
  key: ScheduleKey;
  /** Spanish label shown in the editor. */
  label: string;
}

/** Monday-first, matching how Spanish-speaking users read a week. */
export const WEEKDAYS: readonly ScheduleEntry[] = [
  { key: 'mon', label: 'Lunes' },
  { key: 'tue', label: 'Martes' },
  { key: 'wed', label: 'Miércoles' },
  { key: 'thu', label: 'Jueves' },
  { key: 'fri', label: 'Viernes' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
];

export const HOLIDAY: ScheduleEntry = { key: HOLIDAY_KEY, label: 'Festivos' };

/** Every row the editor renders, in order: the week, then holidays. */
export const SCHEDULE_ENTRIES: readonly ScheduleEntry[] = [...WEEKDAYS, HOLIDAY];

/** A single open interval within a day. Times are zero-padded `HH:mm` (24h). */
export interface TimeRange {
  from: string;
  to: string;
}

/** Open ranges per day. A missing/empty key means the day is closed. */
export type WeeklySchedule = Partial<Record<ScheduleKey, TimeRange[]>>;

/** Guardrail so a pathological schedule can never exceed the API's 1000 chars. */
export const MAX_RANGES_PER_DAY = 6;
export const MAX_SERIALIZED_LENGTH = 1000;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_KEYS = new Set<string>(SCHEDULE_ENTRIES.map((entry) => entry.key));

/** Envelope actually written to the API. */
interface ScheduleEnvelope {
  v: 1;
  d: Partial<Record<ScheduleKey, string[]>>;
}

/**
 * Parse a stored `schedules` string. Returns `null` when the value is empty or
 * is NOT our envelope (legacy free text) — the caller decides what to do with it.
 */
export function parseSchedule(raw: string | null | undefined): WeeklySchedule | null {
  if (!raw?.trim()) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isEnvelope(parsed)) return null;

  const schedule: WeeklySchedule = {};
  for (const [key, list] of Object.entries(parsed.d)) {
    if (!VALID_KEYS.has(key) || !Array.isArray(list)) continue;

    const ranges = list
      .map(splitRange)
      .filter((range): range is TimeRange => range !== null && isRangeValid(range));

    if (ranges.length > 0) {
      schedule[key as ScheduleKey] = ranges.slice(0, MAX_RANGES_PER_DAY);
    }
  }

  // An envelope with no usable day is indistinguishable from "nothing stored".
  return Object.keys(schedule).length > 0 ? schedule : null;
}

/** Serialize to the wire envelope, dropping closed days. */
export function serializeSchedule(schedule: WeeklySchedule): string {
  const days: Partial<Record<ScheduleKey, string[]>> = {};

  for (const entry of SCHEDULE_ENTRIES) {
    const ranges = schedule[entry.key];
    if (ranges?.length) {
      days[entry.key] = ranges.map((r) => `${r.from}-${r.to}`);
    }
  }

  return JSON.stringify({ v: 1, d: days } satisfies ScheduleEnvelope);
}

/**
 * Render a schedule as the sentence a resident would read, collapsing runs of
 * consecutive days that share the same hours:
 *
 *   "Lunes a viernes: 8:00 a. m. – 12:00 m., 2:00 p. m. – 6:00 p. m. · Sábado: …"
 *
 * Exported so any future consumer (a detail view, the resident app) can render
 * the stored JSON without re-implementing the grouping.
 */
export function formatSchedule(schedule: WeeklySchedule): string {
  const groups: { days: ScheduleEntry[]; ranges: TimeRange[] }[] = [];

  // Only weekdays collapse into runs — "Viernes a festivos" would be nonsense.
  for (const day of WEEKDAYS) {
    const ranges = schedule[day.key];
    if (!ranges?.length) continue;

    const previous = groups.at(-1);
    const isConsecutive =
      previous !== undefined &&
      WEEKDAYS.indexOf(previous.days.at(-1)!) === WEEKDAYS.indexOf(day) - 1 &&
      sameRanges(previous.ranges, ranges);

    if (isConsecutive) {
      previous.days.push(day);
    } else {
      groups.push({ days: [day], ranges });
    }
  }

  const parts = groups.map(
    (group) => `${labelForDays(group.days)}: ${formatRanges(group.ranges)}`,
  );

  // Holidays always read as their own trailing clause.
  const holidays = schedule[HOLIDAY_KEY];
  if (holidays?.length) {
    parts.push(`${HOLIDAY.label}: ${formatRanges(holidays)}`);
  }

  return parts.join(' · ');
}

/** Compact "8:00 – 12:00, 14:00 – 18:00" used in the collapsed day row. */
export function formatRanges(ranges: readonly TimeRange[]): string {
  return ranges.map((r) => `${trimHour(r.from)} – ${trimHour(r.to)}`).join(', ');
}

/** Both ends present, well-formed, and `from` strictly before `to`. */
export function isRangeValid(range: TimeRange): boolean {
  return (
    TIME_PATTERN.test(range.from) && TIME_PATTERN.test(range.to) && range.from < range.to
  );
}

/**
 * Indexes of ranges that overlap another range in the same day. Zero-padded
 * `HH:mm` compares correctly as a string, so no date parsing is needed.
 */
export function overlappingIndexes(ranges: readonly TimeRange[]): Set<number> {
  const overlapping = new Set<number>();
  const ordered = ranges
    .map((range, index) => ({ range, index }))
    .filter((entry) => isRangeValid(entry.range))
    .sort((a, b) => a.range.from.localeCompare(b.range.from));

  for (let i = 1; i < ordered.length; i++) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (current.range.from < previous.range.to) {
      overlapping.add(previous.index);
      overlapping.add(current.index);
    }
  }

  return overlapping;
}

/** `"08:00-12:00"` → `{ from, to }`; `null` when malformed. */
function splitRange(value: unknown): TimeRange | null {
  if (typeof value !== 'string') return null;
  const parts = value.split('-');
  if (parts.length !== 2) return null;
  return { from: parts[0], to: parts[1] };
}

function isEnvelope(value: unknown): value is ScheduleEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ScheduleEnvelope>;
  return candidate.v === 1 && typeof candidate.d === 'object' && candidate.d !== null;
}

function sameRanges(a: readonly TimeRange[], b: readonly TimeRange[]): boolean {
  return a.length === b.length && a.every((r, i) => r.from === b[i].from && r.to === b[i].to);
}

function labelForDays(days: readonly ScheduleEntry[]): string {
  if (days.length === 1) return days[0].label;
  // Only the first day opens the phrase, so the rest stay lowercase in Spanish.
  if (days.length === 2) return `${days[0].label} y ${lower(days[1].label)}`;
  return `${days[0].label} a ${lower(days.at(-1)!.label)}`;
}

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** "08:00" → "8:00" — leading zeros read as clutter in Spanish copy. */
function trimHour(time: string): string {
  return time.startsWith('0') ? time.slice(1) : time;
}
