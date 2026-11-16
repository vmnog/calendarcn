import { expect, test } from "@playwright/test";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

import type {
  DetailedCalendarEvent,
  RecurrenceRule,
} from "../src/components/calendar-types";
import {
  MAX_OCCURRENCES_PER_RANGE,
  applyRecurringEdit,
  createSeriesOccurrence,
  createStandaloneCopy,
  describeRecurrenceRule,
  expandRecurringEvents,
  findEventOrOccurrence,
  findSeriesOccurrence,
  formatRRule,
  getAdjacentOccurrence,
  getOccurrenceRemoval,
  moveRecurrenceRule,
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

/** Each event's id and local start, for comparing lists of events */
function summary(events: DetailedCalendarEvent[]): [string, string | null][] {
  return events.map((event) => [event.id, local(event.start)]);
}

/**
 * Every 2 weeks on Saturday, 6 times, from Saturday June 6 2026, 10 to
 * 11 AM: June 6 and 20, July 4 and 18, August 1 and 15
 */
const launch: DetailedCalendarEvent = {
  id: "launch",
  title: "Launch Review",
  calendarId: "work",
  start: new Date(2026, 5, 6, 10),
  end: new Date(2026, 5, 6, 11),
  recurrenceRule: {
    frequency: "weekly",
    interval: 2,
    weekdays: [6],
    end: { type: "after", count: 6 },
  },
};

/** June 1 to July 12 2026, the end left out */
const summer = { start: new Date(2026, 5, 1), end: new Date(2026, 6, 12) };

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

  test("generates the occurrences the events don't have, up to the series' end", () => {
    const next = findSeriesOccurrence([first], first, "next");
    expect(local(next?.start ?? null)).toBe("2026-06-20 10:00");
    // Generated as the views draw it: an id that names its day, and its series
    expect(next?.id).toBe("launch-2026-06-20");
    expect(next?.event?.seriesId).toBe("launch");

    const last: DetailedCalendarEvent = {
      ...first,
      id: "launch-2026-08-15",
      start: new Date(2026, 7, 15, 10),
      end: new Date(2026, 7, 15, 11),
      seriesId: "launch",
      originalStart: new Date(2026, 7, 15, 10),
    };
    expect(findSeriesOccurrence([first, last], last, "next")).toBeNull();
    expect(findSeriesOccurrence([first], first, "previous")).toBeNull();
  });

  test("skips excluded dates", () => {
    const series = { ...first, excludedDates: [new Date(2026, 5, 20, 10)] };
    expect(findSeriesOccurrence([series], series, "next")?.id).toBe(
      "launch-2026-07-04",
    );
  });

  test("finds an edited occurrence by its original day", () => {
    // June 20 from an .ics file: an id of its own, moved to Sunday, renamed
    const moved: DetailedCalendarEvent = {
      ...first,
      id: "launch_20260620T100000",
      title: "Launch Review (moved)",
      start: new Date(2026, 5, 21, 15),
      end: new Date(2026, 5, 21, 16),
      seriesId: "launch",
      originalStart: new Date(2026, 5, 20, 10),
    };
    const events = [first, moved];
    expect(findSeriesOccurrence(events, first, "next")?.event).toBe(moved);
    expect(findSeriesOccurrence(events, moved, "previous")?.event).toBe(first);
    expect(findSeriesOccurrence(events, moved, "next")?.id).toBe(
      "launch-2026-07-04",
    );
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

test.describe("expandRecurringEvents", () => {
  test("draws a series on each of its dates in the range, its first as the event itself", () => {
    const expanded = expandRecurringEvents([launch], summer);
    expect(summary(expanded)).toEqual([
      ["launch", "2026-06-06 10:00"],
      ["launch-2026-06-20", "2026-06-20 10:00"],
      ["launch-2026-07-04", "2026-07-04 10:00"],
    ]);
    expect(expanded[0]).toBe(launch);

    // A range after its first date gets only the dates in it
    const july = { start: new Date(2026, 6, 1), end: new Date(2026, 7, 2) };
    expect(summary(expandRecurringEvents([launch], july))).toEqual([
      ["launch-2026-07-04", "2026-07-04 10:00"],
      ["launch-2026-07-18", "2026-07-18 10:00"],
      ["launch-2026-08-01", "2026-08-01 10:00"],
    ]);
  });

  test("an occurrence carries its series' id, its original start and its fields", () => {
    const series = { ...launch, excludedDates: [new Date(2026, 6, 4, 10)] };
    const [, june20] = expandRecurringEvents([series], summer);
    expect(june20).toEqual({
      ...launch,
      id: "launch-2026-06-20",
      start: new Date(2026, 5, 20, 10),
      end: new Date(2026, 5, 20, 11),
      seriesId: "launch",
      originalStart: new Date(2026, 5, 20, 10),
    });
    expect(june20.excludedDates).toBeUndefined();
  });

  test("leaves out excluded dates, the first one included", () => {
    const series = {
      ...launch,
      excludedDates: [new Date(2026, 5, 6, 10), new Date(2026, 5, 20, 10)],
    };
    expect(summary(expandRecurringEvents([series], summer))).toEqual([
      ["launch-2026-07-04", "2026-07-04 10:00"],
    ]);
  });

  test("an edited occurrence takes the place of its generated one", () => {
    // June 20, moved to Sunday afternoon
    const moved: DetailedCalendarEvent = {
      ...launch,
      id: "launch-2026-06-20",
      start: new Date(2026, 5, 21, 15),
      end: new Date(2026, 5, 21, 16),
      seriesId: "launch",
      originalStart: new Date(2026, 5, 20, 10),
    };
    // July 4, from an .ics file, under an id of its own
    const imported: DetailedCalendarEvent = {
      ...launch,
      id: "launch_20260704T100000",
      start: new Date(2026, 6, 4, 9),
      end: new Date(2026, 6, 4, 10),
      seriesId: "launch",
      originalStart: new Date(2026, 6, 4, 10),
    };
    expect(
      summary(expandRecurringEvents([launch, moved, imported], summer)),
    ).toEqual([
      ["launch", "2026-06-06 10:00"],
      ["launch-2026-06-20", "2026-06-21 15:00"],
      ["launch_20260704T100000", "2026-07-04 09:00"],
    ]);
  });

  test("a copy the series arrows stored before stands for its day and doesn't repeat", () => {
    // ADR-004's June 20 copy, moved to Sunday: the series' rule, no seriesId
    const copy: DetailedCalendarEvent = {
      ...launch,
      id: "launch-2026-06-20",
      start: new Date(2026, 5, 21, 10),
      end: new Date(2026, 5, 21, 11),
    };
    expect(summary(expandRecurringEvents([launch, copy], summer))).toEqual([
      ["launch", "2026-06-06 10:00"],
      ["launch-2026-07-04", "2026-07-04 10:00"],
      ["launch-2026-06-20", "2026-06-21 10:00"],
    ]);
  });

  test("keeps the series' clock time in its zone across daylight saving", () => {
    // 9 AM in New York every Monday from March 2 2026 (EST); EDT from March 8
    const standup: DetailedCalendarEvent = {
      id: "standup",
      title: "Standup",
      start: new Date("2026-03-02T14:00:00Z"),
      end: new Date("2026-03-02T14:15:00Z"),
      timeZone: "America/New_York",
      recurrenceRule: { frequency: "weekly" },
    };
    const march = {
      start: new Date("2026-03-01T05:00:00Z"),
      end: new Date("2026-03-17T04:00:00Z"),
    };
    expect(
      expandRecurringEvents([standup], march).map((event) =>
        event.start.toISOString(),
      ),
    ).toEqual([
      "2026-03-02T14:00:00.000Z",
      "2026-03-09T13:00:00.000Z",
      "2026-03-16T13:00:00.000Z",
    ]);

    // 11 AM in São Paulo, which keeps one offset, when New York falls back
    const review: DetailedCalendarEvent = {
      id: "review",
      title: "Review",
      start: new Date("2026-10-24T14:00:00Z"),
      end: new Date("2026-10-24T15:00:00Z"),
      timeZone: "America/Sao_Paulo",
      recurrenceRule: { frequency: "weekly" },
    };
    const autumn = { start: new Date(2026, 9, 24), end: new Date(2026, 10, 8) };
    expect(
      expandRecurringEvents([review], autumn).map((event) =>
        event.start.toISOString(),
      ),
    ).toEqual([
      "2026-10-24T14:00:00.000Z",
      "2026-10-31T14:00:00.000Z",
      "2026-11-07T14:00:00.000Z",
    ]);
  });

  test("an all-day series keeps whole days across daylight saving", () => {
    const trash: DetailedCalendarEvent = {
      id: "trash",
      title: "Trash day",
      start: new Date(2026, 9, 26),
      end: new Date(2026, 9, 26),
      isAllDay: true,
      recurrenceRule: { frequency: "weekly" },
    };
    const range = { start: new Date(2026, 9, 25), end: new Date(2026, 10, 10) };
    expect(
      expandRecurringEvents([trash], range).map((event) => [
        local(event.start),
        local(event.end),
      ]),
    ).toEqual([
      ["2026-10-26 00:00", "2026-10-26 00:00"],
      ["2026-11-02 00:00", "2026-11-02 00:00"],
      ["2026-11-09 00:00", "2026-11-09 00:00"],
    ]);
  });

  test("reads an RRULE in recurrence, but not display text", () => {
    const base = {
      title: "Sync",
      start: new Date(2026, 5, 1, 9),
      end: new Date(2026, 5, 1, 10),
    };
    const rrule: DetailedCalendarEvent = {
      ...base,
      id: "rrule",
      recurrence: "FREQ=DAILY;COUNT=3",
    };
    const text: DetailedCalendarEvent = {
      ...base,
      id: "text",
      recurrence: "Every day",
    };
    expect(summary(expandRecurringEvents([rrule, text], summer))).toEqual([
      ["rrule", "2026-06-01 09:00"],
      ["rrule-2026-06-02", "2026-06-02 09:00"],
      ["rrule-2026-06-03", "2026-06-03 09:00"],
      ["text", "2026-06-01 09:00"],
    ]);
  });

  test("events that don't repeat come back as they are, in range or not", () => {
    const lunch: DetailedCalendarEvent = {
      id: "lunch",
      title: "Lunch",
      start: new Date(2025, 0, 1, 12),
      end: new Date(2025, 0, 1, 13),
    };
    const expanded = expandRecurringEvents([lunch], summer);
    expect(expanded).toHaveLength(1);
    expect(expanded[0]).toBe(lunch);
  });

  test("caps the occurrences of one series in one range", () => {
    const daily: DetailedCalendarEvent = {
      id: "daily",
      title: "Daily",
      start: new Date(2026, 0, 1, 9),
      end: new Date(2026, 0, 1, 10),
      recurrenceRule: { frequency: "daily" },
    };
    const fourYears = {
      start: new Date(2026, 0, 1),
      end: new Date(2030, 0, 1),
    };
    expect(expandRecurringEvents([daily], fourYears)).toHaveLength(
      MAX_OCCURRENCES_PER_RANGE,
    );
  });
});

test.describe("findEventOrOccurrence", () => {
  test("finds stored events and the occurrences their ids name", () => {
    const series = { ...launch, excludedDates: [new Date(2026, 6, 18, 10)] };
    const moved: DetailedCalendarEvent = {
      ...launch,
      id: "launch-2026-07-04",
      start: new Date(2026, 6, 5, 10),
      end: new Date(2026, 6, 5, 11),
      seriesId: "launch",
      originalStart: new Date(2026, 6, 4, 10),
    };
    const events = [series, moved];
    expect(findEventOrOccurrence(events, "launch")).toBe(series);
    expect(findEventOrOccurrence(events, "launch-2026-07-04")).toBe(moved);
    expect(
      local(findEventOrOccurrence(events, "launch-2026-06-20")?.start ?? null),
    ).toBe("2026-06-20 10:00");
    // A Saturday the rule skips, an excluded one, one after the series'
    // end, and ids nothing names
    for (const id of [
      "launch-2026-06-13",
      "launch-2026-07-18",
      "launch-2026-08-29",
      "lunch",
      "lunch-2026-06-20",
    ]) {
      expect(findEventOrOccurrence(events, id), id).toBeNull();
    }
  });
});

test.describe("applyRecurringEdit", () => {
  /** The June 20 occurrence, generated */
  function june20(): DetailedCalendarEvent {
    const occurrence = findEventOrOccurrence([launch], "launch-2026-06-20");
    if (!occurrence) throw new Error("No June 20 occurrence");
    return occurrence;
  }

  test("an edit to an occurrence keeps it in its series", () => {
    const occurrence = june20();
    const edited = {
      ...occurrence,
      start: new Date(2026, 5, 20, 14),
      end: new Date(2026, 5, 20, 15),
    };
    expect(applyRecurringEdit([launch], occurrence, edited)).toBe(edited);
  });

  test("a new rule takes an occurrence out of its series", () => {
    const occurrence = june20();
    const edited: DetailedCalendarEvent = {
      ...occurrence,
      recurrenceRule: { frequency: "daily" },
    };
    const stored = applyRecurringEdit([launch], occurrence, edited);
    expect(stored.id).toBe("launch-2026-06-20");
    expect(stored.seriesId).toBeUndefined();
    expect(stored.originalStart).toBeUndefined();

    // It repeats on its own, and the series still skips June 20
    const days = { start: new Date(2026, 5, 20), end: new Date(2026, 5, 23) };
    expect(summary(expandRecurringEvents([launch, stored], days))).toEqual([
      ["launch-2026-06-20", "2026-06-20 10:00"],
      ["launch-2026-06-20-2026-06-21", "2026-06-21 10:00"],
      ["launch-2026-06-20-2026-06-22", "2026-06-22 10:00"],
    ]);
  });

  test("moving the series' event to another day takes its rule along", () => {
    // Saturday June 6 to Friday June 5: every other Friday from then on
    const moved = {
      ...launch,
      start: new Date(2026, 5, 5, 10),
      end: new Date(2026, 5, 5, 11),
    };
    const stored = applyRecurringEdit([launch], launch, moved);
    expect(stored.recurrenceRule).toEqual({
      ...launch.recurrenceRule,
      weekdays: [5],
    });
    expect(summary(expandRecurringEvents([stored], summer))).toEqual([
      ["launch", "2026-06-05 10:00"],
      ["launch-2026-06-19", "2026-06-19 10:00"],
      ["launch-2026-07-03", "2026-07-03 10:00"],
    ]);

    // Within its day the rule stays as it is
    const later = {
      ...launch,
      start: new Date(2026, 5, 6, 14),
      end: new Date(2026, 5, 6, 15),
    };
    expect(applyRecurringEdit([launch], launch, later)).toBe(later);

    // A weekday of the month takes the new day's place in its month; the
    // last one stays the last
    const firstSaturday: RecurrenceRule = {
      frequency: "monthly",
      monthlyBy: "weekday-of-month",
      weekOfMonth: 1,
    };
    expect(
      moveRecurrenceRule(
        firstSaturday,
        new Date(2026, 5, 6),
        new Date(2026, 5, 13),
      ),
    ).toEqual({ ...firstSaturday, weekOfMonth: 2 });
    const lastSaturday: RecurrenceRule = { ...firstSaturday, weekOfMonth: -1 };
    expect(
      moveRecurrenceRule(
        lastSaturday,
        new Date(2026, 5, 27),
        new Date(2026, 5, 28),
      ),
    ).toEqual(lastSaturday);
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

test.describe("getOccurrenceRemoval", () => {
  test("a generated date is excluded from its series", () => {
    const june20 = findEventOrOccurrence([launch], "launch-2026-06-20");
    if (!june20) throw new Error("No June 20 occurrence");
    const removal = getOccurrenceRemoval([launch], june20);
    if (!removal) throw new Error("No removal");
    expect(removal.series).toBe(launch);
    expect(removal.removed).toBeNull();
    expect(removal.excluded.excludedDates).toEqual([new Date(2026, 5, 20, 10)]);
    // The series no longer draws it
    const expanded = expandRecurringEvents([removal.excluded], summer);
    expect(summary(expanded).map(([id]) => id)).toEqual([
      "launch",
      "launch-2026-07-04",
    ]);
  });

  test("a stored date is removed and excluded by the day it stands for", () => {
    // June 20, moved to Sunday: it still stands for June 20
    const moved: DetailedCalendarEvent = {
      ...launch,
      id: "launch-2026-06-20",
      start: new Date(2026, 5, 21, 15),
      end: new Date(2026, 5, 21, 16),
      seriesId: "launch",
      originalStart: new Date(2026, 5, 20, 10),
    };
    const removal = getOccurrenceRemoval([launch, moved], moved);
    expect(removal?.removed).toBe(moved);
    expect(removal?.excluded.excludedDates).toEqual([
      new Date(2026, 5, 20, 10),
    ]);

    // A copy ADR-004's arrows stored has no originalStart: its id names it
    const copy: DetailedCalendarEvent = { ...launch, id: "launch-2026-07-04" };
    const copyRemoval = getOccurrenceRemoval([launch, copy], copy);
    expect(copyRemoval?.removed).toBe(copy);
    expect(copyRemoval?.excluded.excludedDates).toEqual([
      new Date(2026, 6, 4, 10),
    ]);
  });

  test("the series' own event and events that don't repeat have no removal", () => {
    expect(getOccurrenceRemoval([launch], launch)).toBeNull();
    const lunch: DetailedCalendarEvent = {
      id: "lunch",
      title: "Lunch",
      start: new Date(2026, 5, 1, 12),
      end: new Date(2026, 5, 1, 13),
    };
    expect(getOccurrenceRemoval([launch, lunch], lunch)).toBeNull();
  });
});

test.describe("createStandaloneCopy", () => {
  test("drops seriesId and originalStart and keeps the rule", () => {
    const june20 = findEventOrOccurrence([launch], "launch-2026-06-20");
    if (!june20) throw new Error("No June 20 occurrence");
    const copy = createStandaloneCopy(june20, "copy");
    expect(copy.id).toBe("copy");
    expect("seriesId" in copy).toBe(false);
    expect("originalStart" in copy).toBe(false);
    expect(copy.recurrenceRule).toEqual(launch.recurrenceRule);
    expect(local(copy.start)).toBe("2026-06-20 10:00");
  });
});
