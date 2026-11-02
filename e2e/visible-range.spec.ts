import { expect, test } from "@playwright/test";
import { format } from "date-fns";

import { getVisibleRange } from "@/lib/event-utils";
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
  // Hidden weekends don't change the time grid, which always shows them
  expect(formatRange(getVisibleRange(sunday, "week", 7, 0, false))).toBe(
    "2026-05-31 → 2026-06-07",
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
