import { expect, test } from "@playwright/test";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import type {
  DetailedCalendarEvent,
  RecurrenceRule,
} from "../src/components/calendar-types";
import {
  createSeriesOccurrence,
  describeRecurrenceRule,
  findSeriesOccurrence,
  formatRRule,
  getAdjacentOccurrence,
  parseRecurrence,
} from "../src/lib/recurrence";

/**
 * The repeat rule math in `src/lib/recurrence.ts`, run in Node. Dates are
 * local unless a test sets a time zone, so the results don't depend on the
 * machine's zone.
 */

/** Local "yyyy-MM-dd HH:mm" of a date, or null */
function local(date: Date | null): string | null {
  return date && format(date, "yyyy-MM-dd HH:mm");
}

/**
 * The first `count` occurrences of a series from `start`, stepping with
 * "next" as the series arrows do
 */
function occurrences(
  rule: RecurrenceRule,
  start: Date,
  count: number,
  timeZone?: string,
): (Date | null)[] {
  const dates: (Date | null)[] = [start];
  while (dates.length < count) {
    const last = dates[dates.length - 1];
    dates.push(
      last && getAdjacentOccurrence(rule, start, last, "next", timeZone),
    );
  }
  return dates;
}

test.describe("occurrences", () => {
  test("a monthly series on the 31st skips months without it", () => {
    const start = new Date(2026, 0, 31, 10);
    expect(occurrences({ frequency: "monthly" }, start, 5).map(local)).toEqual([
      "2026-01-31 10:00",
      "2026-03-31 10:00",
      "2026-05-31 10:00",
      "2026-07-31 10:00",
      "2026-08-31 10:00",
    ]);
  });

  test("a Feb 29 series falls on leap years only", () => {
    const start = new Date(2024, 1, 29, 9);
    const rule: RecurrenceRule = { frequency: "yearly" };
    expect(occurrences(rule, start, 3).map(local)).toEqual([
      "2024-02-29 09:00",
      "2028-02-29 09:00",
      "2032-02-29 09:00",
    ]);
    const from = new Date(2028, 1, 29, 9);
    expect(local(getAdjacentOccurrence(rule, start, from, "previous"))).toBe(
      "2024-02-29 09:00",
    );
  });

  test("the last weekday of the month differs from the 4th", () => {
    // Saturday, June 27 2026 is both the 4th and the last Saturday
    const start = new Date(2026, 5, 27, 14);
    const last: RecurrenceRule = {
      frequency: "monthly",
      monthlyBy: "weekday-of-month",
      weekOfMonth: -1,
    };
    const fourth: RecurrenceRule = { ...last, weekOfMonth: 4 };
    expect(occurrences(last, start, 4).map(local)).toEqual([
      "2026-06-27 14:00",
      "2026-07-25 14:00",
      "2026-08-29 14:00",
      "2026-09-26 14:00",
    ]);
    expect(occurrences(fourth, start, 4).map(local)).toEqual([
      "2026-06-27 14:00",
      "2026-07-25 14:00",
      "2026-08-22 14:00",
      "2026-09-26 14:00",
    ]);
    // The label reads the rule, not the occurrence on screen
    expect(
      describeRecurrenceRule(last, new Date(2026, 7, 22), enUS).detail,
    ).toBe("on the last Sat");
  });

  test("COUNT and UNTIL end the series", () => {
    const start = new Date(2026, 5, 6, 10);
    const sixTimes: RecurrenceRule = {
      frequency: "weekly",
      interval: 2,
      weekdays: [6],
      end: { type: "after", count: 6 },
    };
    const series = occurrences(sixTimes, start, 7).map(local);
    expect(series.slice(0, 6)).toEqual([
      "2026-06-06 10:00",
      "2026-06-20 10:00",
      "2026-07-04 10:00",
      "2026-07-18 10:00",
      "2026-08-01 10:00",
      "2026-08-15 10:00",
    ]);
    expect(series[6]).toBeNull();
    expect(getAdjacentOccurrence(sixTimes, start, start, "previous")).toBe(
      null,
    );

    const untilJune10: RecurrenceRule = {
      frequency: "daily",
      end: { type: "on", date: new Date(2026, 5, 10) },
    };
    expect(occurrences(untilJune10, start, 6).map(local)).toEqual([
      "2026-06-06 10:00",
      "2026-06-07 10:00",
      "2026-06-08 10:00",
      "2026-06-09 10:00",
      "2026-06-10 10:00",
      null,
    ]);
  });

  test("a series keeps its time in its zone across daylight saving", () => {
    // 9 AM in New York on Monday, March 2 2026 (EST); the US moves to EDT
    // on March 8, Europe only on March 29
    const start = new Date("2026-03-02T14:00:00Z");
    const weekly: RecurrenceRule = { frequency: "weekly" };
    const series = occurrences(weekly, start, 3, "America/New_York");
    expect(series.map((date) => date?.toISOString())).toEqual([
      "2026-03-02T14:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
      "2026-03-16T13:00:00.000Z",
    ]);
    expect(
      getAdjacentOccurrence(
        weekly,
        start,
        new Date("2026-03-09T13:00:00Z"),
        "previous",
        "America/New_York",
      )?.toISOString(),
    ).toBe("2026-03-02T14:00:00.000Z");

    // 9 AM in London: an hour earlier in UTC from March 29
    const london = occurrences(
      weekly,
      new Date("2026-03-23T09:00:00Z"),
      2,
      "Europe/London",
    );
    expect(london[1]?.toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });

  test("weeks start on Monday unless the rule says otherwise", () => {
    // Monday, June 1 2026, every 2 weeks on Mon and Sun
    const start = new Date(2026, 5, 1, 9);
    const rule: RecurrenceRule = {
      frequency: "weekly",
      interval: 2,
      weekdays: [0, 1],
    };
    expect(occurrences(rule, start, 4).map(local)).toEqual([
      "2026-06-01 09:00",
      "2026-06-07 09:00",
      "2026-06-15 09:00",
      "2026-06-21 09:00",
    ]);
    expect(
      occurrences({ ...rule, weekStartsOn: 0 }, start, 4).map(local),
    ).toEqual([
      "2026-06-01 09:00",
      "2026-06-14 09:00",
      "2026-06-15 09:00",
      "2026-06-28 09:00",
    ]);
  });
});

test.describe("findSeriesOccurrence", () => {
  const rule: RecurrenceRule = {
    frequency: "weekly",
    interval: 2,
    weekdays: [6],
    end: { type: "after", count: 6 },
  };
  const first: DetailedCalendarEvent = {
    id: "launch",
    title: "Launch Review",
    calendarId: "work",
    start: new Date(2026, 5, 6, 10),
    end: new Date(2026, 5, 6, 11),
    recurrenceRule: rule,
  };

  /** The copy the series arrows add for the occurrence after `first` */
  function copyOfJune20(): DetailedCalendarEvent {
    const occurrence = findSeriesOccurrence([first], first, "next");
    if (!occurrence) throw new Error("No occurrence after June 6");
    return createSeriesOccurrence(first, occurrence);
  }

  test("compares occurrences by day", () => {
    // The June 20 occurrence, moved to the afternoon
    const moved: DetailedCalendarEvent = {
      ...copyOfJune20(),
      start: new Date(2026, 5, 20, 15),
      end: new Date(2026, 5, 20, 16),
    };
    const events = [first, moved];
    expect(findSeriesOccurrence(events, first, "next")?.event).toBe(moved);
    expect(findSeriesOccurrence(events, moved, "previous")?.event).toBe(first);
    expect(
      local(findSeriesOccurrence(events, moved, "next")?.start ?? null),
    ).toBe("2026-07-04 10:00");
  });

  test("an occurrence moved to another day or renamed is still its day's", () => {
    // The June 20 occurrence, moved to Sunday and renamed
    const moved: DetailedCalendarEvent = {
      ...copyOfJune20(),
      title: "Launch Review (moved)",
      start: new Date(2026, 5, 21, 10),
      end: new Date(2026, 5, 21, 11),
    };
    const events = [first, moved];
    expect(findSeriesOccurrence(events, first, "next")?.event).toBe(moved);
    // Counted from June 20, not from the day it moved to
    const fromMoved = { ...moved, title: first.title };
    expect(
      findSeriesOccurrence([first, fromMoved], fromMoved, "previous")?.event,
    ).toBe(first);
    expect(
      local(
        findSeriesOccurrence([first, fromMoved], fromMoved, "next")?.start ??
          null,
      ),
    ).toBe("2026-07-04 10:00");
  });

  test("finds occurrences the events don't have, up to the series' end", () => {
    const next = findSeriesOccurrence([first], first, "next");
    expect(next?.event).toBeUndefined();
    expect(local(next?.start ?? null)).toBe("2026-06-20 10:00");
    // A copy made for it gets an id that names its day
    expect(next?.id).toBe("launch-2026-06-20");

    const last = { ...first, id: "last", start: new Date(2026, 7, 15, 10) };
    expect(findSeriesOccurrence([first, last], last, "next")).toBeNull();
    expect(findSeriesOccurrence([first], first, "previous")).toBeNull();
  });

  test("steps between the events of a text-only series", () => {
    const monday = (day: number): DetailedCalendarEvent => ({
      id: `standup-${day}`,
      title: "Standup",
      start: new Date(2026, 5, day, 9),
      end: new Date(2026, 5, day, 9, 15),
      recurrence: "Every week on Mon",
    });
    // June 8 was skipped
    const events = [monday(1), monday(15)];
    expect(findSeriesOccurrence(events, events[0], "next")?.event).toBe(
      events[1],
    );
  });
});

test.describe("RRULE", () => {
  // Saturday, June 6 2026
  const start = new Date(2026, 5, 6, 10);

  test("reads COUNT as an end, not a weekday of the month", () => {
    expect(parseRecurrence("FREQ=MONTHLY;COUNT=5", start)).toEqual({
      frequency: "monthly",
      end: { type: "after", count: 5 },
    });
    expect(parseRecurrence("FREQ=MONTHLY;BYDAY=1SA", start)).toEqual({
      frequency: "monthly",
      monthlyBy: "weekday-of-month",
      weekOfMonth: 1,
    });
    expect(parseRecurrence("FREQ=MONTHLY;BYDAY=SA;BYSETPOS=-1", start)).toEqual(
      {
        frequency: "monthly",
        monthlyBy: "weekday-of-month",
        weekOfMonth: -1,
      },
    );
  });

  test("reads a UTC UNTIL as the day it falls on in the series' zone", () => {
    // 11:59:59 PM on December 5 in New York
    expect(
      parseRecurrence(
        "FREQ=WEEKLY;BYDAY=SA;UNTIL=20261206T045959Z",
        start,
        "America/New_York",
      ),
    ).toEqual({
      frequency: "weekly",
      weekdays: [6],
      end: { type: "on", date: new Date(2026, 11, 5) },
    });
    expect(parseRecurrence("FREQ=DAILY;UNTIL=20261205", start)?.end).toEqual({
      type: "on",
      date: new Date(2026, 11, 5),
    });
  });

  test("keeps WKST", () => {
    const rule = parseRecurrence(
      "FREQ=WEEKLY;WKST=SU;INTERVAL=2;BYDAY=MO,SA",
      start,
    );
    expect(rule).toEqual({
      frequency: "weekly",
      interval: 2,
      weekdays: [1, 6],
      weekStartsOn: 0,
    });
    expect(rule && formatRRule(rule, start)).toBe(
      "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SA;WKST=SU",
    );
  });

  test("returns null for rules a repeat rule can't hold", () => {
    for (const text of [
      "FREQ=MONTHLY;BYMONTHDAY=1,15",
      "FREQ=MONTHLY;BYDAY=2TU",
      "FREQ=MONTHLY;BYDAY=5SA",
      "FREQ=WEEKLY;BYDAY=1MO",
      "FREQ=DAILY;BYHOUR=9",
      "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "FREQ=WEEKLY;COUNT=2;UNTIL=20261205",
      "FREQ=HOURLY",
    ]) {
      expect(parseRecurrence(text, start), text).toBeNull();
    }
  });
});
