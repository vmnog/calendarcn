import { expect, test } from "@playwright/test";
import { format } from "date-fns";
import { de, enGB, ja, ptBR } from "date-fns/locale";

import { formatDateQueryResult, parseDateQuery } from "@/lib/date-query";
import type { DateQueryOptions } from "@/lib/date-query";

/**
 * What Go to date reads from typed text (`src/lib/date-query.ts`), phrase by
 * phrase, with the locale and the week start. Runs in Node without a page.
 */

/** Tuesday, November 17 2026, mid-afternoon: what "today" is below */
const TUESDAY = new Date(2026, 10, 17, 15, 30);

/** The typed text's date as "yyyy-MM-dd", or null when it isn't one */
function read(
  text: string,
  options: Partial<DateQueryOptions> = {},
): string | null {
  const date = parseDateQuery(text, { today: TUESDAY, ...options });
  return date ? format(date, "yyyy-MM-dd") : null;
}

test("today, tomorrow and yesterday, in any case", () => {
  expect(read("today")).toBe("2026-11-17");
  expect(read("Tomorrow")).toBe("2026-11-18");
  expect(read("tmrw")).toBe("2026-11-18");
  expect(read("YESTERDAY")).toBe("2026-11-16");
});

test("the result is the day's midnight", () => {
  const date = parseDateQuery("tomorrow", { today: TUESDAY });
  expect(date?.getHours()).toBe(0);
  expect(date?.getMinutes()).toBe(0);
});

test("a weekday alone is the next one, today included", () => {
  expect(read("friday")).toBe("2026-11-20");
  expect(read("fri")).toBe("2026-11-20");
  expect(read("tuesday")).toBe("2026-11-17");
  expect(read("monday")).toBe("2026-11-23");
  expect(read("thurs")).toBe("2026-11-19");
  expect(read("tu")).toBe("2026-11-17");
});

test("next, this and last weekday count weeks from the week start", () => {
  // Sunday-first: this week is Nov 15-21
  expect(read("next friday")).toBe("2026-11-27");
  expect(read("this friday")).toBe("2026-11-20");
  expect(read("last friday")).toBe("2026-11-13");
  expect(read("this sunday")).toBe("2026-11-15");
  expect(read("next sunday")).toBe("2026-11-22");

  // Monday-first: this week is Nov 16-22, so "this sunday" is the 22nd
  expect(read("this sunday", { weekStartsOn: 1 })).toBe("2026-11-22");
  expect(read("next sunday", { weekStartsOn: 1 })).toBe("2026-11-29");
  expect(read("last monday", { weekStartsOn: 1 })).toBe("2026-11-09");
});

test("next and last week, month and year are the period's first day", () => {
  expect(read("next week")).toBe("2026-11-22");
  expect(read("next week", { weekStartsOn: 1 })).toBe("2026-11-23");
  expect(read("last week")).toBe("2026-11-08");
  expect(read("this week", { weekStartsOn: 1 })).toBe("2026-11-16");
  expect(read("next month")).toBe("2026-12-01");
  expect(read("previous month")).toBe("2026-10-01");
  expect(read("next year")).toBe("2027-01-01");
});

test("the week start follows the locale when none is given", () => {
  expect(read("next week", { locale: enGB })).toBe("2026-11-23");
  expect(read("next week", { locale: enGB, weekStartsOn: 0 })).toBe(
    "2026-11-22",
  );
});

test("offsets: in 2 weeks, 3 days ago, from now, +3d", () => {
  expect(read("in 2 weeks")).toBe("2026-12-01");
  expect(read("in 3 days")).toBe("2026-11-20");
  expect(read("in a month")).toBe("2026-12-17");
  expect(read("in 1 year")).toBe("2027-11-17");
  expect(read("in 2w")).toBe("2026-12-01");
  expect(read("3 days ago")).toBe("2026-11-14");
  expect(read("a week ago")).toBe("2026-11-10");
  expect(read("2 weeks from now")).toBe("2026-12-01");
  expect(read("+3")).toBe("2026-11-20");
  expect(read("+2w")).toBe("2026-12-01");
  expect(read("-1m")).toBe("2026-10-17");
  expect(read("in 2 hours")).toBeNull();
});

test("a month name with a day, in either order", () => {
  expect(read("dec 25")).toBe("2026-12-25");
  expect(read("December 25")).toBe("2026-12-25");
  expect(read("25 dec")).toBe("2026-12-25");
  expect(read("dec 25th")).toBe("2026-12-25");
  expect(read("the 25th of december")).toBe("2026-12-25");
  expect(read("sept 5")).toBe("2027-09-05");
  expect(read("Dec. 25")).toBe("2026-12-25");
});

test("a date without a year is the next one, today included", () => {
  // As Notion Calendar reads them: forward from today
  expect(read("jan 5")).toBe("2027-01-05");
  expect(read("oct 30")).toBe("2027-10-30");
  expect(read("nov 17")).toBe("2026-11-17");
  expect(read("nov 16")).toBe("2027-11-16");
  // Feb 29 waits for the next leap year
  expect(read("feb 29")).toBe("2028-02-29");
});

test("a year after the day", () => {
  expect(read("dec 25 2027")).toBe("2027-12-25");
  expect(read("December 25th, 2027")).toBe("2027-12-25");
  expect(read("25 december 2027")).toBe("2027-12-25");
  expect(read("dec 25 27")).toBe("2027-12-25");
});

test("a month alone or with a year is its first day", () => {
  expect(read("december")).toBe("2026-12-01");
  expect(read("jan")).toBe("2027-01-01");
  expect(read("august")).toBe("2026-08-01");
  expect(read("march 2027")).toBe("2027-03-01");
});

test("a leading weekday is skipped", () => {
  expect(read("Fri Dec 25")).toBe("2026-12-25");
  expect(read("friday, december 25")).toBe("2026-12-25");
});

test("numeric dates follow the locale's order", () => {
  expect(read("12/25")).toBe("2026-12-25");
  expect(read("12/25/2027")).toBe("2027-12-25");
  expect(read("12-25-27")).toBe("2027-12-25");
  expect(read("1/5")).toBe("2027-01-05");
  expect(read("10/30")).toBe("2027-10-30");

  expect(read("25/12", { locale: enGB })).toBe("2026-12-25");
  expect(read("5/1", { locale: enGB })).toBe("2027-01-05");
  expect(read("25.12.", { locale: de })).toBe("2026-12-25");
  expect(read("25.12.2027", { locale: de })).toBe("2027-12-25");
  // Year-first locales put the month before the day
  expect(read("12/25", { locale: ja })).toBe("2026-12-25");
});

test("an ISO date reads year first in every locale", () => {
  expect(read("2027-12-25")).toBe("2027-12-25");
  expect(read("2027-12-25", { locale: enGB })).toBe("2027-12-25");
});

test("a day of the month is the next one, or a year", () => {
  expect(read("25")).toBe("2026-11-25");
  expect(read("17th")).toBe("2026-11-17");
  expect(read("3rd")).toBe("2026-12-03");
  expect(read("31")).toBe("2026-12-31");
  expect(read("2027")).toBe("2027-01-01");
});

test("the locale's month and weekday names, and English too", () => {
  expect(read("25 de dezembro", { locale: ptBR })).toBe("2026-12-25");
  expect(read("dez 25", { locale: ptBR })).toBe("2026-12-25");
  expect(read("sexta", { locale: ptBR })).toBe("2026-11-20");
  expect(read("sábado", { locale: ptBR })).toBe("2026-11-21");
  expect(read("sabado", { locale: ptBR })).toBe("2026-11-21");
  expect(read("dec 25", { locale: ptBR })).toBe("2026-12-25");
  expect(read("25. Dezember", { locale: de })).toBe("2026-12-25");
  expect(read("Freitag", { locale: de })).toBe("2026-11-20");
});

test("text that isn't a date reads as nothing", () => {
  expect(read("")).toBeNull();
  expect(read("   ")).toBeNull();
  expect(read("lunch")).toBeNull();
  expect(read("feb 30")).toBeNull();
  expect(read("feb 30 2027")).toBeNull();
  expect(read("13/45")).toBeNull();
  expect(read("32")).toBeNull();
  expect(read("next lunch")).toBeNull();
  expect(read("dec 25 2027 extra")).toBeNull();
});

test("the result names the weekday, and the year when it isn't this one", () => {
  const today = new Date(2026, 10, 17);
  expect(formatDateQueryResult(new Date(2026, 11, 25), today)).toBe(
    "Friday, December 25",
  );
  expect(formatDateQueryResult(new Date(2027, 11, 25), today)).toBe(
    "Saturday, December 25, 2027",
  );
  expect(formatDateQueryResult(new Date(2026, 11, 25), today, ptBR)).toBe(
    "sexta-feira, 25 de dezembro",
  );
});
