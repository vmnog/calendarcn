import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
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
    "calendarId" | "recurrenceRule" | "recurrence" | "timeZone" | "timezone"
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
 * Id of the copy that stands for a series' occurrence on `day`: the id of
 * the series' first event and the date, e.g. "launch-2026-06-20"
 */
function getOccurrenceId(seriesId: string, day: Date): string {
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
 * The previous or next occurrence of `event`'s series, or `null` when it
 * doesn't repeat or that end of the series is reached.
 *
 * A series is the events with the same title, calendar and repeat rule.
 * With a `recurrenceRule`, occurrences are counted from the series' earliest
 * event, in the event's time zone, so the ones the list has no event for
 * are found too (returned with their start and the id a copy of them gets,
 * see `createSeriesOccurrence`). An occurrence is the event the list has on
 * that day, else the copy made for it, even if it was moved to another day
 * or renamed since. Occurrences compare by day, so an event moved within its
 * day is still that day's occurrence. A series known only by its
 * `recurrence` text steps between the events the list has, so moved and
 * skipped occurrences stay as the app set them; a lone event with a
 * readable text rule is counted like a `recurrenceRule`.
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
    const timeZone = getEventTimeZone(event);
    const first = series[0];
    const day = getAdjacentOccurrenceDay(
      rule,
      getZonedDay(first.start, timeZone),
      getOccurrenceDayFromId(first.id, event.id) ??
        getZonedDay(event.start, timeZone),
      direction,
    );
    if (!day) return null;

    const dayNumber = toDayNumber(day);
    const id = getOccurrenceId(first.id, day);
    const match =
      series.find(
        (other) =>
          toDayNumber(getZonedDay(other.start, timeZone)) === dayNumber,
      ) ?? events.find((other) => other.id === id);
    if (match) return toOccurrence(match);
    const start = fromZonedDayTime(
      day,
      getZonedTimeOfDay(first.start, timeZone),
      timeZone,
    );
    return { id, start };
  }

  const index = series.findIndex((other) => other.id === event.id);
  const neighbor = series[direction === "next" ? index + 1 : index - 1];
  return neighbor ? toOccurrence(neighbor) : null;
}

/**
 * A copy of `event` for an occurrence of its series that the events don't
 * have yet (`findSeriesOccurrence` without an `event`): the occurrence's id
 * and start, with the event's duration
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
