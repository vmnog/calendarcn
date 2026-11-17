import { expect, test } from "@playwright/test";

import {
  applyEventChanges,
  invertEventChanges,
} from "../src/lib/event-history";
import { findEventOrOccurrence } from "../src/lib/recurrence";
import {
  describeGroupAction,
  describeGroupNotice,
  getEventRemovalChanges,
  getGroupMoveTimes,
  getPastedGroupTimes,
  getVisibleEventIds,
  isEventMove,
  mergeEventChanges,
  toggleSelectedEventId,
} from "../src/lib/event-selection";
import type {
  DetailedCalendarEvent,
  EventHistoryChange,
} from "../src/components/calendar-types";

/** Helpers in `src/lib/event-selection.ts`, run in Node without a page */

/** A timed event on a June 2026 day, from hours (fractions are minutes) */
function timed(
  id: string,
  day: number,
  startHour: number,
  endHour: number,
): DetailedCalendarEvent {
  const at = (hour: number) =>
    new Date(2026, 5, day, Math.floor(hour), Math.round((hour % 1) * 60));
  return { id, title: id, start: at(startHour), end: at(endHour) };
}

/** An all-day event on June `day`, one day long */
function allDay(id: string, day: number): DetailedCalendarEvent {
  return {
    id,
    title: id,
    start: new Date(2026, 5, day),
    end: new Date(2026, 5, day + 1),
    isAllDay: true,
  };
}

/** A weekly series starting Monday June 1, 9 to 10 AM */
const STANDUP: DetailedCalendarEvent = {
  ...timed("standup", 1, 9, 10),
  recurrenceRule: { frequency: "weekly", weekdays: [1] },
};

test.describe("the selection", () => {
  test("Shift-click adds an event, and takes a selected one out", () => {
    expect(toggleSelectedEventId([], "a")).toEqual(["a"]);
    expect(toggleSelectedEventId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelectedEventId(["a", "b"], "a")).toEqual(["b"]);
  });

  test("Select all visible takes the events and dates on screen, in order", () => {
    const events = [
      timed("late", 3, 15, 16),
      timed("early", 2, 9, 10),
      timed("next-week", 9, 9, 10),
      allDay("holiday", 4),
      STANDUP,
    ];
    const ids = getVisibleEventIds(events, {
      start: new Date(2026, 4, 31),
      end: new Date(2026, 5, 7),
    });

    expect(ids).toEqual(["standup", "early", "late", "holiday"]);
  });

  test("a repeating event's later dates are selected by their own ids", () => {
    const ids = getVisibleEventIds([STANDUP], {
      start: new Date(2026, 5, 7),
      end: new Date(2026, 5, 14),
    });

    expect(ids).toEqual(["standup-2026-06-08"]);
  });
});

test.describe("acting on several events", () => {
  test("changes to one event in a row merge into one", () => {
    const a = timed("a", 1, 9, 10);
    const a2 = timed("a", 1, 10, 11);
    const a3 = timed("a", 1, 11, 12);
    const b = timed("b", 1, 9, 10);
    const changes: EventHistoryChange<DetailedCalendarEvent>[] = [
      { before: a, after: a2, index: 0 },
      { before: b, after: null, index: 1 },
      { before: a2, after: a3, index: 0 },
    ];

    expect(mergeEventChanges(changes)).toEqual([
      { before: a, after: a3, index: 0 },
      { before: b, after: null, index: 1 },
    ]);
  });

  test("deleting two dates of a series excludes both, and undo restores it", () => {
    const events = [STANDUP, timed("other", 2, 9, 10)];
    let working = events;
    const changes: EventHistoryChange<DetailedCalendarEvent>[] = [];
    for (const id of ["standup-2026-06-08", "standup-2026-06-15", "other"]) {
      const event = findEventOrOccurrence(working, id);
      if (!event) throw new Error(`no ${id}`);
      const eventChanges = getEventRemovalChanges(working, event);
      working = applyEventChanges(working, eventChanges);
      changes.push(...eventChanges);
    }
    const merged = mergeEventChanges(changes);

    // One change for the series, one for the removed event
    expect(merged).toHaveLength(2);
    const after = applyEventChanges(events, merged);
    expect(after.map((e) => e.id)).toEqual(["standup"]);
    expect(after[0].excludedDates).toHaveLength(2);
    expect(applyEventChanges(after, invertEventChanges(merged))).toEqual(
      events,
    );
  });

  test("pasted events keep their distance from the earliest", () => {
    const sources = [timed("b", 6, 14, 14.5), timed("a", 6, 10, 11.5)];
    const times = getPastedGroupTimes(sources, {
      date: new Date(2026, 5, 5, 9),
      hasTime: true,
    });

    expect(times).toEqual([
      { start: new Date(2026, 5, 5, 13), end: new Date(2026, 5, 5, 13, 30) },
      { start: new Date(2026, 5, 5, 9), end: new Date(2026, 5, 5, 10, 30) },
    ]);
  });

  test("pasted on a day, they move by whole days and keep their times", () => {
    const sources = [timed("a", 6, 10, 11), allDay("b", 7)];
    const times = getPastedGroupTimes(sources, {
      date: new Date(2026, 5, 10),
      hasTime: false,
    });

    expect(times).toEqual([
      { start: new Date(2026, 5, 10, 10), end: new Date(2026, 5, 10, 11) },
      { start: new Date(2026, 5, 11), end: new Date(2026, 5, 12) },
    ]);
  });

  test("a move is a new start with the same length", () => {
    const before = timed("a", 1, 9, 10);
    expect(isEventMove(before, timed("a", 1, 10, 11))).toBe(true);
    expect(isEventMove(before, timed("a", 1, 9, 11))).toBe(false);
    expect(isEventMove(before, timed("a", 1, 9, 10))).toBe(false);
    expect(isEventMove(before, { ...allDay("a", 2) })).toBe(false);
  });

  test("the others move by the same minutes, all-day events by days", () => {
    const previous = timed("moved", 1, 9, 10);
    const next = timed("moved", 2, 10, 11);

    expect(getGroupMoveTimes(timed("b", 3, 14, 15), previous, next)).toEqual({
      start: new Date(2026, 5, 4, 15),
      end: new Date(2026, 5, 4, 16),
    });
    expect(getGroupMoveTimes(allDay("c", 5), previous, next)).toEqual({
      start: new Date(2026, 5, 6),
      end: new Date(2026, 5, 7),
    });
  });

  test("toasts and announcements count the events", () => {
    expect(describeGroupNotice("delete", 3)).toEqual({
      message: "3 events deleted",
    });
    expect(describeGroupNotice("cut", 2)).toEqual({ message: "2 events cut" });
    expect(describeGroupNotice("copy", 2)).toEqual({
      message: "2 events copied to clipboard",
    });
    expect(describeGroupAction("paste", 4)).toBe("Pasted 4 events");
    expect(describeGroupAction("move", 2)).toBe("Moved 2 events");
  });
});
