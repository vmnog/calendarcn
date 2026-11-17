import { expect, test } from "@playwright/test";

import type {
  DetailedCalendarEvent,
  TimeSpan,
  WorkingHours,
} from "../src/components/calendar-types";
import {
  DEFAULT_WORKING_HOURS,
  getBusyTimes,
  getSharedFreeTime,
  getWorkingTimes,
  isBusyEvent,
  mergeTimeSpans,
} from "../src/lib/free-busy";

/**
 * Free time everyone shares while meeting with people
 * (`src/lib/free-busy.ts`). Runs in Node with TZ=America/New_York (the
 * `test:unit` script), the viewer's zone for the working hours.
 */

/** Thursday June 4 2026, a working day */
const THURSDAY = new Date(2026, 5, 4);

/** Saturday June 6 2026, outside the default working days */
const SATURDAY = new Date(2026, 5, 6);

/** A timed event on Thursday June 4 2026, hours and minutes in New York */
function timed(
  id: string,
  startHour: number,
  endHour: number,
  extra: Partial<DetailedCalendarEvent> = {},
): DetailedCalendarEvent {
  const startMinutes = Math.round((startHour % 1) * 60);
  const endMinutes = Math.round((endHour % 1) * 60);
  return {
    id,
    title: id,
    start: new Date(2026, 5, 4, Math.floor(startHour), startMinutes),
    end: new Date(2026, 5, 4, Math.floor(endHour), endMinutes),
    ...extra,
  };
}

/** Spans as "HH:mm-HH:mm" in New York, easier to read in failures */
function asClock(spans: TimeSpan[]): string[] {
  const clock = (date: Date) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return spans.map((span) => `${clock(span.start)}-${clock(span.end)}`);
}

test.describe("which events keep someone busy", () => {
  test("timed events do, unless marked free", () => {
    expect(isBusyEvent(timed("a", 9, 10))).toBe(true);
    expect(isBusyEvent(timed("a", 9, 10, { status: "busy" }))).toBe(true);
    expect(isBusyEvent(timed("a", 9, 10, { status: "free" }))).toBe(false);
  });

  test("all-day events don't, unless marked busy", () => {
    const allDay: DetailedCalendarEvent = {
      id: "trip",
      title: "Trip",
      start: THURSDAY,
      end: new Date(2026, 5, 5),
      isAllDay: true,
    };
    expect(isBusyEvent(allDay)).toBe(false);
    expect(isBusyEvent({ ...allDay, status: "busy" })).toBe(true);
  });

  test("an event its calendar's owner declined doesn't, nor a birthday", () => {
    const declined = timed("lunch", 12, 13, {
      calendarEmail: "you@example.com",
      participants: [
        { email: "priya@example.com", organizer: true, response: "accepted" },
        { email: "You@Example.com", response: "declined" },
      ],
    });
    expect(isBusyEvent(declined)).toBe(false);
    // Someone else declining leaves the owner busy
    const othersDeclined = timed("lunch", 12, 13, {
      calendarEmail: "you@example.com",
      participants: [{ email: "priya@example.com", response: "declined" }],
    });
    expect(isBusyEvent(othersDeclined)).toBe(true);
    expect(isBusyEvent(timed("cake", 9, 10, { kind: "birthday" }))).toBe(false);
  });
});

test.describe("merging busy times", () => {
  test("overlapping and touching spans join, gaps stay", () => {
    const spans = [
      timed("c", 14, 15),
      timed("a", 9, 10),
      timed("b", 9.5, 11),
      timed("d", 11, 11.5),
      timed("e", 13, 13),
    ];
    expect(asClock(mergeTimeSpans(spans))).toEqual([
      "09:00-11:30",
      "14:00-15:00",
    ]);
  });

  test("a span inside another adds nothing", () => {
    expect(
      asClock(mergeTimeSpans([timed("a", 9, 12), timed("b", 10, 11)])),
    ).toEqual(["09:00-12:00"]);
  });
});

test.describe("busy times of one calendar", () => {
  const day = { start: THURSDAY, end: new Date(2026, 5, 5) };

  test("clipped to the range, free and all-day events left out", () => {
    const events = [
      {
        ...timed("late", 0, 0),
        start: new Date(2026, 5, 3, 23),
        end: new Date(2026, 5, 4, 1),
      },
      timed("standup", 9, 9.25),
      timed("focus", 13, 15, { status: "free" }),
      {
        id: "holiday",
        title: "Holiday",
        start: THURSDAY,
        end: new Date(2026, 5, 5),
        isAllDay: true,
      },
    ];
    expect(asClock(getBusyTimes(events, day))).toEqual([
      "00:00-01:00",
      "09:00-09:15",
    ]);
  });

  test("a repeating event blocks each of its dates", () => {
    const daily: DetailedCalendarEvent = {
      id: "standup",
      title: "Standup",
      start: new Date(2026, 5, 1, 9),
      end: new Date(2026, 5, 1, 9, 30),
      recurrenceRule: { frequency: "daily" },
    };
    expect(asClock(getBusyTimes([daily], day))).toEqual(["09:00-09:30"]);
  });
});

test.describe("working hours", () => {
  test("9 to 5 on weekdays by default, nothing on weekends", () => {
    expect(DEFAULT_WORKING_HOURS).toEqual({
      days: [1, 2, 3, 4, 5],
      startHour: 9,
      endHour: 17,
    });
    expect(asClock(getWorkingTimes([THURSDAY, SATURDAY]))).toEqual([
      "09:00-17:00",
    ]);
  });

  test("custom hours, up to midnight", () => {
    const evenings: WorkingHours = { days: [6], startHour: 18, endHour: 24 };
    const [span] = getWorkingTimes([THURSDAY, SATURDAY], evenings);
    expect(span.start).toEqual(new Date(2026, 5, 6, 18));
    expect(span.end).toEqual(new Date(2026, 5, 7));
  });

  test("hours ending before they start give nothing", () => {
    expect(
      getWorkingTimes([THURSDAY], { days: [4], startHour: 17, endHour: 9 }),
    ).toEqual([]);
  });
});

test.describe("free time everyone shares", () => {
  test("the gaps left by every calendar inside working hours", () => {
    const you = [timed("standup", 9, 9.5), timed("lunch", 12, 13)];
    const priya = [timed("review", 10, 11), timed("1:1", 12.5, 13.5)];
    const sam = [timed("call", 15, 17.5)];
    expect(asClock(getSharedFreeTime([you, priya, sam], [THURSDAY]))).toEqual([
      "09:30-10:00",
      "11:00-12:00",
      "13:30-15:00",
    ]);
  });

  test("stretches shorter than the minimum are dropped", () => {
    const you = [timed("a", 9, 9.75), timed("b", 10, 17)];
    expect(asClock(getSharedFreeTime([you], [THURSDAY]))).toEqual([]);
    expect(
      asClock(getSharedFreeTime([you], [THURSDAY], { minMinutes: 15 })),
    ).toEqual(["09:45-10:00"]);
  });

  test("no events: the whole working day, and none on a weekend", () => {
    expect(asClock(getSharedFreeTime([[], []], [THURSDAY, SATURDAY]))).toEqual([
      "09:00-17:00",
    ]);
  });

  test("an all-day event leaves the day free, a busy one blocks it", () => {
    const offsite: DetailedCalendarEvent = {
      id: "offsite",
      title: "Offsite",
      start: THURSDAY,
      end: new Date(2026, 5, 5),
      isAllDay: true,
    };
    expect(asClock(getSharedFreeTime([[offsite]], [THURSDAY]))).toEqual([
      "09:00-17:00",
    ]);
    expect(
      getSharedFreeTime([[{ ...offsite, status: "busy" }]], [THURSDAY]),
    ).toEqual([]);
  });

  test("declined events don't block", () => {
    const declined = timed("party", 9, 17, {
      calendarEmail: "you@example.com",
      participants: [{ email: "you@example.com", response: "declined" }],
    });
    expect(asClock(getSharedFreeTime([[declined]], [THURSDAY]))).toEqual([
      "09:00-17:00",
    ]);
  });

  test("events written in other time zones block the moments they cover", () => {
    // 3 PM in London (GMT+1 in June) is 10 AM in New York
    const london = {
      id: "london",
      title: "London call",
      start: new Date("2026-06-04T14:00:00Z"),
      end: new Date("2026-06-04T15:00:00Z"),
      timeZone: "Europe/London",
    };
    const tokyo = {
      id: "tokyo",
      title: "Tokyo sync",
      // 5 AM Friday in Tokyo is 4 PM Thursday in New York
      start: new Date("2026-06-04T20:00:00Z"),
      end: new Date("2026-06-04T20:30:00Z"),
      timeZone: "Asia/Tokyo",
    };
    expect(asClock(getSharedFreeTime([[london], [tokyo]], [THURSDAY]))).toEqual(
      ["09:00-10:00", "11:00-16:00", "16:30-17:00"],
    );
  });

  test("a day when the clocks change keeps its local working hours", () => {
    // Sunday November 1 2026: New York goes back from GMT-4 to GMT-5
    const fallBack = new Date(2026, 10, 1);
    const sundays: WorkingHours = { days: [0], startHour: 0, endHour: 4 };
    const [slot] = getSharedFreeTime([[]], [fallBack], {
      workingHours: sundays,
    });
    expect(slot.start).toEqual(new Date(2026, 10, 1, 0));
    expect(slot.end).toEqual(new Date(2026, 10, 1, 4));
    // Five hours long, not four: 1 AM happens twice
    expect((slot.end.getTime() - slot.start.getTime()) / 3_600_000).toBe(5);
  });
});
