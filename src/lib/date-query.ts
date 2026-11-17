import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns";
import { enUS } from "date-fns/locale";
import type { Locale } from "date-fns";

import type { WeekStartsOn } from "@/components/calendar-types";

/** What a typed date counts from, and how it reads month and day names */
export interface DateQueryOptions {
  /** The day "today", "tomorrow" and "in 2 weeks" count from */
  today: Date;
  /**
   * Locale for month and weekday names and the order of a numeric date
   * ("12/25" in en-US, "25/12" in en-GB). English names always work too.
   * Defaults to en-US
   */
  locale?: Locale;
  /**
   * Day the week starts on, for "next week" and "next friday". Defaults to
   * the locale's first day
   */
  weekStartsOn?: WeekStartsOn;
}

/** A period phrases count in: "in 2 weeks", "next month" */
type QueryUnit = "day" | "week" | "month" | "year";

/** Where a weekday or period phrase points: "last", "this" or "next" */
type QueryDirection = -1 | 0 | 1;

/** Years to look ahead for a date without a year: Feb 29 comes back within four */
const LEAP_YEAR_CYCLE = 4;

/** Fewest letters a typed name needs to match a month or weekday by its start ("sept", "thurs") */
const MIN_NAME_PREFIX = 3;

/** One-word dates, as days from today */
const DAY_WORDS: Record<string, number> = {
  today: 0,
  tod: 0,
  now: 0,
  tomorrow: 1,
  tmr: 1,
  tmrw: 1,
  tom: 1,
  yesterday: -1,
  yday: -1,
};

/** Words for the direction of "next friday", "last week", "this month" */
const DIRECTION_WORDS: Record<string, QueryDirection> = {
  next: 1,
  last: -1,
  previous: -1,
  prev: -1,
  this: 0,
  current: 0,
};

/** Unit words of "in 2 weeks" and "next month", singular and plural */
const UNIT_WORDS: Record<string, QueryUnit> = {
  d: "day",
  day: "day",
  days: "day",
  w: "week",
  wk: "week",
  wks: "week",
  week: "week",
  weeks: "week",
  m: "month",
  mo: "month",
  month: "month",
  months: "month",
  y: "year",
  yr: "year",
  yrs: "year",
  year: "year",
  years: "year",
};

/** Words dropped before reading a date: "the 25th of december", "25 de dezembro" */
const FILLER_WORDS = new Set(["the", "of", "on", "de", "del"]);

/** Adds an amount of a unit to a day */
const ADD_UNIT: Record<QueryUnit, (date: Date, amount: number) => Date> = {
  day: addDays,
  week: addWeeks,
  month: addMonths,
  year: addYears,
};

/** Lowercase, without accents, trailing dots or commas: "Déc." → "dec" */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.$/, "");
}

/**
 * Whether a typed word names `names` (a month's or a weekday's names, full
 * name first): one of them exactly, or the start of the full name from
 * MIN_NAME_PREFIX letters ("sept", "thurs")
 */
function matchesName(word: string, names: string[]): boolean {
  if (names.includes(word)) return true;
  return (
    word.length >= MIN_NAME_PREFIX &&
    names.some((name) => name.startsWith(word))
  );
}

/** The locales whose names count: the calendar's first, then English */
function nameLocales(locale: Locale): Locale[] {
  return locale.code === enUS.code ? [locale] : [locale, enUS];
}

/** Month (0-11) a word names, in the locale or English, or -1 */
function readMonth(word: string, locale: Locale): number {
  for (const nameLocale of nameLocales(locale)) {
    for (let month = 0; month < 12; month++) {
      const date = new Date(2000, month, 1);
      const names = ["MMMM", "LLLL", "MMM", "LLL"].map((pattern) =>
        normalizeName(format(date, pattern, { locale: nameLocale })),
      );
      if (matchesName(word, names)) return month;
    }
  }
  return -1;
}

/** Weekday (0 = Sunday) a word names, in the locale or English, or -1 */
function readWeekday(word: string, locale: Locale): number {
  for (const nameLocale of nameLocales(locale)) {
    for (let weekday = 0; weekday < 7; weekday++) {
      // January 2, 2000 was a Sunday
      const date = new Date(2000, 0, 2 + weekday);
      const names = ["EEEE", "cccc", "EEE", "ccc", "EEEEEE"].map((pattern) =>
        normalizeName(format(date, pattern, { locale: nameLocale })),
      );
      if (matchesName(word, names)) return weekday;
    }
  }
  return -1;
}

/** The day `month`/`day` of `year`, or null when it doesn't exist (Feb 30) */
function calendarDay(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(year, month, day);
  if (date.getMonth() !== month || date.getDate() !== day) return null;
  // Years 0-99 would land in 1900-1999
  date.setFullYear(year);
  return date;
}

/** A two-digit year in the 2000s ("27" → 2027), others as written */
function readYear(digits: string): number {
  const year = Number(digits);
  return digits.length <= 2 ? 2000 + year : year;
}

/**
 * The next `month`/`day` from today, today included: "dec 25" typed in
 * November is this year's, "oct 30" next year's, as Notion Calendar reads
 * them. Feb 29 waits for the next leap year.
 */
function nextCalendarDay(month: number, day: number, today: Date): Date | null {
  for (let shift = 0; shift <= LEAP_YEAR_CYCLE; shift++) {
    const candidate = calendarDay(today.getFullYear() + shift, month, day);
    if (candidate && differenceInCalendarDays(candidate, today) >= 0) {
      return candidate;
    }
  }
  return null;
}

/** The next day `day` of a month from today, today included: "3rd" typed on the 17th is next month's */
function nextDayOfMonth(day: number, today: Date): Date | null {
  for (let shift = 0; shift < 12; shift++) {
    const month = addMonths(startOfMonth(today), shift);
    const candidate = calendarDay(month.getFullYear(), month.getMonth(), day);
    if (candidate && differenceInCalendarDays(candidate, today) >= 0) {
      return candidate;
    }
  }
  return null;
}

/**
 * The first day of `month` in the year nearest to today's month: "jan" typed
 * in November means the coming January, "oct" the October just gone
 */
function nearestMonthStart(month: number, today: Date): Date {
  const year = today.getFullYear();
  const candidates = [year, year + 1, year - 1].map(
    (candidateYear) => new Date(candidateYear, month, 1),
  );
  const distance = (date: Date) =>
    Math.abs(differenceInCalendarMonths(date, today));
  return candidates.reduce((nearest, candidate) =>
    distance(candidate) < distance(nearest) ? candidate : nearest,
  );
}

/** "in 2 weeks", "3 days ago", "2 weeks from now", "+3d", "-1w" */
function readOffset(text: string, today: Date): Date | null {
  const amountPattern = "(\\d+|a|an|one)";
  const unitPattern = "([a-z]+)";
  const forward =
    new RegExp(`^in ${amountPattern} ?${unitPattern}$`).exec(text) ??
    new RegExp(`^${amountPattern} ?${unitPattern} from (?:now|today)$`).exec(
      text,
    );
  const backward = new RegExp(`^${amountPattern} ?${unitPattern} ago$`).exec(
    text,
  );
  const signed = /^([+-])(\d+) ?([a-z]*)$/.exec(text);

  const read = (amountText: string, unitText: string, sign: 1 | -1) => {
    const unit = unitText === "" ? "day" : UNIT_WORDS[unitText];
    if (!unit) return null;
    const amount = /^\d+$/.test(amountText) ? Number(amountText) : 1;
    return ADD_UNIT[unit](today, sign * amount);
  };

  if (forward) return read(forward[1], forward[2], 1);
  if (backward) return read(backward[1], backward[2], -1);
  if (signed) return read(signed[2], signed[3], signed[1] === "-" ? -1 : 1);
  return null;
}

/** First day of a period: "next week" → the next week's first day, "this month" → the 1st */
function periodStart(
  unit: QueryUnit,
  direction: QueryDirection,
  today: Date,
  weekStartsOn: WeekStartsOn,
): Date {
  const shifted = ADD_UNIT[unit](today, direction);
  if (unit === "week") return startOfWeek(shifted, { weekStartsOn });
  if (unit === "month") return startOfMonth(shifted);
  if (unit === "year") return startOfYear(shifted);
  return shifted;
}

/**
 * A weekday: on its own the next one from today (today when it matches);
 * with a direction, that weekday in the last, this or next week, by
 * `weekStartsOn`
 */
function weekdayDate(
  weekday: number,
  direction: QueryDirection | null,
  today: Date,
  weekStartsOn: WeekStartsOn,
): Date {
  if (direction === null) {
    return addDays(today, (weekday - today.getDay() + 7) % 7);
  }
  const weekStart = startOfWeek(addWeeks(today, direction), { weekStartsOn });
  return addDays(weekStart, (weekday - weekStartsOn + 7) % 7);
}

/**
 * "12/25", "25.12.", "12-25-2027", "2027-12-25": a numeric date in the
 * locale's order (month first in en-US, day first in en-GB), or year first
 * when the first number has four digits
 */
function readNumericDate(
  text: string,
  today: Date,
  locale: Locale,
): Date | null {
  const match = /^(\d{1,4})([/.-])(\d{1,2})(?:\2(\d{1,4}))?\.?$/.exec(text);
  if (!match) return null;
  const [, first, , second, third] = match;

  if (first.length === 4) {
    if (third === undefined) return null;
    return calendarDay(Number(first), Number(second) - 1, Number(third));
  }
  if (first.length > 2 || (third !== undefined && third.length === 3)) {
    return null;
  }

  const pattern = locale.formatLong?.date({ width: "short" }) ?? "MM/dd/yyyy";
  const yearFirst = pattern.search(/y/i) < pattern.search(/d/);
  // Year-first locales ("y/MM/dd") write month before day once the year is gone
  const monthFirst = yearFirst || pattern.indexOf("M") < pattern.indexOf("d");
  const [month, day] = monthFirst
    ? [Number(first) - 1, Number(second)]
    : [Number(second) - 1, Number(first)];

  if (third === undefined) return nextCalendarDay(month, day, today);
  return calendarDay(readYear(third), month, day);
}

/**
 * "dec 25", "25 december", "december 25 2027", "jan", "march 2027": a date
 * with a month name. Without a year it's the next one from today; a month
 * alone is its first day, in the year nearest to today.
 */
function readNamedDate(
  words: string[],
  today: Date,
  locale: Locale,
): Date | null {
  const monthIndex = words.findIndex((word) => readMonth(word, locale) !== -1);
  if (monthIndex === -1 || words.length > 3) return null;
  const month = readMonth(words[monthIndex], locale);
  const numbers = words.filter((_, index) => index !== monthIndex);
  if (!numbers.every((word) => /^\d{1,4}$/.test(word))) return null;

  if (numbers.length === 0) return nearestMonthStart(month, today);

  const [firstNumber, secondNumber] = numbers;
  if (numbers.length === 1) {
    // "december 2027": the month's first day; "december 25": that day
    if (firstNumber.length === 4) {
      return calendarDay(Number(firstNumber), month, 1);
    }
    if (firstNumber.length > 2) return null;
    return nextCalendarDay(month, Number(firstNumber), today);
  }

  // "december 25 2027" or "25 december 2027": the day before the year
  if (firstNumber.length > 2 || secondNumber.length === 3) return null;
  return calendarDay(readYear(secondNumber), month, Number(firstNumber));
}

/**
 * Reads a date typed into Go to date, or returns null when the text isn't
 * one. Accepts, case-insensitively:
 *
 * - "today", "tomorrow", "yesterday"
 * - a weekday: "friday" (the next one, today included), "next friday" (in
 *   next week), "this friday", "last friday"
 * - "next week", "last month", "this year": the period's first day
 * - "in 2 weeks", "in a month", "3 days ago", "2 weeks from now", "+3d"
 * - a month name with a day and year in either order: "dec 25",
 *   "25 december", "December 25th, 2027", "sept 5"; a month alone ("jan")
 *   or with a year ("march 2027") is its first day
 * - a numeric date in the locale's order: "12/25" and "12/25/2027" in
 *   en-US, "25/12" in en-GB, "25.12." in German, and "2027-12-25" anywhere
 * - a day of the month ("25", "25th": the next one), or a year ("2027")
 *
 * A leading weekday is skipped ("Fri Dec 25"). Month and weekday names come
 * from the locale and from English. A date without a year is the next one
 * from today, today included, as in Notion Calendar ("oct 30" typed in
 * November is next year's). The result is the day's midnight.
 */
export function parseDateQuery(
  text: string,
  { today: todayInput, locale = enUS, weekStartsOn }: DateQueryOptions,
): Date | null {
  const today = startOfDay(todayInput);
  const weekStart = weekStartsOn ?? locale.options?.weekStartsOn ?? 0;
  const normalized = normalizeName(text.trim())
    .replace(/,/g, " ")
    .replace(/(\d)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length === 0) return null;

  if (normalized in DAY_WORDS) return addDays(today, DAY_WORDS[normalized]);

  const offset = readOffset(normalized, today);
  if (offset) return startOfDay(offset);

  const words = normalized
    .split(" ")
    .map((word) => word.replace(/\.$/, ""))
    .filter((word) => word.length > 0 && !FILLER_WORDS.has(word));
  if (words.length === 0) return null;

  // "next week", "this month", "next friday", "last fri"
  if (words.length === 2 && words[0] in DIRECTION_WORDS) {
    const direction = DIRECTION_WORDS[words[0]];
    const unit = UNIT_WORDS[words[1]];
    if (unit && words[1].length > 1) {
      return periodStart(unit, direction, today, weekStart);
    }
    const weekday = readWeekday(words[1], locale);
    if (weekday !== -1) {
      return weekdayDate(weekday, direction, today, weekStart);
    }
    return null;
  }

  // A weekday alone, or one before a date: "friday", "Fri Dec 25"
  if (
    readWeekday(words[0], locale) !== -1 &&
    readMonth(words[0], locale) === -1
  ) {
    if (words.length === 1) {
      return weekdayDate(readWeekday(words[0], locale), null, today, weekStart);
    }
    words.shift();
  }

  if (words.length === 1) {
    const [word] = words;
    const numeric = readNumericDate(word, today, locale);
    if (numeric) return numeric;
    if (/^\d{4}$/.test(word)) return calendarDay(Number(word), 0, 1);
    if (/^\d{1,2}$/.test(word)) {
      return nextDayOfMonth(Number(word), today);
    }
  }

  return readNamedDate(words, today, locale);
}

/**
 * The day Go to date shows for typed text: "Friday, December 25", with the
 * year when it isn't today's ("Saturday, December 25, 2027"), in the
 * locale's words and order
 */
export function formatDateQueryResult(
  date: Date,
  today: Date,
  locale: Locale = enUS,
): string {
  return new Intl.DateTimeFormat(locale.code, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}
