import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  format,
  getDaysInMonth,
  isSameYear,
  setDay,
  startOfWeek,
} from "date-fns";
import type { Locale } from "date-fns";

import {
  fromZonedDayTime,
  getEventTimeZone,
  getZonedDay,
  getZonedTimeOfDay,
} from "@/lib/time-zones";
import type {
  CalendarEvent,
  DetailedCalendarEvent,
  FormatRRuleOptions,
  NormalizedRecurrenceRule,
  RecurrenceEnd,
  RecurrenceFrequency,
  RecurrenceLabel,
  RecurrenceRule,
  RecurrenceWeekday,
  SeriesOccurrence,
  VisibleRange,
  WeekStartsOn,
} from "@/components/calendar-types";

/** Monday to Friday, the days an "Every weekday" rule falls on */
const WEEKDAYS: RecurrenceWeekday[] = [1, 2, 3, 4, 5];

/** Saturday and Sunday, the days an "Every weekend day" rule falls on */
const WEEKEND_DAYS: RecurrenceWeekday[] = [0, 6];

/**
 * Order a rule lists its days in: Monday first, Sunday last ("on Mon, Wed,
 * Sun"), as Notion Calendar reads them
 */
const WEEKDAY_DISPLAY_ORDER: RecurrenceWeekday[] = [1, 2, 3, 4, 5, 6, 0];

/** Day the weeks of a weekly rule start on when it doesn't say: Monday, as RFC 5545's WKST */
const DEFAULT_RULE_WEEK_START: WeekStartsOn = 1;

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

/** RFC 5545 BYDAY and WKST codes, Sunday first like `RecurrenceWeekday` */
const RRULE_WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** An RRULE BYDAY entry such as `SA`, `1SA` or `-1SA` */
const RRULE_BY_DAY_PATTERN = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/;

/** An RRULE UNTIL value: a date, or a date-time in UTC (`Z`) or floating */
const RRULE_UNTIL_PATTERN =
  /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/;

/** RRULE parts a `RecurrenceRule` can hold; a rule with any other is kept as text */
const RRULE_PARTS = new Set([
  "FREQ",
  "INTERVAL",
  "BYDAY",
  "BYSETPOS",
  "BYMONTHDAY",
  "BYMONTH",
  "COUNT",
  "UNTIL",
  "WKST",
]);

/** Positions in the month a "weekday-of-month" rule can fall on */
const WEEKS_OF_MONTH: NormalizedRecurrenceRule["weekOfMonth"][] = [
  1, 2, 3, 4, -1,
];

/** English weekday abbreviations the demo's text rules use, Sunday first */
const WEEKDAY_ABBREVIATIONS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Milliseconds in a day, for day numbers */
const DAY_MS = 86_400_000;

/**
 * The longest a series is walked looking for an occurrence: 20 years of
 * daily events. Also caps the weeks, months or years tried for one.
 */
const MAX_OCCURRENCES = 7300;

/**
 * Most occurrences of one series `expandRecurringEvents` returns for one
 * range: a daily series over the event search's two years, with room to
 * spare
 */
export const MAX_OCCURRENCES_PER_RANGE = 1000;

/** An occurrence's id: its series' id, then its day (`launch-2026-06-20`) */
const OCCURRENCE_ID_PATTERN = /^(.+)-(\d{4})-(\d{2})-(\d{2})$/;

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

/** Event fields the series helpers read */
type SeriesEvent = CalendarEvent &
  Pick<
    DetailedCalendarEvent,
    | "calendarId"
    | "recurrenceRule"
    | "recurrence"
    | "timeZone"
    | "timezone"
    | "excludedDates"
    | "seriesId"
    | "originalStart"
  >;

/** Days since 1970-01-01 of `day`'s local calendar date, so days compare without their time */
function toDayNumber(day: Date): number {
  return Math.round(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / DAY_MS,
  );
}

/**
 * Position of `day`'s weekday in its month: 1 for the first Saturday, -1
 * (the last) for a fifth
 */
function getWeekOfMonth(day: Date): NormalizedRecurrenceRule["weekOfMonth"] {
  const week = Math.ceil(day.getDate() / 7);
  if (week >= 5) return -1;
  return week as 1 | 2 | 3 | 4;
}

/**
 * Fills in a rule's defaults from the first day of its series: one as
 * interval, the day's weekday and position in the month, weeks from Monday,
 * by day of the month, never ending
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
    weekOfMonth: rule.weekOfMonth ?? getWeekOfMonth(start),
    weekStartsOn: rule.weekStartsOn ?? DEFAULT_RULE_WEEK_START,
    end: rule.end ?? { type: "never" },
  };
}

/** Whether two ends stop a series at the same point */
function isSameRecurrenceEnd(a: RecurrenceEnd, b: RecurrenceEnd): boolean {
  if (a.type === "on" && b.type === "on") {
    return toDayNumber(a.date) === toDayNumber(b.date);
  }
  if (a.type === "after" && b.type === "after") return a.count === b.count;
  return a.type === b.type;
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
  if (left.frequency !== right.frequency || left.interval !== right.interval) {
    return false;
  }
  if (!isSameRecurrenceEnd(left.end, right.end)) return false;
  if (left.frequency === "weekly") {
    // Where weeks start only matters when weeks are skipped
    const sameWeeks =
      left.interval === 1 || left.weekStartsOn === right.weekStartsOn;
    return sameWeeks && left.weekdays.join() === right.weekdays.join();
  }
  if (left.frequency !== "monthly") return true;
  if (left.monthlyBy !== right.monthlyBy) return false;
  return (
    left.monthlyBy === "day-of-month" || left.weekOfMonth === right.weekOfMonth
  );
}

/** "1st", "2nd", "3rd", "4th", or "last" */
function formatWeekOfMonth(
  week: NormalizedRecurrenceRule["weekOfMonth"],
): string {
  if (week === -1) return "last";
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

/** "on the 1st Sat", "on the last Mon", or "on the 7th" */
function formatMonthlyDay(
  rule: NormalizedRecurrenceRule,
  start: Date,
  locale: Locale,
): string {
  if (rule.monthlyBy === "day-of-month") {
    return `on the ${format(start, "do", { locale })}`;
  }
  const weekday = format(start, "EEE", { locale });
  return `on the ${formatWeekOfMonth(rule.weekOfMonth)} ${weekday}`;
}

/**
 * Reads a rule the way Notion Calendar shows it, from the day of the
 * occurrence on screen (in the event's time zone): "Every day", "Every
 * weekday", "Every week" + "on Thu", "Every 2 weeks" + "on Mon, Wed, Sun
 * until Dec 6", "Every month" + "on the 1st Sat", "Every year" + "on Nov 7",
 * "Every day" + "for 7 times"
 */
export function describeRecurrenceRule(
  rule: RecurrenceRule,
  start: Date,
  locale: Locale,
): RecurrenceLabel {
  const normalized = normalizeRecurrenceRule(rule, start);
  const end = formatEnd(normalized, start, locale);
  const withEnd = (detail: string) => [detail, end].filter(Boolean).join(" ");
  const main = formatEvery(normalized);

  if (normalized.frequency === "weekly") {
    const days = normalized.weekdays.join();
    if (normalized.interval === 1 && days === WEEKDAYS.join()) {
      return { main: "Every weekday", detail: withEnd("") };
    }
    if (normalized.interval === 1 && days === WEEKEND_DAYS.join()) {
      return { main: "Every weekend day", detail: withEnd("") };
    }
    const on = `on ${formatWeekdays(normalized.weekdays, start, locale)}`;
    return { main, detail: withEnd(on) };
  }

  if (normalized.frequency === "monthly") {
    return {
      main,
      detail: withEnd(formatMonthlyDay(normalized, start, locale)),
    };
  }

  if (normalized.frequency === "yearly") {
    const on = `on ${format(start, "MMM d", { locale })}`;
    return { main, detail: withEnd(on) };
  }

  return { main, detail: withEnd("") };
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
 * The repeat menu's presets for an occurrence on `start`, in Notion
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
    {
      frequency: "monthly",
      monthlyBy: "weekday-of-month",
      weekOfMonth: getWeekOfMonth(start),
    },
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

/** A positive whole number, or `null` */
function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number > 0 ? number : null;
}

/**
 * The last day an RRULE's UNTIL lets the series fall on: a DATE is that
 * day; a UTC DATE-TIME is the day it falls on in `timeZone`; a floating
 * one is its own date
 */
function parseUntil(value: string, timeZone?: string): Date | null {
  const match = RRULE_UNTIL_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1, 4).map(Number);
  if (match[7] !== "Z") return new Date(year, month - 1, day);

  const [hours, minutes, seconds] = match.slice(4, 7).map(Number);
  const instant = new Date(
    Date.UTC(year, month - 1, day, hours, minutes, seconds),
  );
  return getZonedDay(instant, timeZone);
}

/**
 * The weekday of the month an RRULE's BYDAY (`1SA`, `-1SA`, or `SA` with
 * BYSETPOS) names, as `weekOfMonth`. `null` when it isn't one a rule can
 * hold: several days, another weekday than `start`'s, or a fifth.
 */
function parseMonthlyByDay(
  byDay: string,
  bySetPos: string | undefined,
  start: Date,
): NormalizedRecurrenceRule["weekOfMonth"] | null {
  const match = RRULE_BY_DAY_PATTERN.exec(byDay);
  if (!match || RRULE_WEEKDAYS.indexOf(match[2]) !== start.getDay()) {
    return null;
  }
  if (match[1] !== undefined && bySetPos !== undefined) return null;
  const position = Number(match[1] ?? bySetPos);
  return WEEKS_OF_MONTH.find((week) => week === position) ?? null;
}

/**
 * Parses an RFC 5545 RRULE ("FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=6")
 * for a series that starts at `start`. Returns `null` for rules a
 * `RecurrenceRule` can't hold exactly, e.g. "FREQ=MONTHLY;BYMONTHDAY=1,15"
 * or a monthly BYDAY on another weekday than the start's.
 */
function parseRRule(
  text: string,
  start: Date,
  timeZone?: string,
): RecurrenceRule | null {
  const parts = new Map<string, string>();
  for (const part of text.replace(/^RRULE:/i, "").split(";")) {
    if (!part.trim()) continue;
    const [key, value = ""] = part.split("=");
    const name = key.trim().toUpperCase();
    if (!RRULE_PARTS.has(name) || parts.has(name)) return null;
    parts.set(name, value.trim().toUpperCase());
  }
  const frequency = RRULE_FREQUENCIES[parts.get("FREQ") ?? ""];
  if (!frequency) return null;

  // Days are counted in the series' zone
  const day = getZonedDay(start, timeZone);
  const rule: RecurrenceRule = { frequency };

  const interval = parsePositiveInteger(parts.get("INTERVAL") ?? "1");
  if (!interval) return null;
  if (interval > 1) rule.interval = interval;

  const weekStart = parts.get("WKST");
  if (weekStart !== undefined) {
    const index = RRULE_WEEKDAYS.indexOf(weekStart);
    if (index === -1) return null;
    rule.weekStartsOn = index as WeekStartsOn;
  }

  const byDay = parts.get("BYDAY");
  const bySetPos = parts.get("BYSETPOS");
  const byMonthDay = parts.get("BYMONTHDAY");
  const byMonth = parts.get("BYMONTH");
  if (frequency === "weekly" && byDay !== undefined) {
    const weekdays = byDay.split(",").map((code) => {
      const match = RRULE_BY_DAY_PATTERN.exec(code);
      return match && !match[1] ? RRULE_WEEKDAYS.indexOf(match[2]) : -1;
    });
    if (weekdays.includes(-1)) return null;
    rule.weekdays = [...new Set(weekdays as RecurrenceWeekday[])].sort(
      (a, b) => a - b,
    );
  }
  if (frequency === "monthly" && byDay !== undefined) {
    const weekOfMonth = parseMonthlyByDay(byDay, bySetPos, day);
    if (weekOfMonth === null || byMonthDay !== undefined) return null;
    rule.monthlyBy = "weekday-of-month";
    rule.weekOfMonth = weekOfMonth;
  }
  // The other parts only restate the start's own day and month
  if (
    byDay !== undefined &&
    frequency !== "weekly" &&
    frequency !== "monthly"
  ) {
    return null;
  }
  if (bySetPos !== undefined && rule.monthlyBy !== "weekday-of-month") {
    return null;
  }
  if (byMonthDay !== undefined) {
    const sameDay = Number(byMonthDay) === day.getDate();
    if (!sameDay || frequency === "daily" || frequency === "weekly") {
      return null;
    }
  }
  if (byMonth !== undefined) {
    const sameMonth = Number(byMonth) === day.getMonth() + 1;
    if (!sameMonth || frequency !== "yearly") return null;
  }

  const count = parts.get("COUNT");
  const until = parts.get("UNTIL");
  if (count !== undefined && until !== undefined) return null;
  if (count !== undefined) {
    const occurrences = parsePositiveInteger(count);
    if (!occurrences) return null;
    rule.end = { type: "after", count: occurrences };
  }
  if (until !== undefined) {
    const lastDay = parseUntil(until, timeZone);
    if (!lastDay) return null;
    rule.end = { type: "on", date: lastDay };
  }
  return rule;
}

/** `YYYYMMDD` of `day`'s local calendar date */
function formatRRuleDate(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}${month}${date}`;
}

/** `YYYYMMDDTHHMMSSZ` */
function formatRRuleUtcDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  const time = `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
  return `${day}T${time}Z`;
}

/**
 * Writes a rule as an RFC 5545 RRULE value for a series that starts at
 * `start`, e.g. "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;COUNT=6". An "on" end
 * becomes an UNTIL at the end of that day in the series' zone (in UTC), or
 * the date itself for all-day series.
 */
export function formatRRule(
  rule: RecurrenceRule,
  start: Date,
  { timeZone, isAllDay = false }: FormatRRuleOptions = {},
): string {
  const day = getZonedDay(start, timeZone);
  const parts = [`FREQ=${rule.frequency.toUpperCase()}`];
  const interval = Math.max(1, Math.floor(rule.interval ?? 1));
  if (interval > 1) parts.push(`INTERVAL=${interval}`);

  if (rule.frequency === "weekly" && rule.weekdays?.length) {
    const weekdays = [...new Set(rule.weekdays)].sort((a, b) => a - b);
    parts.push(`BYDAY=${weekdays.map((d) => RRULE_WEEKDAYS[d]).join(",")}`);
  }
  if (rule.frequency === "monthly" && rule.monthlyBy === "weekday-of-month") {
    const week = rule.weekOfMonth ?? getWeekOfMonth(day);
    parts.push(`BYDAY=${week}${RRULE_WEEKDAYS[day.getDay()]}`);
  }
  if (rule.weekStartsOn !== undefined) {
    parts.push(`WKST=${RRULE_WEEKDAYS[rule.weekStartsOn]}`);
  }

  if (rule.end?.type === "after") parts.push(`COUNT=${rule.end.count}`);
  if (rule.end?.type === "on" && isAllDay) {
    parts.push(`UNTIL=${formatRRuleDate(rule.end.date)}`);
  }
  if (rule.end?.type === "on" && !isAllDay) {
    const lastMoment = fromZonedDayTime(rule.end.date, DAY_MS - 1000, timeZone);
    parts.push(`UNTIL=${formatRRuleUtcDateTime(lastMoment)}`);
  }
  return parts.join(";");
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
 * Whether `text` is an RFC 5545 RRULE ("FREQ=..."), not display text
 */
export function isRRule(text: string): boolean {
  return /(^|;|:)FREQ=/i.test(text.trim());
}

/**
 * Reads a `recurrence` text, an RRULE or a sentence like "Every week on
 * Thu", into a rule for a series that starts at `start` in `timeZone` (the
 * viewer's when unset). Returns `null` when it can't, or when the RRULE
 * says more than a `RecurrenceRule` holds.
 */
export function parseRecurrence(
  text: string,
  start: Date,
  timeZone?: string,
): RecurrenceRule | null {
  if (isRRule(text)) return parseRRule(text, start, timeZone);
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
  if (!event.recurrence) return null;
  return parseRecurrence(
    event.recurrence,
    event.start,
    getEventTimeZone(event),
  );
}

/** The `week`-th (-1: the last) `weekday` of the month `monthDate` is in */
function getWeekdayOfMonth(
  monthDate: Date,
  weekday: number,
  week: NormalizedRecurrenceRule["weekOfMonth"],
): Date {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  if (week === -1) {
    const lastDate = getDaysInMonth(monthDate);
    const lastWeekday = new Date(year, month, lastDate).getDay();
    return new Date(year, month, lastDate - ((lastWeekday - weekday + 7) % 7));
  }
  const firstWeekday = new Date(year, month, 1).getDay();
  return new Date(
    year,
    month,
    1 + ((weekday - firstWeekday + 7) % 7) + (week - 1) * 7,
  );
}

/**
 * The days a rule falls on, in order, from the first day of its series (a
 * local midnight for the day in the series' zone). The first day itself
 * always counts, as RFC 5545's DTSTART does. Ends are applied by the caller.
 */
function* generateOccurrenceDays(
  rule: NormalizedRecurrenceRule,
  firstDay: Date,
): Generator<Date> {
  yield firstDay;
  const first = toDayNumber(firstDay);
  const isAfterFirst = (day: Date) => toDayNumber(day) > first;

  if (rule.frequency === "daily") {
    for (let step = 1; step <= MAX_OCCURRENCES; step++) {
      yield addDays(firstDay, step * rule.interval);
    }
    return;
  }

  if (rule.frequency === "weekly") {
    const firstWeek = startOfWeek(firstDay, {
      weekStartsOn: rule.weekStartsOn,
    });
    for (let step = 0; step <= MAX_OCCURRENCES; step++) {
      const week = addWeeks(firstWeek, step * rule.interval);
      for (let offset = 0; offset < 7; offset++) {
        const day = addDays(week, offset);
        const weekday = day.getDay() as RecurrenceWeekday;
        if (rule.weekdays.includes(weekday) && isAfterFirst(day)) yield day;
      }
    }
    return;
  }

  if (rule.frequency === "monthly") {
    const firstMonth = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);
    for (let step = 0; step <= MAX_OCCURRENCES; step++) {
      const month = addMonths(firstMonth, step * rule.interval);
      if (rule.monthlyBy === "weekday-of-month") {
        const day = getWeekdayOfMonth(
          month,
          firstDay.getDay(),
          rule.weekOfMonth,
        );
        if (isAfterFirst(day)) yield day;
        continue;
      }
      // Months without the day (the 31st in April) are skipped, as RFC 5545 does
      if (firstDay.getDate() > getDaysInMonth(month)) continue;
      const day = new Date(
        month.getFullYear(),
        month.getMonth(),
        firstDay.getDate(),
      );
      if (isAfterFirst(day)) yield day;
    }
    return;
  }

  for (let step = 1; step <= MAX_OCCURRENCES; step++) {
    const year = firstDay.getFullYear() + step * rule.interval;
    const month = new Date(year, firstDay.getMonth(), 1);
    // A Feb 29 series only falls on leap years
    if (firstDay.getDate() > getDaysInMonth(month)) continue;
    yield new Date(year, firstDay.getMonth(), firstDay.getDate());
  }
}

/**
 * Walks the days of a series whose first day is `firstDay`, ends included,
 * and stops when `visit` returns false
 */
function walkOccurrenceDays(
  rule: RecurrenceRule,
  firstDay: Date,
  visit: (day: Date) => boolean,
): void {
  const normalized = normalizeRecurrenceRule(rule, firstDay);
  const lastDay =
    normalized.end.type === "on"
      ? toDayNumber(normalized.end.date)
      : Number.POSITIVE_INFINITY;
  const count =
    normalized.end.type === "after"
      ? Math.min(normalized.end.count, MAX_OCCURRENCES)
      : MAX_OCCURRENCES;

  let seen = 0;
  for (const day of generateOccurrenceDays(normalized, firstDay)) {
    if (seen >= count || toDayNumber(day) > lastDay) return;
    seen++;
    if (!visit(day)) return;
  }
}

/**
 * The day of a series' occurrence right before or after `fromDay` (local
 * midnights of days in the series' zone), or `null` at either end
 */
function getAdjacentOccurrenceDay(
  rule: RecurrenceRule,
  firstDay: Date,
  fromDay: Date,
  direction: "previous" | "next",
): Date | null {
  const from = toDayNumber(fromDay);
  let found: Date | null = null;
  walkOccurrenceDays(rule, firstDay, (day) => {
    const dayNumber = toDayNumber(day);
    if (direction === "next") {
      if (dayNumber <= from) return true;
      found = day;
      return false;
    }
    if (dayNumber >= from) return false;
    found = day;
    return true;
  });
  return found;
}

/**
 * The occurrence of a series right before or after the day of `from`, or
 * `null` at either end of the series. Days and times are counted in
 * `timeZone` (the viewer's when unset), so a 9 AM New York series stays at
 * 9 AM there across daylight saving changes wherever it is viewed. Every
 * occurrence starts at `seriesStart`'s time of day.
 */
export function getAdjacentOccurrence(
  rule: RecurrenceRule,
  seriesStart: Date,
  from: Date,
  direction: "previous" | "next",
  timeZone?: string,
): Date | null {
  const day = getAdjacentOccurrenceDay(
    rule,
    getZonedDay(seriesStart, timeZone),
    getZonedDay(from, timeZone),
    direction,
  );
  if (!day) return null;
  return fromZonedDayTime(
    day,
    getZonedTimeOfDay(seriesStart, timeZone),
    timeZone,
  );
}

/**
 * Id of a series' occurrence on `day` (a local midnight of a day in the
 * series' zone): the series event's id and the date, e.g.
 * "launch-2026-06-20". Generated occurrences, edited ones and the copies
 * ADR-004's arrows stored all carry it.
 */
export function getOccurrenceId(seriesId: string, day: Date): string {
  return `${seriesId}-${format(day, "yyyy-MM-dd")}`;
}

/**
 * The day a copy made by `createSeriesOccurrence` stands for, read from its
 * id, so a copy moved to another day still counts as that day's
 * occurrence. `null` for any other event.
 */
function getOccurrenceDayFromId(
  seriesId: string,
  eventId: string,
): Date | null {
  if (!eventId.startsWith(`${seriesId}-`)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    eventId.slice(seriesId.length + 1),
  );
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Whether two events repeat the same way, so they belong to one series */
function isSameSeries(a: SeriesEvent, b: SeriesEvent): boolean {
  if (a.title !== b.title || a.calendarId !== b.calendarId) return false;
  if (a.recurrenceRule && b.recurrenceRule) {
    const day = getZonedDay(a.start, getEventTimeZone(a));
    return isSameRecurrenceRule(a.recurrenceRule, b.recurrenceRule, day);
  }
  if (a.recurrenceRule || b.recurrenceRule) return false;
  return Boolean(a.recurrence) && a.recurrence === b.recurrence;
}

/** An occurrence that has its event */
function toOccurrence<TEvent extends SeriesEvent>(
  event: TEvent,
): SeriesOccurrence<TEvent> {
  return { id: event.id, start: event.start, event };
}

/**
 * The zone a series counts its days in: its `timeZone` when timed. An
 * all-day series counts the viewer's calendar days, since all-day dates
 * float, as `.ics` DATE values do.
 */
function getRuleTimeZone(event: SeriesEvent): string | undefined {
  return event.isAllDay ? undefined : getEventTimeZone(event);
}

/**
 * The rule the views expand: `recurrenceRule`, or `recurrence` when it is
 * an RRULE a rule can hold. Display text ("Every week on Thu") is only a
 * label: an app that sets it lays out the occurrences itself.
 */
function getExpandableRule(event: SeriesEvent): RecurrenceRule | null {
  if (event.recurrenceRule) return event.recurrenceRule;
  if (!event.recurrence || !isRRule(event.recurrence)) return null;
  return getEventRecurrenceRule(event);
}

/** Whether two events repeat the same way; two that don't repeat do */
function hasSameRecurrence(a: SeriesEvent, b: SeriesEvent): boolean {
  if (a.recurrenceRule && b.recurrenceRule) {
    const day = getZonedDay(a.start, getRuleTimeZone(a));
    return isSameRecurrenceRule(a.recurrenceRule, b.recurrenceRule, day);
  }
  if (a.recurrenceRule || b.recurrenceRule) return false;
  return (a.recurrence ?? "") === (b.recurrence ?? "");
}

/**
 * The series a copy stored by ADR-004's arrows belongs to: the event whose
 * id its own extends with a date (`launch-2026-06-20`), when both repeat
 * the same way. `null` for any other event.
 */
function getCopiedSeries<TEvent extends SeriesEvent>(
  byId: Map<string, TEvent>,
  event: TEvent,
): TEvent | null {
  if (event.seriesId) return null;
  const match = OCCURRENCE_ID_PATTERN.exec(event.id);
  const series = match ? byId.get(match[1]) : undefined;
  if (!series || series.seriesId || !getExpandableRule(series)) return null;
  return hasSameRecurrence(series, event) ? series : null;
}

/** Whether `event` is a series: it repeats and is no other series' occurrence */
function isSeriesEvent<TEvent extends SeriesEvent>(
  byId: Map<string, TEvent>,
  event: TEvent,
): boolean {
  if (event.seriesId || !getExpandableRule(event)) return false;
  return getCopiedSeries(byId, event) === null;
}

/**
 * The series `event` belongs to: the event its `seriesId` names, the series
 * an ADR-004 copy was made from, else `event` itself when it repeats.
 * `null` when it doesn't repeat or only carries display text.
 */
function getSeries<TEvent extends SeriesEvent>(
  byId: Map<string, TEvent>,
  event: TEvent,
): TEvent | null {
  if (event.seriesId) {
    const series = byId.get(event.seriesId);
    return series && isSeriesEvent(byId, series) ? series : null;
  }
  const copied = getCopiedSeries(byId, event);
  if (copied) return copied;
  return isSeriesEvent(byId, event) ? event : null;
}

/** The days `excludedDates` removes from a series, as day numbers in its zone */
function getExcludedDays(
  series: SeriesEvent,
  timeZone: string | undefined,
): Set<number> {
  return new Set(
    (series.excludedDates ?? []).map((date) =>
      toDayNumber(getZonedDay(date, timeZone)),
    ),
  );
}

/**
 * A series' occurrence on `day` (a local midnight of a day in its zone) as
 * the rule gives it: the start's clock time in its zone, the same length
 * (whole days when all-day), `seriesId` and `originalStart`. The series'
 * `excludedDates` stay on the series.
 */
function createOccurrence<TEvent extends SeriesEvent>(
  series: TEvent,
  day: Date,
  timeZone: string | undefined,
): TEvent {
  const start = fromZonedDayTime(
    day,
    getZonedTimeOfDay(series.start, timeZone),
    timeZone,
  );
  const end = series.isAllDay
    ? addDays(start, differenceInCalendarDays(series.end, series.start))
    : new Date(start.getTime() + series.end.getTime() - series.start.getTime());
  return {
    ...series,
    id: getOccurrenceId(series.id, day),
    start,
    end,
    seriesId: series.id,
    originalStart: start,
    excludedDates: undefined,
  };
}

/**
 * The day of its series `event` stands for: the series' first day for the
 * series' event, else its original start's day, the day in its id, or its
 * own day
 */
function getOccurrenceDay(
  series: SeriesEvent,
  event: SeriesEvent,
  timeZone: string | undefined,
): Date {
  if (event.id === series.id) return getZonedDay(series.start, timeZone);
  if (event.originalStart) return getZonedDay(event.originalStart, timeZone);
  return (
    getOccurrenceDayFromId(series.id, event.id) ??
    getZonedDay(event.start, timeZone)
  );
}

/**
 * A series' occurrence on `day`: the event stored for it (with that day's
 * occurrence id, or naming the series and that day through `seriesId` and
 * `originalStart`), the series' event on its first day, else the generated
 * one
 */
function getOccurrenceOnDay<TEvent extends SeriesEvent>(
  events: TEvent[],
  series: TEvent,
  day: Date,
  timeZone: string | undefined,
): TEvent {
  const dayNumber = toDayNumber(day);
  const id = getOccurrenceId(series.id, day);
  const stored = events.find(
    (other) =>
      other.id === id ||
      (other.seriesId === series.id &&
        other.originalStart !== undefined &&
        toDayNumber(getZonedDay(other.originalStart, timeZone)) === dayNumber),
  );
  if (stored) return stored;
  if (dayNumber === toDayNumber(getZonedDay(series.start, timeZone))) {
    return series;
  }
  return createOccurrence(series, day, timeZone);
}

/** Whether an event covers part of `range`; an all-day event covers its last day */
function overlapsRange(event: CalendarEvent, range: VisibleRange): boolean {
  if (event.start >= range.end) return false;
  const end = event.isAllDay ? addDays(event.end, 1) : event.end;
  if (end > range.start) return true;
  // An event with no length counts when it starts in the range
  return end.getTime() === event.start.getTime() && event.start >= range.start;
}

/**
 * The previous or next occurrence of `event`'s series, or `null` when it
 * doesn't repeat or that end of the series is reached.
 *
 * A repeating event (one `expandRecurringEvents` expands) is a series of
 * every occurrence its rule gives, counted from its start in its time zone;
 * `event` can be it, one of its generated occurrences, an edited one
 * (`seriesId`), or a copy ADR-004's arrows stored. Excluded dates are
 * skipped. The occurrence returned is the event stored for that date (an
 * edited occurrence, even moved to another day or renamed), the series'
 * event on its first day, else the one generated for it, so `event` is
 * always set. Occurrences compare by day, so one moved within its day keeps
 * its place.
 *
 * A series known only by display text (`recurrence: "Every week on Mon"`)
 * steps between the events with the same title, calendar and text.
 */
export function findSeriesOccurrence<TEvent extends SeriesEvent>(
  events: TEvent[],
  event: TEvent,
  direction: "previous" | "next",
): SeriesOccurrence<TEvent> | null {
  const byId = new Map(events.map((other) => [other.id, other]));
  const series = getSeries(byId, event);
  if (series) {
    const rule = getExpandableRule(series);
    if (!rule) return null;
    const timeZone = getRuleTimeZone(series);
    const firstDay = getZonedDay(series.start, timeZone);
    const excluded = getExcludedDays(series, timeZone);
    let day = getAdjacentOccurrenceDay(
      rule,
      firstDay,
      getOccurrenceDay(series, event, timeZone),
      direction,
    );
    while (day && excluded.has(toDayNumber(day))) {
      day = getAdjacentOccurrenceDay(rule, firstDay, day, direction);
    }
    if (!day) return null;
    return toOccurrence(getOccurrenceOnDay(events, series, day, timeZone));
  }

  if (!event.recurrence) return null;
  const textSeries = events
    .filter((other) => other.id === event.id || isSameSeries(other, event))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const index = textSeries.findIndex((other) => other.id === event.id);
  const neighbor = textSeries[direction === "next" ? index + 1 : index - 1];
  return neighbor ? toOccurrence(neighbor) : null;
}

/**
 * A stored copy of `event` for one of its series' occurrences: the
 * occurrence's id and start, with the event's duration. The provider no
 * longer stores copies (ADR-007); it is kept for apps that store their
 * occurrences themselves.
 */
export function createSeriesOccurrence<TEvent extends CalendarEvent>(
  event: TEvent,
  occurrence: Pick<SeriesOccurrence, "id" | "start">,
): TEvent {
  const duration = event.end.getTime() - event.start.getTime();
  return {
    ...event,
    id: occurrence.id,
    start: occurrence.start,
    end: new Date(occurrence.start.getTime() + duration),
  };
}

/** The occurrences of `series` that cover part of `range`, see `expandRecurringEvents` */
function getOccurrencesInRange<TEvent extends SeriesEvent>(
  series: TEvent,
  range: VisibleRange,
  storedIds: Set<string>,
): TEvent[] {
  const rule = getExpandableRule(series);
  if (!rule) return [];
  const timeZone = getRuleTimeZone(series);
  const firstDay = getZonedDay(series.start, timeZone);
  const firstDayNumber = toDayNumber(firstDay);
  const excluded = getExcludedDays(series, timeZone);
  // Days too early to reach the range: before it by more than the event
  // lasts, plus a day for the zone's offset
  const lengthDays = Math.ceil(
    (series.end.getTime() - series.start.getTime()) / DAY_MS,
  );
  const earliest = toDayNumber(range.start) - lengthDays - 1;

  const occurrences: TEvent[] = [];
  walkOccurrenceDays(rule, firstDay, (day) => {
    const dayNumber = toDayNumber(day);
    if (dayNumber < earliest) return true;
    const occurrence =
      dayNumber === firstDayNumber
        ? series
        : createOccurrence(series, day, timeZone);
    if (occurrence.start >= range.end) return false;
    if (excluded.has(dayNumber)) return true;
    if (storedIds.has(getOccurrenceId(series.id, day))) return true;
    if (!overlapsRange(occurrence, range)) return true;
    occurrences.push(occurrence);
    return occurrences.length < MAX_OCCURRENCES_PER_RANGE;
  });
  return occurrences;
}

/**
 * What to draw for the dates in `range` (end exclusive): each event that
 * doesn't repeat as it is, in range or not, and in place of each
 * repeating event its occurrences that cover part of the range, in date
 * order.
 *
 * A repeating event has a `recurrenceRule` (or an RRULE in `recurrence`)
 * and no `seriesId`. It stands for its first occurrence; the others are
 * generated, never stored: the event's fields, the start's clock time in
 * its `timeZone` on each day the rule gives (daylight saving changes don't
 * move it; an all-day series keeps whole days), the id
 * `<series id>-<yyyy-MM-dd>`, `seriesId` and `originalStart`. A day is left
 * out when `excludedDates` names it, when a stored event has that day's
 * occurrence id (an edited occurrence, or a copy ADR-004's arrows stored),
 * or when a stored event names the series and that day with `seriesId` and
 * `originalStart`. One series returns at most `MAX_OCCURRENCES_PER_RANGE`.
 */
export function expandRecurringEvents<TEvent extends SeriesEvent>(
  events: TEvent[],
  range: VisibleRange,
): TEvent[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  // Occurrence ids that stored events stand for: their own ids, and the
  // day an edited occurrence names through `originalStart`
  const storedIds = new Set(byId.keys());
  for (const event of events) {
    const series = event.seriesId ? byId.get(event.seriesId) : undefined;
    if (!series || !event.originalStart) continue;
    const day = getZonedDay(event.originalStart, getRuleTimeZone(series));
    storedIds.add(getOccurrenceId(series.id, day));
  }

  const expanded: TEvent[] = [];
  for (const event of events) {
    if (!isSeriesEvent(byId, event)) {
      expanded.push(event);
      continue;
    }
    expanded.push(...getOccurrencesInRange(event, range, storedIds));
  }
  return expanded;
}

/**
 * The event with this id: a stored one, or the occurrence of a repeating
 * event it names (`<series id>-<yyyy-MM-dd>`), generated as the views draw
 * it. `null` when there is neither: an unknown id, or a day its series
 * skips, excludes or stores under another id.
 */
export function findEventOrOccurrence<TEvent extends SeriesEvent>(
  events: TEvent[],
  id: string,
): TEvent | null {
  const stored = events.find((event) => event.id === id);
  if (stored) return stored;
  const match = OCCURRENCE_ID_PATTERN.exec(id);
  if (!match) return null;
  const day = new Date(
    Number(match[2]),
    Number(match[3]) - 1,
    Number(match[4]),
  );
  // A day either side covers the series' zone offset
  const range = { start: addDays(day, -1), end: addDays(day, 2) };
  return (
    expandRecurringEvents(events, range).find((event) => event.id === id) ??
    null
  );
}

/**
 * A rule moved with its series' event from `fromDay` to `toDay` (local
 * midnights of days in the series' zone), as Google Calendar's "All
 * events" moves a series: a weekly rule's written-out weekdays shift by
 * the same number of days, and a monthly rule on a weekday of the month
 * takes the new day's place in its month (the last stays the last when the
 * new day is also the last). Rules that read their day from the start come
 * back as they are.
 */
export function moveRecurrenceRule(
  rule: RecurrenceRule,
  fromDay: Date,
  toDay: Date,
): RecurrenceRule {
  const shift = toDayNumber(toDay) - toDayNumber(fromDay);
  if (shift === 0) return rule;

  if (rule.frequency === "weekly" && rule.weekdays?.length) {
    const offset = ((shift % 7) + 7) % 7;
    if (offset === 0) return rule;
    const weekdays = [
      ...new Set(
        rule.weekdays.map((day) => ((day + offset) % 7) as RecurrenceWeekday),
      ),
    ].sort((a, b) => a - b);
    return { ...rule, weekdays };
  }

  if (
    rule.frequency === "monthly" &&
    rule.monthlyBy === "weekday-of-month" &&
    rule.weekOfMonth !== undefined
  ) {
    const isLast = toDay.getDate() + 7 > getDaysInMonth(toDay);
    const weekOfMonth =
      rule.weekOfMonth === -1 && isLast ? -1 : getWeekOfMonth(toDay);
    if (weekOfMonth === rule.weekOfMonth) return rule;
    return { ...rule, weekOfMonth };
  }

  return rule;
}

/**
 * The event to store for an edit of `previous` (a stored event, or an
 * occurrence `findEventOrOccurrence` generated), until edits ask "this
 * event or all events":
 *
 * - An occurrence changes alone and keeps `seriesId` and `originalStart`,
 *   so it replaces its date's generated occurrence. A new repeat rule
 *   takes it out of its series instead: it repeats on its own from its
 *   date, and its id still names that date, so the series doesn't draw it
 *   twice.
 * - The series' own event stands for the series, so every occurrence
 *   follows it. Moved to another day, it takes its rule along
 *   (`moveRecurrenceRule`).
 * - Any other event is stored as edited.
 */
export function applyRecurringEdit<TEvent extends SeriesEvent>(
  events: TEvent[],
  previous: TEvent,
  edited: TEvent,
): TEvent {
  const byId = new Map(events.map((event) => [event.id, event]));
  const series = getSeries(byId, previous);
  if (!series) return edited;

  if (series.id !== previous.id) {
    if (hasSameRecurrence(previous, edited)) return edited;
    return { ...edited, seriesId: undefined, originalStart: undefined };
  }

  // A rule changed in the details is the new rule, as set
  const rule = edited.recurrenceRule;
  if (!rule || rule !== previous.recurrenceRule) return edited;
  const moved = moveRecurrenceRule(
    rule,
    getZonedDay(previous.start, getRuleTimeZone(previous)),
    getZonedDay(edited.start, getRuleTimeZone(edited)),
  );
  if (moved === rule) return edited;
  return { ...edited, recurrenceRule: moved };
}

/**
 * What deleting one date of a repeating series changes: `event` is an
 * occurrence of a series (generated, edited and stored, or a copy ADR-004's
 * arrows stored) and `removed` is the stored event that goes (`event`
 * itself when it is stored, else `null`). `series` is the series' event as
 * stored and `excluded` the same event with the date added to its
 * `excludedDates`, so the date is no longer drawn. `null` when `event` is
 * the series' own event or doesn't belong to a series: deleting those
 * removes the event.
 */
export function getOccurrenceRemoval<TEvent extends SeriesEvent>(
  events: TEvent[],
  event: TEvent,
): { series: TEvent; excluded: TEvent; removed: TEvent | null } | null {
  const byId = new Map(events.map((other) => [other.id, other]));
  const series = getSeries(byId, event);
  if (!series || series.id === event.id) return null;
  const stored = byId.get(event.id) ?? null;
  const timeZone = getRuleTimeZone(series);
  const day = getOccurrenceDay(series, event, timeZone);
  const date =
    event.originalStart ??
    fromZonedDayTime(day, getZonedTimeOfDay(series.start, timeZone), timeZone);
  const dayNumber = toDayNumber(day);
  const isExcluded = getExcludedDays(series, timeZone).has(dayNumber);
  const excluded = isExcluded
    ? series
    : { ...series, excludedDates: [...(series.excludedDates ?? []), date] };
  return { series, excluded, removed: stored };
}

/**
 * A copy of `event` under a new id that is no occurrence of any series: it
 * drops `seriesId` and `originalStart`, and keeps its repeat rule, so it
 * repeats on its own from its date (Google Calendar's "Duplicate").
 */
export function createStandaloneCopy<TEvent extends SeriesEvent>(
  event: TEvent,
  id: string,
): TEvent {
  const copy: TEvent = { ...event, id };
  delete copy.seriesId;
  delete copy.originalStart;
  return copy;
}
