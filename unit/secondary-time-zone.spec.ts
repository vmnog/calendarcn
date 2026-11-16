import { expect, test } from "@playwright/test";
import { enUS } from "date-fns/locale";

import {
  formatHourLabel,
  formatNowLineTime,
  formatTimeOfDayLabel,
} from "../src/lib/event-utils";
import {
  getSecondaryTimeAxisInstant,
  getTimeZoneOffsetDifference,
} from "../src/lib/time-zones";
import { getTimeZoneLabel } from "../src/lib/timezone-label";

/**
 * The second time zone column beside the time axis: the offset it shows,
 * the day it follows and its labels. Runs in Node with
 * TZ=America/New_York (the `test:unit` script), the zone of the hour rows.
 */

/** Zone of the hour rows in these tests, the one the script pins */
const NEW_YORK = "America/New_York";

/** Noon in New York on Thursday June 4 2026 (GMT−4) */
const JUNE_NOON = new Date("2026-06-04T16:00:00Z");

test.describe("second time zone offset", () => {
  test("a zone ahead by whole hours", () => {
    expect(
      getTimeZoneOffsetDifference(JUNE_NOON, NEW_YORK, "Europe/London"),
    ).toBe(300);
  });

  test("zones half an hour and three quarters of an hour off", () => {
    expect(
      getTimeZoneOffsetDifference(JUNE_NOON, NEW_YORK, "Asia/Kolkata"),
    ).toBe(570);
    expect(
      getTimeZoneOffsetDifference(JUNE_NOON, NEW_YORK, "Asia/Kathmandu"),
    ).toBe(585);
  });

  test("a zone behind is negative, and a zone against itself is zero", () => {
    expect(
      getTimeZoneOffsetDifference(JUNE_NOON, NEW_YORK, "America/Los_Angeles"),
    ).toBe(-180);
    expect(
      getTimeZoneOffsetDifference(JUNE_NOON, "Asia/Kolkata", NEW_YORK),
    ).toBe(-570);
    expect(getTimeZoneOffsetDifference(JUNE_NOON, NEW_YORK, NEW_YORK)).toBe(0);
  });
});

test.describe("the day the second column follows", () => {
  // Monday October 19 to Sunday October 25 2026. London's clocks go back
  // on that Sunday (GMT+1 to GMT), New York's only on November 1
  const week = Array.from(
    { length: 7 },
    (_, index) => new Date(2026, 9, 19 + index),
  );
  const mondayNoon = new Date("2026-10-19T16:00:00Z");
  const sundayNoon = new Date("2026-10-25T16:00:00Z");

  test("today on screen: noon today", () => {
    const instant = getSecondaryTimeAxisInstant(
      week,
      new Date(2026, 9, 25),
      NEW_YORK,
    );
    expect(instant).toEqual(sundayNoon);
    expect(
      getTimeZoneOffsetDifference(instant, NEW_YORK, "Europe/London"),
    ).toBe(240);
    expect(getTimeZoneLabel(instant, "Europe/London")).toBe("GMT");
  });

  test("today off screen: noon on the first day shown", () => {
    const instant = getSecondaryTimeAxisInstant(
      week,
      new Date(2026, 10, 2),
      NEW_YORK,
    );
    expect(instant).toEqual(mondayNoon);
    expect(
      getTimeZoneOffsetDifference(instant, NEW_YORK, "Europe/London"),
    ).toBe(300);
    expect(getTimeZoneLabel(instant, "Europe/London")).toBe("GMT+1");
  });

  test("today not known yet: the first day shown", () => {
    expect(getSecondaryTimeAxisInstant(week, null, NEW_YORK)).toEqual(
      mondayNoon,
    );
  });

  test("noon is read in the zone of the hour rows, not the runtime's", () => {
    expect(
      getSecondaryTimeAxisInstant([new Date(2026, 5, 4)], null, "Asia/Kolkata"),
    ).toEqual(new Date("2026-06-04T06:30:00Z"));
  });
});

test.describe("second time zone hour labels", () => {
  test("whole hours read like the viewer's labels", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      expect(formatTimeOfDayLabel(hour * 60, 12, enUS)).toBe(
        formatHourLabel(hour, 12, enUS),
      );
      expect(formatTimeOfDayLabel(hour * 60, 24, enUS)).toBe(
        formatHourLabel(hour, 24, enUS),
      );
    }
  });

  test("a line between the zone's hours shows its minutes", () => {
    // 10 AM in New York is 7:30 PM in Kolkata and 7:45 PM in Kathmandu
    expect(formatTimeOfDayLabel(10 * 60 + 570, 12, enUS)).toBe("7:30 PM");
    expect(formatTimeOfDayLabel(10 * 60 + 585, 12, enUS)).toBe("7:45 PM");
    expect(formatTimeOfDayLabel(10 * 60 + 570, 24, enUS)).toBe("19:30");
  });

  test("times wrap into the next and the previous day", () => {
    expect(formatTimeOfDayLabel(15 * 60 + 570, 12, enUS)).toBe("12:30 AM");
    expect(formatTimeOfDayLabel(15 * 60 + 570, 24, enUS)).toBe("00:30");
    expect(formatTimeOfDayLabel(-180, 12, enUS)).toBe("9 PM");
  });
});

test.describe("now line time", () => {
  test("reads like the viewer's badge", () => {
    expect(formatNowLineTime(17 * 60 + 48, 12, enUS)).toBe("5:48PM");
    expect(formatNowLineTime(8 * 60, 12, enUS)).toBe("8:00AM");
    expect(formatNowLineTime(5, 12, enUS)).toBe("12:05AM");
    expect(formatNowLineTime(12 * 60, 12, enUS)).toBe("12:00PM");
    expect(formatNowLineTime(17 * 60 + 48, 24, enUS)).toBe("17:48");
    expect(formatNowLineTime(5, 24, enUS)).toBe("00:05");
  });

  test("wraps into one day", () => {
    expect(formatNowLineTime(24 * 60 + 30, 12, enUS)).toBe("12:30AM");
    expect(formatNowLineTime(-30, 24, enUS)).toBe("23:30");
  });
});
