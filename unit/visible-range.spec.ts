import { expect, test } from "@playwright/test";
import { format } from "date-fns";

import { getPeriodStart, getVisibleRange } from "@/lib/event-utils";
import type { VisibleRange } from "@/components/calendar-types";

/**
 * The range math behind `visibleRange` and `onVisibleRangeChange`, for the
 * settings the docs example doesn't expose (week start, day count, hidden
 * weekends). Runs in Node without a page; dates are local, so the results
 * don't depend on the machine's time zone.
 */

/** Thursday, June 4 2026, mid-afternoon */
const THURSDAY = new Date(2026, 5, 4, 15, 30);

/** A range as "yyyy-MM-dd → yyyy-MM-dd" (end exclusive) */
function formatRange(range: VisibleRange): string {
  return `${format(range.start, "yyyy-MM-dd")} → ${format(range.end, "yyyy-MM-dd")}`;
}

test("day view covers its day, from midnight to midnight", () => {
  const range = getVisibleRange(THURSDAY, "day", 7, 0, true);
  expect(formatRange(range)).toBe("2026-06-04 → 2026-06-05");
  expect(range.start.getHours()).toBe(0);
  expect(range.end.getHours()).toBe(0);
});

test("week view covers numberOfDays columns from the first one", () => {
  const sunday = new Date(2026, 4, 31);
  expect(formatRange(getVisibleRange(sunday, "week", 7, 0, true))).toBe(
    "2026-05-31 → 2026-06-07",
  );
  expect(formatRange(getVisibleRange(THURSDAY, "week", 3, 0, true))).toBe(
    "2026-06-04 → 2026-06-07",
  );
});

test("day and week view with hidden weekends cover the weekdays they draw", () => {
  const sunday = new Date(2026, 4, 31);
  // A full week: Monday to Friday
  expect(formatRange(getVisibleRange(sunday, "week", 7, 0, false))).toBe(
    "2026-06-01 → 2026-06-06",
  );
  // Three days from Thursday: Thursday, Friday and the next Monday
  expect(formatRange(getVisibleRange(THURSDAY, "week", 3, 0, false))).toBe(
    "2026-06-04 → 2026-06-09",
  );
  // A Saturday in day view shows the Monday after it
  expect(
    formatRange(getVisibleRange(new Date(2026, 5, 6), "day", 7, 0, false)),
  ).toBe("2026-06-08 → 2026-06-09");
  // The agenda lists its days and leaves the weekend ones empty
  expect(formatRange(getVisibleRange(THURSDAY, "agenda", 7, 0, false))).toBe(
    formatRange(getVisibleRange(THURSDAY, "agenda", 7, 0, true)),
  );
});

test("month view covers the six-week grid from the week's first day", () => {
  expect(formatRange(getVisibleRange(THURSDAY, "month", 7, 0, true))).toBe(
    "2026-05-31 → 2026-07-12",
  );
  expect(formatRange(getVisibleRange(THURSDAY, "month", 7, 1, true))).toBe(
    "2026-06-01 → 2026-07-13",
  );
});

test("month view with hidden weekends starts and ends on weekdays", () => {
  // Sunday-first grid: drops the leading Sunday and the trailing Saturday
  expect(formatRange(getVisibleRange(THURSDAY, "month", 7, 0, false))).toBe(
    "2026-06-01 → 2026-07-11",
  );
  // Monday-first grid: drops the trailing weekend only
  expect(formatRange(getVisibleRange(THURSDAY, "month", 7, 1, false))).toBe(
    "2026-06-01 → 2026-07-11",
  );
  // Saturday-first grid: drops the leading weekend; it already ends on a Friday
  expect(formatRange(getVisibleRange(THURSDAY, "month", 7, 6, false))).toBe(
    "2026-06-01 → 2026-07-11",
  );
});

test("year view covers its whole year, whatever the week start or weekends", () => {
  expect(formatRange(getVisibleRange(THURSDAY, "year", 7, 0, true))).toBe(
    "2026-01-01 → 2027-01-01",
  );
  expect(formatRange(getVisibleRange(THURSDAY, "year", 3, 1, false))).toBe(
    "2026-01-01 → 2027-01-01",
  );
});

test("year view's period starts at midnight on January 1", () => {
  expect(
    format(getPeriodStart(THURSDAY, "year", 0, 7), "yyyy-MM-dd HH:mm"),
  ).toBe("2026-01-01 00:00");
});
