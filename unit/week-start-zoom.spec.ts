import { expect, test } from "@playwright/test";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import {
  HOUR_HEIGHT_STEPS,
  generateMonthGrid,
  getPeriodStart,
  getVisibleRange,
  getZoomedHourHeight,
} from "@/lib/event-utils";
import type { WeekStartsOn } from "@/components/calendar-types";

/**
 * The math behind "Start week on..." and the hour zoom: the period a week
 * start gives each view, and the steps zooming walks through. Runs in Node
 * without a page; dates are local.
 */

/** Thursday, June 4 2026 */
const THURSDAY = new Date(2026, 5, 4, 15, 30);

/** Every day a week can start on */
const WEEK_STARTS: WeekStartsOn[] = [0, 1, 2, 3, 4, 5, 6];

test.describe("week start", () => {
  test("a full week starts on the chosen day and holds the date", () => {
    const starts = WEEK_STARTS.map((weekStartsOn) =>
      format(getPeriodStart(THURSDAY, "week", weekStartsOn, 7), "EEE MM-dd"),
    );
    expect(starts).toEqual([
      "Sun 05-31",
      "Mon 06-01",
      "Tue 06-02",
      "Wed 06-03",
      "Thu 06-04",
      "Fri 05-29",
      "Sat 05-30",
    ]);
    for (const weekStartsOn of WEEK_STARTS) {
      const range = getVisibleRange(
        getPeriodStart(THURSDAY, "week", weekStartsOn, 7),
        "week",
        7,
        weekStartsOn,
        true,
      );
      expect(range.start <= THURSDAY && THURSDAY < range.end).toBe(true);
    }
  });

  test("day view and a few days don't move with it", () => {
    for (const weekStartsOn of WEEK_STARTS) {
      expect(
        format(getPeriodStart(THURSDAY, "day", weekStartsOn, 7), "MM-dd"),
      ).toBe("06-04");
      expect(
        format(getPeriodStart(THURSDAY, "week", weekStartsOn, 3), "MM-dd"),
      ).toBe("06-04");
    }
  });

  test("the month grid's rows start on the chosen day", () => {
    for (const weekStartsOn of WEEK_STARTS) {
      const rows = generateMonthGrid(THURSDAY, weekStartsOn, enUS);
      for (const row of rows) {
        expect(row.days).toHaveLength(7);
        expect(row.days[0].date.getDay()).toBe(weekStartsOn);
      }
      // June 1 is in the first row whatever the start
      expect(
        rows[0].days.some((day) => format(day.date, "MM-dd") === "06-01"),
      ).toBe(true);
    }
  });
});

test.describe("hour zoom", () => {
  test("zooming in and out walks the steps one at a time", () => {
    expect(getZoomedHourHeight(48, "in")).toBe(64);
    expect(getZoomedHourHeight(64, "in")).toBe(80);
    expect(getZoomedHourHeight(48, "out")).toBe(40);
    expect(getZoomedHourHeight(40, "out")).toBe(32);
  });

  test("a height between steps goes to the nearer step that way", () => {
    // The default fills the screen, so it can be any height
    expect(getZoomedHourHeight(52.3, "in")).toBe(64);
    expect(getZoomedHourHeight(52.3, "out")).toBe(48);
    // Half a pixel off a step still counts as that step
    expect(getZoomedHourHeight(47.8, "in")).toBe(64);
  });

  test("the smallest and largest steps are the limits", () => {
    const smallest = HOUR_HEIGHT_STEPS[0];
    const largest = HOUR_HEIGHT_STEPS[HOUR_HEIGHT_STEPS.length - 1];
    expect(getZoomedHourHeight(smallest, "out")).toBe(smallest);
    expect(getZoomedHourHeight(largest, "in")).toBe(largest);
    expect(getZoomedHourHeight(500, "in")).toBe(largest);
    expect(getZoomedHourHeight(10, "out")).toBe(smallest);
  });
});
