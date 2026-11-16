import { expect, test } from "@playwright/test";

import type {
  CalendarEvent,
  EventHistory,
  EventHistoryChange,
  EventHistoryEntry,
  VisibleRange,
} from "@/components/calendar-types";
import {
  EMPTY_EVENT_HISTORY,
  EVENT_HISTORY_LIMIT,
  EVENT_HISTORY_MERGE_MS,
  applyEventChanges,
  canApplyEventChanges,
  describeEventAction,
  describeHistoryStep,
  getPastedEventTimes,
  invertEventChanges,
  isSameEventValue,
  recordEventHistory,
  resolvePasteTarget,
} from "@/lib/event-history";

/**
 * Undo steps and paste placement (`src/lib/event-history.ts`), run in Node
 * without a page. The unit lane runs with TZ=America/New_York.
 */

const standup: CalendarEvent = {
  id: "standup",
  title: "Standup",
  start: new Date(2026, 5, 4, 9),
  end: new Date(2026, 5, 4, 9, 30),
};
const review: CalendarEvent = {
  id: "review",
  title: "Review",
  start: new Date(2026, 5, 4, 14),
  end: new Date(2026, 5, 4, 15),
};
const offsite: CalendarEvent = {
  id: "offsite",
  title: "Offsite",
  start: new Date(2026, 5, 5),
  end: new Date(2026, 5, 6),
  isAllDay: true,
};
const events = [standup, review, offsite];

/** An edit step of one event, recorded at `time` */
function editStep(
  before: CalendarEvent,
  after: CalendarEvent,
  time: number,
): EventHistoryEntry {
  return { action: "edit", changes: [{ before, after, index: 0 }], time };
}

test.describe("applying and undoing changes", () => {
  test("an edit replaces the event in place and keeps the other objects", () => {
    const moved = {
      ...review,
      start: new Date(2026, 5, 4, 16),
      end: new Date(2026, 5, 4, 17),
    };
    const next = applyEventChanges(events, [
      { before: review, after: moved, index: 1 },
    ]);
    expect(next).toEqual([standup, moved, offsite]);
    expect(next[0]).toBe(standup);
    expect(events[1]).toBe(review);
  });

  test("undoing a delete puts the event back where it was", () => {
    const deletion: EventHistoryChange[] = [
      { before: review, after: null, index: 1 },
    ];
    const deleted = applyEventChanges(events, deletion);
    expect(deleted).toEqual([standup, offsite]);
    expect(applyEventChanges(deleted, invertEventChanges(deletion))).toEqual(
      events,
    );
  });

  test("undoing a create removes the event", () => {
    const copy = { ...review, id: "copy" };
    const creation: EventHistoryChange[] = [
      { before: null, after: copy, index: 3 },
    ];
    const created = applyEventChanges(events, creation);
    expect(created).toEqual([...events, copy]);
    expect(applyEventChanges(created, invertEventChanges(creation))).toEqual(
      events,
    );
  });

  test("a step of two changes is undone last change first", () => {
    const renamed = { ...standup, title: "Daily" };
    const changes: EventHistoryChange[] = [
      { before: standup, after: renamed, index: 0 },
      { before: review, after: null, index: 1 },
    ];
    expect(invertEventChanges(changes)).toEqual([
      { before: null, after: review, index: 1 },
      { before: renamed, after: standup, index: 0 },
    ]);
  });

  test("an undo applies only while the events are the objects it left", () => {
    const renamed = { ...standup, title: "Daily" };
    const undoRename = invertEventChanges([
      { before: standup, after: renamed, index: 0 },
    ]);
    expect(canApplyEventChanges([renamed, review], undoRename)).toBe(true);
    // The app reloaded its events: an equal copy is not the same event
    expect(canApplyEventChanges([{ ...renamed }, review], undoRename)).toBe(
      false,
    );
    // The app removed it
    expect(canApplyEventChanges([review], undoRename)).toBe(false);
  });

  test("an undone delete applies only while no event has its id", () => {
    const undoDelete = invertEventChanges([
      { before: review, after: null, index: 1 },
    ]);
    expect(canApplyEventChanges([standup], undoDelete)).toBe(true);
    expect(canApplyEventChanges([standup, { ...review }], undoDelete)).toBe(
      false,
    );
  });
});

test.describe("recording undo steps", () => {
  const typedP = { ...standup, title: "P" };
  const typedPl = { ...standup, title: "Pl" };

  test("a step goes on top and clears the redo steps", () => {
    const history: EventHistory = {
      past: [],
      future: [editStep(standup, typedP, 0)],
    };
    const entry: EventHistoryEntry = {
      action: "delete",
      changes: [{ before: review, after: null, index: 1 }],
      time: 5000,
    };
    expect(recordEventHistory(history, entry)).toEqual({
      past: [entry],
      future: [],
    });
  });

  test("the oldest steps are dropped past the limit", () => {
    let history = EMPTY_EVENT_HISTORY;
    for (let i = 0; i <= EVENT_HISTORY_LIMIT; i++) {
      history = recordEventHistory(history, {
        action: "delete",
        changes: [
          { before: { ...review, id: `e${i}` }, after: null, index: 0 },
        ],
        time: i * EVENT_HISTORY_MERGE_MS,
      });
    }
    expect(history.past).toHaveLength(EVENT_HISTORY_LIMIT);
    expect(history.past[0].changes[0].before?.id).toBe("e1");
  });

  test("quick edits to one event are one step, from its first value to its last", () => {
    const last = 1000 + EVENT_HISTORY_MERGE_MS - 1;
    let history = recordEventHistory(
      EMPTY_EVENT_HISTORY,
      editStep(standup, typedP, 1000),
    );
    history = recordEventHistory(history, editStep(typedP, typedPl, last));
    expect(history.past).toEqual([editStep(standup, typedPl, last)]);
  });

  test("edits further apart, or to another event, stay separate steps", () => {
    const apart = recordEventHistory(
      recordEventHistory(EMPTY_EVENT_HISTORY, editStep(standup, typedP, 0)),
      editStep(typedP, typedPl, EVENT_HISTORY_MERGE_MS),
    );
    expect(apart.past).toHaveLength(2);

    const moved = { ...review, start: new Date(2026, 5, 4, 16) };
    const other = recordEventHistory(
      recordEventHistory(EMPTY_EVENT_HISTORY, editStep(standup, typedP, 0)),
      editStep(review, moved, 10),
    );
    expect(other.past).toHaveLength(2);
  });

  test("a create and an edit right after it stay separate steps", () => {
    const created = recordEventHistory(EMPTY_EVENT_HISTORY, {
      action: "create",
      changes: [{ before: null, after: typedP, index: 3 }],
      time: 0,
    });
    expect(
      recordEventHistory(created, editStep(typedP, typedPl, 10)).past,
    ).toHaveLength(2);
  });

  test("quick edits that end where they began leave no step", () => {
    // Typing in the title, then Escape restoring it
    const typed = recordEventHistory(
      EMPTY_EVENT_HISTORY,
      editStep(standup, typedP, 0),
    );
    const restored = { ...typedP, title: "Standup" };
    expect(recordEventHistory(typed, editStep(typedP, restored, 10))).toEqual({
      past: [],
      future: [],
    });
  });

  test("an edit that changes no value is left out, redo steps and all", () => {
    const history: EventHistory = {
      past: [],
      future: [editStep(standup, typedP, 0)],
    };
    expect(
      recordEventHistory(history, editStep(standup, { ...standup }, 10)),
    ).toBe(history);
  });
});

test("events with the same values are the same, dates compared by time", () => {
  expect(
    isSameEventValue(standup, {
      ...standup,
      start: new Date(standup.start.getTime()),
    }),
  ).toBe(true);
  expect(isSameEventValue(standup, { ...standup, title: "Daily" })).toBe(false);
  expect(isSameEventValue(standup, { ...standup, color: "red" })).toBe(false);
});

test.describe("where a paste goes", () => {
  /** The week of Sunday May 31, 2026 */
  const week: VisibleRange = {
    start: new Date(2026, 4, 31),
    end: new Date(2026, 5, 7),
  };
  const thursdayMorning = new Date(2026, 5, 4, 8);

  test("the spot under the mouse is used while it is on screen", () => {
    const slot = { date: new Date(2026, 5, 5, 10), hasTime: true };
    expect(resolvePasteTarget(slot, week, thursdayMorning, week.start)).toBe(
      slot,
    );
  });

  test("otherwise today, then the first day on screen, at the event's own time", () => {
    const lastWeek = { date: new Date(2026, 4, 28, 10), hasTime: true };
    expect(
      resolvePasteTarget(lastWeek, week, thursdayMorning, week.start),
    ).toEqual({ date: new Date(2026, 5, 4), hasTime: false });
    expect(
      resolvePasteTarget(null, week, new Date(2026, 5, 20, 8), week.start),
    ).toEqual({ date: new Date(2026, 4, 31), hasTime: false });
  });

  test("at a slot, a timed event starts there and keeps its length", () => {
    expect(
      getPastedEventTimes(review, {
        date: new Date(2026, 5, 5, 10),
        hasTime: true,
      }),
    ).toEqual({
      start: new Date(2026, 5, 5, 10),
      end: new Date(2026, 5, 5, 11),
    });
  });

  test("on a day, a timed event keeps its time of day", () => {
    expect(
      getPastedEventTimes(standup, {
        date: new Date(2026, 5, 10),
        hasTime: false,
      }),
    ).toEqual({
      start: new Date(2026, 5, 10, 9),
      end: new Date(2026, 5, 10, 9, 30),
    });
  });

  test("an all-day event stays all-day over as many days, even at a slot", () => {
    expect(
      getPastedEventTimes(offsite, {
        date: new Date(2026, 5, 10, 15),
        hasTime: true,
      }),
    ).toEqual({ start: new Date(2026, 5, 10), end: new Date(2026, 5, 11) });
  });

  test("across a daylight saving change, a 9 AM event still starts at 9 AM", () => {
    // June 4 is daylight time in New York, March 7 standard time
    expect(
      getPastedEventTimes(standup, {
        date: new Date(2026, 2, 7),
        hasTime: false,
      }),
    ).toEqual({
      start: new Date(2026, 2, 7, 9),
      end: new Date(2026, 2, 7, 9, 30),
    });
  });
});

test("announcements name the action and the event", () => {
  expect(describeEventAction("delete", standup)).toBe("Deleted Standup");
  expect(describeEventAction("copy", { ...standup, title: " " })).toBe(
    "Copied Untitled event",
  );
  const paste: EventHistoryEntry = {
    action: "paste",
    changes: [{ before: null, after: review, index: 2 }],
    time: 0,
  };
  expect(describeHistoryStep(paste, "undo")).toBe("Undid pasting Review");
  expect(describeHistoryStep(paste, "redo")).toBe("Redid pasting Review");
});
