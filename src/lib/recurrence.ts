import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfDay,
  format,
  getDaysInMonth,
  isSameDay,
  isSameYear,
  setDay,
  startOfWeek,
} from "date-fns";
import type { Locale } from "date-fns";

import type {
  CalendarEvent,
  RecurrenceFrequency,
  RecurrenceRule,
  RecurrenceWeekday,
} from "@/components/week-view-types";

/** Monday to Friday, the days an "Every weekday" rule falls on */
const WEEKDAYS: RecurrenceWeekday[] = [1, 2, 3, 4, 5];

/** Saturday and Sunday, the days an "Every weekend day" rule falls on */
const WEEKEND_DAYS: RecurrenceWeekday[] = [0, 6];

/**
 * Order a rule lists its days in: Monday first, Sunday last ("on Mon, Wed,
 * Sun"), as Notion Calendar reads them
 */
const WEEKDAY_DISPLAY_ORDER: RecurrenceWeekday[] = [1, 2, 3, 4, 5, 6, 0];

/** "day", "week", ... for each frequency */
export const RECURRENCE_UNITS: Record<RecurrenceFrequency, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
  yearly: "year",
};

/** RFC 5545 FREQ value of each frequency */
const RRULE_FREQUENCIES: Record<string, RecurrenceFrequency> = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
};

/** RFC 5545 BYDAY codes, Sunday first like `RecurrenceWeekday` */
const RRULE_WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** English weekday abbreviations the demo's text rules use, Sunday first */
const WEEKDAY_ABBREVIATIONS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * The longest a series is walked looking for an occurrence: 20 years of
 * daily events
 */
const MAX_OCCURRENCES = 7300;

/**
 * How far the custom repeat dialog's "On" and "After" ends default to, per
 * frequency: Notion Calendar suggests a week of days, four weeks, a year of
 * months and three years
 */
export const RECURRENCE_END_DEFAULTS: Record<RecurrenceFrequency, number> = {
  daily: 7,
  weekly: 4,
  monthly: 12,
  yearly: 3,
};

/**
 * A rule as the details show it: "Every week" in full color and "on Thu"
 * muted
 */
export interface RecurrenceLabel {
  /** "Every week", "Every 2 days", "Every weekday" */
  main: string;
  /** "on Thu", "on the 1st Sat until Dec 6", "for 7 times"; may be empty */
  detail: string;
}

/**
 * A repeat rule with every default filled in, so two rules compare by value
 */
export interface NormalizedRecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: RecurrenceWeekday[];
  monthlyBy: "day-of-month" | "weekday-of-month";
  end: NonNullable<RecurrenceRule["end"]>;
}

/**
 * Where a series' previous or next occurrence is: its event when the app has
 * one for it, else only its start
 */
export interface SeriesOccurrence<TEvent extends CalendarEvent> {
  /** When the occurrence starts */
  start: Date;
  /** The event of that occurrence, when the event list has it */
  event?: TEvent;
}

/** Event fields the series helpers read */
type SeriesEvent = CalendarEvent & {
  calendarId?: string;
  recurrenceRule?: RecurrenceRule;
  recurrence?: string;
};

/**
 * Fills in a rule's defaults from the start of its series: one as interval,
 * the start's weekday, by day of the month, never ending
 */
export function normalizeRecurrenceRule(
  rule: RecurrenceRule,
  start: Date,
): NormalizedRecurrenceRule {
  const weekdays =
    rule.frequency === "weekly" && rule.weekdays?.length
      ? [...new Set(rule.weekdays)].sort((a, b) => a - b)
      : [start.getDay() as RecurrenceWeekday];
  return {
    frequency: rule.frequency,
    interval: Math.max(1, Math.floor(rule.interval ?? 1)),
    weekdays,
    monthlyBy: rule.monthlyBy ?? "day-of-month",
    end: rule.end ?? { type: "never" },
  };
}

/**
 * Whether two rules repeat the same way from `start`
 */
export function isSameRecurrenceRule(
  a: RecurrenceRule,
  b: RecurrenceRule,
  start: Date,
): boolean {
  const left = normalizeRecurrenceRule(a, start);
  const right = normalizeRecurrenceRule(b, start);
  if (
    left.frequency !== right.frequency ||
    left.interval !== right.interval ||
    left.end.type !== right.end.type
  ) {
    return false;
  }
  if (
    left.frequency === "weekly" &&
    left.weekdays.join() !== right.weekdays.join()
  ) {
    return false;
  }
  if (left.frequency === "monthly" && left.monthlyBy !== right.monthlyBy) {
    return false;
  }
  if (left.end.type === "on" && right.end.type === "on") {
    return left.end.date.toDateString() === right.end.date.toDateString();
  }
  if (left.end.type === "after" && right.end.type === "after") {
    return left.end.count === right.end.count;
  }
  return true;
}

/**
 * Position of `date`'s weekday in its month: 1 for the first Saturday, 5 for
 * a fifth (always the last)
 */
function getWeekOfMonth(date: Date): number {
  return Math.ceil(date.getDate() / 7);
}

/** "1st", "2nd", "3rd", "4th", or "last" for a fifth weekday */
function formatWeekOfMonth(week: number): string {
  if (week >= 5) return "last";
  return ["1st", "2nd", "3rd", "4th"][week - 1];
}

/** "Every week", "Every 2 weeks" */
function formatEvery(rule: NormalizedRecurrenceRule): string {
  const unit = RECURRENCE_UNITS[rule.frequency];
  if (rule.interval === 1) return `Every ${unit}`;
  return `Every ${rule.interval} ${unit}s`;
}

/** "until Dec 6", "until Jan 4, 2028" or "for 7 times"; empty when it never ends */
function formatEnd(
  rule: NormalizedRecurrenceRule,
  start: Date,
  locale: Locale,
): string {
  if (rule.end.type === "never") return "";
  if (rule.end.type === "after") return `for ${rule.end.count} times`;

  const pattern = isSameYear(rule.end.date, start) ? "MMM d" : "MMM d, yyyy";
  return `until ${format(rule.end.date, pattern, { locale })}`;
}

/** "Mon, Wed, Sun", Monday first */
function formatWeekdays(
  weekdays: RecurrenceWeekday[],
  start: Date,
  locale: Locale,
): string {
  return WEEKDAY_DISPLAY_ORDER.filter((day) => weekdays.includes(day))
    .map((day) => format(setDay(start, day), "EEE", { locale }))
    .join(", ");
}

/**
 * Reads a rule the way Notion Calendar shows it, from the start of the
 * occurrence on screen: "Every day", "Every weekday", "Every week" + "on
 * Thu", "Every 2 weeks" + "on Mon, Wed, Sun until Dec 6", "Every month" +
 * "on the 1st Sat", "Every year" + "on Nov 7", "Every day" + "for 7 times"
 */
export function describeRecurrenceRule(
  rule: RecurrenceRule,
  start: Date,
  locale: Locale,
): RecurrenceLabel {
  const normalized = normalizeRecurrenceRule(rule, start);
  const end = formatEnd(normalized, start, locale);
  const withEnd = (detail: string) => [detail, end].filter(Boolean).join(" ");

  if (normalized.frequency === "weekly") {
    const days = normalized.weekdays.join();
    if (normalized.interval === 1 && days === WEEKDAYS.join()) {
      return { main: "Every weekday", detail: withEnd("") };
    }
    if (normalized.interval === 1 && days === WEEKEND_DAYS.join()) {
      return { main: "Every weekend day", detail: withEnd("") };
    }
    return {
      main: formatEvery(normalized),
      detail: withEnd(
        `on ${formatWeekdays(normalized.weekdays, start, locale)}`,
      ),
    };
  }

  if (normalized.frequency === "monthly") {
    const on =
      normalized.monthlyBy === "weekday-of-month"
        ? `on the ${formatWeekOfMonth(getWeekOfMonth(start))} ${format(start, "EEE", { locale })}`
        : `on the ${format(start, "do", { locale })}`;
    return { main: formatEvery(normalized), detail: withEnd(on) };
  }

  if (normalized.frequency === "yearly") {
    return {
      main: formatEvery(normalized),
      detail: withEnd(`on ${format(start, "MMM d", { locale })}`),
    };
  }

  return { main: formatEvery(normalized), detail: withEnd("") };
}

/**
 * Reads a rule as one line: "Every 2 weeks on Mon, Wed, Sun until Dec 6"
 */
export function formatRecurrenceRule(
  rule: RecurrenceRule,
  start: Date,
  locale: Locale,
): string {
  const { main, detail } = describeRecurrenceRule(rule, start, locale);
  return [main, detail].filter(Boolean).join(" ");
}

/**
 * The repeat menu's presets for an occurrence starting at `start`, in Notion
 * Calendar's order: every day, every weekday (or weekend day on a weekend),
 * every week, every 2 weeks, every month on the day, every month on the
 * weekday, every year
 */
export function getRecurrencePresets(start: Date): RecurrenceRule[] {
  const weekday = start.getDay() as RecurrenceWeekday;
  const isWeekend = WEEKEND_DAYS.includes(weekday);
  return [
    { frequency: "daily" },
    { frequency: "weekly", weekdays: isWeekend ? WEEKEND_DAYS : WEEKDAYS },
    { frequency: "weekly", weekdays: [weekday] },
    { frequency: "weekly", interval: 2, weekdays: [weekday] },
    { frequency: "monthly", monthlyBy: "day-of-month" },
    { frequency: "monthly", monthlyBy: "weekday-of-month" },
    { frequency: "yearly" },
  ];
}

/**
 * Where the custom repeat dialog's "On" and "After" ends start for a series
 * that starts at `start`: `RECURRENCE_END_DEFAULTS` units later, and that
 * many occurrences (the interval doesn't change them, as in Notion Calendar)
 */
export function getDefaultRecurrenceEnd(
  frequency: RecurrenceFrequency,
  start: Date,
): { date: Date; count: number } {
  const count = RECURRENCE_END_DEFAULTS[frequency];
  const addUnits = {
    daily: addDays,
    weekly: addWeeks,
    monthly: addMonths,
    yearly: addYears,
  }[frequency];
  return { date: addUnits(start, count), count };
}

/**
 * Parses an RFC 5545 RRULE ("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=6")
 * into a rule. Returns `null` for rules the details can't show.
 */
function parseRRule(text: string): RecurrenceRule | null {
  const parts = new Map(
    text
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((part) => {
        const [key, value = ""] = part.split("=");
        return [key.trim().toUpperCase(), value.trim().toUpperCase()] as const;
      }),
  );
  const frequency = RRULE_FREQUENCIES[parts.get("FREQ") ?? ""];
  if (!frequency) return null;

  const rule: RecurrenceRule = { frequency };
  const interval = Number(parts.get("INTERVAL") ?? 1);
  if (interval > 1) rule.interval = interval;

  const byDay = parts.get("BYDAY");
  if (frequency === "weekly" && byDay) {
    const weekdays = byDay
      .split(",")
      .map((code) => RRULE_WEEKDAYS.indexOf(code.slice(-2)))
      .filter((day): day is RecurrenceWeekday => day !== -1);
    if (weekdays.length) rule.weekdays = weekdays;
  }
  // "BYDAY=1SA" or "BYDAY=SA;BYSETPOS=1": a weekday of the month
  if (
    frequency === "monthly" &&
    byDay &&
    /\d|BYSETPOS/.test(text.toUpperCase())
  ) {
    rule.monthlyBy = "weekday-of-month";
  }

  const count = Number(parts.get("COUNT"));
  const until = parts.get("UNTIL");
  if (count > 0) {
    rule.end = { type: "after", count };
  } else if (until) {
    const match = /^(\d{4})(\d{2})(\d{2})/.exec(until);
    if (match) {
      rule.end = {
        type: "on",
        date: new Date(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
        ),
      };
    }
  }
  return rule;
}

/**
 * Parses the demo's text rules ("Every week on Thu", "Every 2 weeks on Mon,
 * Thu", "Every day") into a rule. Returns `null` for anything else.
 */
function parseTextRule(text: string): RecurrenceRule | null {
  const match =
    /^every\s+(?:(\d+)\s+)?(day|week|month|year)s?(?:\s+on\s+(.+))?$/i.exec(
      text.trim(),
    );
  if (!match) return null;

  const unit = match[2].toLowerCase();
  const frequency = (
    Object.keys(RECURRENCE_UNITS) as RecurrenceFrequency[]
  ).find((key) => RECURRENCE_UNITS[key] === unit);
  if (!frequency) return null;

  const rule: RecurrenceRule = { frequency };
  const interval = Number(match[1] ?? 1);
  if (interval > 1) rule.interval = interval;

  if (frequency === "weekly" && match[3]) {
    const weekdays = match[3]
      .split(/,\s*/)
      .map((name) =>
        WEEKDAY_ABBREVIATIONS.indexOf(name.trim().slice(0, 3).toLowerCase()),
      )
      .filter((day): day is RecurrenceWeekday => day !== -1);
    if (weekdays.length) rule.weekdays = weekdays;
  }
  return rule;
}

/**
 * Reads an event's `recurrence` text, an RRULE or a sentence like "Every
 * week on Thu", into a rule. Returns `null` when it can't.
 */
export function parseRecurrence(text: string): RecurrenceRule | null {
  if (/FREQ=/i.test(text)) return parseRRule(text);
  return parseTextRule(text);
}

/**
 * An event's repeat rule: its `recurrenceRule`, else its `recurrence` text
 * read as one. `null` when it doesn't repeat (or the text can't be read).
 */
export function getEventRecurrenceRule(
  event: SeriesEvent,
): RecurrenceRule | null {
  if (event.recurrenceRule) return event.recurrenceRule;
  if (event.recurrence) return parseRecurrence(event.recurrence);
  return null;
}

/** `date` with the time of day of `time` */
function withTimeOf(date: Date, time: Date): Date {
  const result = new Date(date);
  result.setHours(
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
    time.getMilliseconds(),
  );
  return result;
}

/** The `week`-th (5 = last) `weekday` of the month `monthDate` is in */
function getWeekdayOfMonth(
  monthDate: Date,
  weekday: number,
  week: number,
): Date {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstMatch = 1 + ((weekday - first.getDay() + 7) % 7);
  let day = firstMatch + (Math.min(week, 5) - 1) * 7;
  if (day > getDaysInMonth(first)) day -= 7;
  return new Date(first.getFullYear(), first.getMonth(), day);
}

/**
 * The candidate dates a rule falls on, in order, from the series' start
 * (the start itself always counts, as RFC 5545's DTSTART does). Ends are
 * applied by the caller.
 */
function* generateCandidates(
  rule: NormalizedRecurrenceRule,
  seriesStart: Date,
): Generator<Date> {
  yield seriesStart;

  if (rule.frequency === "daily") {
    for (let step = 1; ; step++) {
      yield addDays(seriesStart, step * rule.interval);
    }
  }

  if (rule.frequency === "weekly") {
    const firstWeek = startOfWeek(seriesStart, { weekStartsOn: 0 });
    for (let step = 0; ; step++) {
      const week = addWeeks(firstWeek, step * rule.interval);
      for (const day of rule.weekdays) {
        const date = withTimeOf(addDays(week, day), seriesStart);
        if (date > seriesStart) yield date;
      }
    }
  }

  if (rule.frequency === "monthly") {
    const week = getWeekOfMonth(seriesStart);
    for (let step = 1; ; step++) {
      const month = addMonths(
        new Date(seriesStart.getFullYear(), seriesStart.getMonth(), 1),
        step * rule.interval,
      );
      if (rule.monthlyBy === "weekday-of-month") {
        yield withTimeOf(
          getWeekdayOfMonth(month, seriesStart.getDay(), week),
          seriesStart,
        );
        continue;
      }
      // Months without the day (the 31st in April) are skipped, as RFC 5545 does
      if (seriesStart.getDate() > getDaysInMonth(month)) continue;
      month.setDate(seriesStart.getDate());
      yield withTimeOf(month, seriesStart);
    }
  }

  if (rule.frequency === "yearly") {
    for (let step = 1; ; step++) {
      const date = addYears(seriesStart, step * rule.interval);
      // A Feb 29 series only falls on leap years
      if (date.getDate() !== seriesStart.getDate()) continue;
      yield date;
    }
  }
}

/**
 * Walks the occurrences of a series that starts at `seriesStart`, ends
 * included, and stops when `visit` returns false
 */
function walkOccurrences(
  rule: RecurrenceRule,
  seriesStart: Date,
  visit: (date: Date) => boolean,
): void {
  const normalized = normalizeRecurrenceRule(rule, seriesStart);
  const until =
    normalized.end.type === "on" ? endOfDay(normalized.end.date) : null;
  const count =
    normalized.end.type === "after" ? normalized.end.count : MAX_OCCURRENCES;

  let seen = 0;
  for (const date of generateCandidates(normalized, seriesStart)) {
    if (seen >= Math.min(count, MAX_OCCURRENCES)) return;
    if (until && date > until) return;
    seen++;
    if (!visit(date)) return;
  }
}

/**
 * The occurrence of a series right before or after `from`, or `null` at
 * either end of the series
 */
export function getAdjacentOccurrence(
  rule: RecurrenceRule,
  seriesStart: Date,
  from: Date,
  direction: "previous" | "next",
): Date | null {
  let found: Date | null = null;
  walkOccurrences(rule, seriesStart, (date) => {
    if (direction === "next") {
      if (date > from) {
        found = date;
        return false;
      }
      return true;
    }
    if (date >= from) return false;
    found = date;
    return true;
  });
  return found;
}

/** Whether two events repeat the same way, so they belong to one series */
function isSameSeries(a: SeriesEvent, b: SeriesEvent): boolean {
  if (a.title !== b.title || a.calendarId !== b.calendarId) return false;
  if (a.recurrenceRule && b.recurrenceRule) {
    return isSameRecurrenceRule(a.recurrenceRule, b.recurrenceRule, a.start);
  }
  if (a.recurrenceRule || b.recurrenceRule) return false;
  return Boolean(a.recurrence) && a.recurrence === b.recurrence;
}

/**
 * The previous or next occurrence of `event`'s series, or `null` when it
 * doesn't repeat or that end of the series is reached.
 *
 * A series is the events with the same title, calendar and repeat rule.
 * With a `recurrenceRule`, occurrences are counted from the series' earliest
 * event, so the ones the list has no event for are found too (returned with
 * their start only); an event the list has on that day is returned with it.
 * A series known only by its `recurrence` text steps between the events the
 * list has, so moved and skipped occurrences stay as the app set them; a
 * lone event with a readable text rule is counted like a `recurrenceRule`.
 */
export function findSeriesOccurrence<TEvent extends SeriesEvent>(
  events: TEvent[],
  event: TEvent,
  direction: "previous" | "next",
): SeriesOccurrence<TEvent> | null {
  if (!event.recurrenceRule && !event.recurrence) return null;

  const series = events
    .filter((other) => other.id === event.id || isSameSeries(other, event))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const rule =
    event.recurrenceRule ??
    (series.length === 1 ? getEventRecurrenceRule(event) : null);

  if (rule) {
    const start = getAdjacentOccurrence(
      rule,
      series[0].start,
      event.start,
      direction,
    );
    if (!start) return null;
    const match = series.find((other) => isSameDay(other.start, start));
    return match ? { start: match.start, event: match } : { start };
  }

  const index = series.findIndex((other) => other.id === event.id);
  const neighbor = series[direction === "next" ? index + 1 : index - 1];
  return neighbor ? { start: neighbor.start, event: neighbor } : null;
}

/**
 * A copy of `event` for another occurrence of its series, starting at
 * `start` with the same duration. Its id is the event's id and the date, so
 * creating it twice gives the same event.
 */
export function createSeriesOccurrence<TEvent extends CalendarEvent>(
  event: TEvent,
  start: Date,
): TEvent {
  const duration = event.end.getTime() - event.start.getTime();
  return {
    ...event,
    id: `${event.id}-${format(start, "yyyy-MM-dd")}`,
    start,
    end: new Date(start.getTime() + duration),
  };
}
