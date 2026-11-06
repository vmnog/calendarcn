import {
  addDays,
  addMinutes,
  differenceInMinutes,
  format,
  parse,
  startOfDay,
} from "date-fns";
import type { Locale } from "date-fns";

import type {
  DetailedCalendarEvent,
  HourCycle,
  TimeOption,
} from "@/components/week-view-types";

/** Minutes between two options of the time menu, as in Notion Calendar */
const TIME_STEP_MINUTES = 15;

/** Minutes in a day on the wall clock */
const MINUTES_PER_DAY = 24 * 60;

/** Options in a day of the time menu: every TIME_STEP_MINUTES from midnight */
const TIME_OPTIONS_PER_DAY = MINUTES_PER_DAY / TIME_STEP_MINUTES;

/** A bare hour like "7" prefers the reading between 8 AM and 8 PM: 7 PM */
const DAYTIME_START_MINUTES = 8 * 60;

/** End of the daytime a bare hour prefers (8 PM) */
const DAYTIME_END_MINUTES = 20 * 60;

/**
 * A number typed as a duration below this reads as hours first ("2" → 2h,
 * then 2min), from it as minutes first ("45" → 45min, then 45h)
 */
const DURATION_HOURS_FIRST_BELOW = 15;

/** Longest duration a typed number may stand for: a week */
const MAX_TYPED_DURATION_MINUTES = 7 * 24 * 60;

/** Formats a time for the time menu: "4:15 PM", or "16:15" on a 24-hour clock */
type FormatTime = (date: Date) => string;

/** "45min", "2h" or "1h 30min" */
export function formatDuration(start: Date, end: Date): string {
  const totalMinutes = differenceInMinutes(end, start);

  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}min`;
}

/**
 * Returns a new Date with the same year/month/day as `base`
 * but with hours and minutes replaced.
 */
export function applyTimeToDate(
  base: Date,
  hours: number,
  minutes: number,
): Date {
  const result = new Date(base);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * The time `minutes` after midnight on `day`'s wall clock, or null when the
 * clock skips it (2:30 AM on the day daylight saving time starts). Counting
 * elapsed minutes from midnight instead would land an hour off on that day
 * and on the day it ends.
 */
function clockTime(day: Date, minutes: number): Date | null {
  const date = applyTimeToDate(day, Math.floor(minutes / 60), minutes % 60);
  if (date.getHours() * 60 + date.getMinutes() !== minutes) return null;
  return date;
}

/** Minutes typed after an hour: "3" means 30 ("7:3" → 7:30), "7" means 07 ("3:7" → 3:07) */
function readTypedMinutes(digits: string): number {
  if (digits.length === 0) return 0;
  if (digits.length > 1) return Number(digits);
  const digit = Number(digits);
  return digit < 6 ? digit * 10 : digit;
}

/** Text typed in a time field, lowercased, without spaces or dots */
function normalizeTyped(text: string): string {
  return text.toLowerCase().replace(/[\s.]/g, "");
}

/**
 * Times of day (minutes from midnight) typed text can mean, best first, as
 * Notion Calendar reads them: "7" → 7 PM, 7 AM; "9" → 9 AM, 9 PM (a bare
 * hour prefers 8 AM–8 PM); "12" → 12 PM, 12 AM, 1:20 PM, 1:20 AM (the first
 * digit as the hour too); "930" → 9:30 AM, 9:30 PM; "7:3p" → 7:30 PM. On a
 * 24-hour clock a bare hour reads as written first: "7" → 07:00, 19:00.
 */
function readTypedTimes(text: string, hourCycle: HourCycle): number[] {
  const match = /^(\d{1,4})(?::(\d{0,2}))?(a|am|p|pm)?$/.exec(
    normalizeTyped(text),
  );
  if (!match) return [];
  const [, digits, colonMinutes, period] = match;

  const readings: Array<{ hour: number; minute: number }> = [];
  if (colonMinutes !== undefined) {
    if (digits.length <= 2) {
      readings.push({
        hour: Number(digits),
        minute: readTypedMinutes(colonMinutes),
      });
    }
  } else {
    if (digits.length <= 2) {
      readings.push({ hour: Number(digits), minute: 0 });
    }
    if (digits.length >= 2 && digits.length <= 3) {
      readings.push({
        hour: Number(digits[0]),
        minute: readTypedMinutes(digits.slice(1)),
      });
    }
    if (digits.length >= 3) {
      readings.push({
        hour: Number(digits.slice(0, 2)),
        minute: readTypedMinutes(digits.slice(2)),
      });
    }
  }

  const times: number[] = [];
  for (const { hour, minute } of readings) {
    if (minute > 59) continue;
    for (const minutes of readHour(hour, period, hourCycle)) {
      const time = minutes + minute;
      if (!times.includes(time)) times.push(time);
    }
  }
  return times;
}

/**
 * Minutes from midnight an hour can mean, best first: one with "am"/"pm" or
 * outside 1–12, the daytime one first otherwise
 */
function readHour(
  hour: number,
  period: string | undefined,
  hourCycle: HourCycle,
): number[] {
  if (period) {
    if (hour < 1 || hour > 12) return [];
    const isPm = period.startsWith("p");
    return [((hour % 12) + (isPm ? 12 : 0)) * 60];
  }
  if (hour > 23) return [];
  if (hour === 0 || hour > 12) return [hour * 60];

  const morning = (hour % 12) * 60;
  const evening = morning + 12 * 60;
  if (hourCycle === 24) return [hour * 60, hour === 12 ? 0 : evening];
  const isDaytime = (minutes: number) =>
    minutes >= DAYTIME_START_MINUTES && minutes < DAYTIME_END_MINUTES;
  if (isDaytime(evening) && !isDaytime(morning)) return [evening, morning];
  return [morning, evening];
}

/**
 * Durations (minutes) typed text can mean in the end field, best first:
 * "2" → 2h, 2min; "45" → 45min, 45h; "8:30" → 8h 30min; "1h30" → 1h 30min.
 * Text with "am" or "pm" is a time, never a duration.
 */
function readTypedDurations(text: string): number[] {
  const typed = normalizeTyped(text);
  const durations: number[] = [];

  const units = /^(?:(\d{1,3})h)?(?:(\d{1,4})(?:m|min|mins)?)?$/.exec(typed);
  const clock = /^(\d{1,3})(?::(\d{0,2}))?$/.exec(typed);
  if (clock) {
    const [, digits, colonMinutes] = clock;
    const number = Number(digits);
    if (colonMinutes !== undefined) {
      const minutes = readTypedMinutes(colonMinutes);
      if (minutes < 60) durations.push(number * 60 + minutes);
    } else if (number < DURATION_HOURS_FIRST_BELOW) {
      durations.push(number * 60, number);
    } else {
      durations.push(number, number * 60);
    }
  } else if (units && (units[1] || units[2])) {
    durations.push(Number(units[1] ?? 0) * 60 + Number(units[2] ?? 0));
  }

  return durations.filter(
    (minutes, index) =>
      minutes > 0 &&
      minutes <= MAX_TYPED_DURATION_MINUTES &&
      durations.indexOf(minutes) === index,
  );
}

/** The dates in order, each time once */
function uniqueDates(dates: Date[]): Date[] {
  return dates.filter(
    (date, index) =>
      dates.findIndex((other) => other.getTime() === date.getTime()) === index,
  );
}

/** The options' list with `value` in its place, when it's between two steps */
function withValue(options: TimeOption[], value: TimeOption): TimeOption[] {
  const time = value.date.getTime();
  if (options.some((option) => option.date.getTime() === time)) {
    return options;
  }
  const index = options.findIndex((option) => option.date.getTime() > time);
  if (index === -1) return [...options, value];
  return [...options.slice(0, index), value, ...options.slice(index)];
}

/**
 * Every 15 minutes of `day` on its wall clock: 96 times, 92 on the day
 * daylight saving time starts (the skipped hour), and each 1 AM–1:45 AM
 * once on the day it ends
 */
function getDayTimes(day: Date): Date[] {
  const midnight = startOfDay(day);
  const times: Date[] = [];
  for (let i = 0; i < TIME_OPTIONS_PER_DAY; i++) {
    const date = clockTime(midnight, i * TIME_STEP_MINUTES);
    if (date) times.push(date);
  }
  return times;
}

/** Every 15 minutes after `start` on the wall clock, up to the same time a day later */
function getTimesAfter(start: Date): Date[] {
  const midnight = startOfDay(start);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const times: Date[] = [];
  for (let i = 1; i <= TIME_OPTIONS_PER_DAY; i++) {
    const minutes = startMinutes + i * TIME_STEP_MINUTES;
    const day = addDays(midnight, Math.floor(minutes / MINUTES_PER_DAY));
    const date = clockTime(day, minutes % MINUTES_PER_DAY);
    if (date && date > start) times.push(date);
  }
  return times;
}

/**
 * Whether an event ends after the midnight that closes its first day, so
 * its end time needs a date (an end at that midnight doesn't)
 */
export function endsOnLaterDay(start: Date, end: Date): boolean {
  return end > addDays(startOfDay(start), 1);
}

/** The start time menu: every 15 minutes of the start's day, with the start in its place */
export function getStartTimeOptions(
  start: Date,
  formatTime: FormatTime,
): TimeOption[] {
  const options = getDayTimes(start).map((date) => ({
    date,
    label: formatTime(date),
  }));
  return withValue(options, { date: start, label: formatTime(start) });
}

/**
 * The end time menu, each option with how long the event lasts: every 15
 * minutes after the start for a day, or every 15 minutes of the end's day
 * for an event that ends on a later day; the end in its place
 */
export function getEndTimeOptions(
  start: Date,
  end: Date,
  formatTime: FormatTime,
): TimeOption[] {
  const toOption = (date: Date): TimeOption => ({
    date,
    label: formatTime(date),
    hint: formatDuration(start, date),
  });
  const dates = endsOnLaterDay(start, end)
    ? getDayTimes(end).filter((date) => date > start)
    : getTimesAfter(start);
  const options = dates.map(toOption);
  return end > start ? withValue(options, toOption(end)) : options;
}

/** Start times typed text can mean on the start's day, best first */
export function matchStartTimes(
  text: string,
  start: Date,
  hourCycle: HourCycle,
  formatTime: FormatTime,
): TimeOption[] {
  const midnight = startOfDay(start);
  return readTypedTimes(text, hourCycle).flatMap((minutes) => {
    const date = clockTime(midnight, minutes);
    return date ? [{ date, label: formatTime(date) }] : [];
  });
}

/**
 * End times typed text can mean, best first, with how long the event lasts:
 * times of the end's day after the start (the next day's when they aren't),
 * then durations from the start
 */
export function matchEndTimes(
  text: string,
  start: Date,
  end: Date,
  hourCycle: HourCycle,
  formatTime: FormatTime,
): TimeOption[] {
  const midnight = startOfDay(endsOnLaterDay(start, end) ? end : start);
  const dates: Date[] = [];
  for (const minutes of readTypedTimes(text, hourCycle)) {
    const sameDay = clockTime(midnight, minutes);
    const date =
      sameDay && sameDay > start
        ? sameDay
        : clockTime(addDays(midnight, 1), minutes);
    if (date) dates.push(date);
  }
  for (const minutes of readTypedDurations(text)) {
    dates.push(addMinutes(start, minutes));
  }
  return uniqueDates(dates).map((date) => ({
    date,
    label: formatTime(date),
    hint: formatDuration(start, date),
  }));
}

/** "Sat Jun 6", in the calendar's locale */
export function formatDateDisplay(date: Date, locale: Locale): string {
  return format(date, "EEE MMM d", { locale });
}

/**
 * Parses a user-typed date string into a Date.
 * Strips any leading weekday name and parses "MMM d" (e.g., "Mar 11") in
 * the calendar's locale. Uses the reference date's year. Returns null if
 * unparseable.
 */
export function parseDateInput(
  input: string,
  referenceDate: Date,
  locale: Locale,
): Date | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Strip an optional leading weekday ("Tue ", "sáb ") when a month name follows
  const withoutWeekday = trimmed.replace(/^[^\s\d]+\s+(?=[^\s\d])/, "");

  const parsed = parse(withoutWeekday, "MMM d", referenceDate, { locale });
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/** Whether the event has a time of day (an all-day event's are all midnight) */
export function hasTimeOfDay(event: DetailedCalendarEvent): boolean {
  return (
    event.start.getHours() !== 0 ||
    event.start.getMinutes() !== 0 ||
    event.end.getHours() !== 0 ||
    event.end.getMinutes() !== 0
  );
}
