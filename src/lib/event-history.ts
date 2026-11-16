import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

import type {
  CalendarEvent,
  EventHistory,
  EventHistoryAction,
  EventHistoryChange,
  EventHistoryEntry,
  EventPasteTarget,
  VisibleRange,
} from "@/components/calendar-types";
import { getSpokenTitle } from "@/lib/event-utils";

/** Undo steps kept; past it, the oldest are dropped first */
export const EVENT_HISTORY_LIMIT = 100;

/**
 * Two edits to one event less than this many milliseconds apart are one
 * undo step, so a title typed letter by letter is undone at once
 */
export const EVENT_HISTORY_MERGE_MS = 1000;

/** A history with nothing to undo or redo */
export const EMPTY_EVENT_HISTORY: EventHistory = { past: [], future: [] };

/** How each action's announcement starts: "Deleted Team sync" */
const ACTION_ANNOUNCEMENTS: Record<EventHistoryAction | "copy", string> = {
  create: "Created",
  edit: "Changed",
  delete: "Deleted",
  cut: "Cut",
  copy: "Copied",
  duplicate: "Duplicated",
  paste: "Pasted",
};

/** How undo and redo name each action: "Undid deleting Team sync" */
const ACTION_NAMES: Record<EventHistoryAction, string> = {
  create: "creating",
  edit: "editing",
  delete: "deleting",
  cut: "cutting",
  duplicate: "duplicating",
  paste: "pasting",
};

/** An edit step's one change with both events, or `null` for any other step */
function getEdit<TEvent extends CalendarEvent>(
  entry: EventHistoryEntry<TEvent>,
): { before: TEvent; after: TEvent; index: number } | null {
  if (entry.action !== "edit" || entry.changes.length !== 1) return null;
  const [change] = entry.changes;
  if (!change.before || !change.after) return null;
  return { before: change.before, after: change.after, index: change.index };
}

/** An event's fields by name, to compare two events field by field */
function getFields(event: CalendarEvent): Record<string, unknown> {
  return event as unknown as Record<string, unknown>;
}

/** Id of the event a change is about */
export function getChangedEventId(change: EventHistoryChange): string {
  return (change.after ?? change.before)?.id ?? "";
}

/**
 * The events after `changes`, in order: an event with a `before` and an
 * `after` is replaced in place, one with only an `after` is inserted at
 * `index` (or last), and one with only a `before` is removed. Other events
 * keep their objects and their order.
 */
export function applyEventChanges<TEvent extends CalendarEvent>(
  events: TEvent[],
  changes: EventHistoryChange<TEvent>[],
): TEvent[] {
  let next = events;
  for (const change of changes) {
    const id = getChangedEventId(change);
    const { before, after } = change;
    if (!after) {
      next = next.filter((event) => event.id !== id);
      continue;
    }
    if (before) {
      next = next.map((event) => (event.id === id ? after : event));
      continue;
    }
    const index = Math.min(Math.max(change.index, 0), next.length);
    next = [...next.slice(0, index), after, ...next.slice(index)];
  }
  return next;
}

/** The changes that undo `changes`: each one reversed, the last first */
export function invertEventChanges<TEvent extends CalendarEvent>(
  changes: EventHistoryChange<TEvent>[],
): EventHistoryChange<TEvent>[] {
  return changes
    .map((change) => ({
      before: change.after,
      after: change.before,
      index: change.index,
    }))
    .reverse();
}

/**
 * Whether `changes` still apply to `events`: each changed event is still
 * the very object the changes start from (`before`), or still absent when
 * they add it. False once the app replaced, removed or re-added one of them
 * from outside, by reloading its events for example, so an undo never
 * overwrites that. Each change must be about a different event.
 */
export function canApplyEventChanges<TEvent extends CalendarEvent>(
  events: TEvent[],
  changes: EventHistoryChange<TEvent>[],
): boolean {
  return changes.every((change) => {
    const id = getChangedEventId(change);
    const current = events.find((event) => event.id === id);
    if (!change.before) return current === undefined;
    return current === change.before;
  });
}

/**
 * Whether two events hold the same values: the same fields, each the same
 * value, or for dates the same time. Shallow: a list or object field must
 * be the same object.
 */
export function isSameEventValue(a: CalendarEvent, b: CalendarEvent): boolean {
  const fieldsA = getFields(a);
  const fieldsB = getFields(b);
  const keys = Object.keys(fieldsA);
  if (keys.length !== Object.keys(fieldsB).length) return false;
  return keys.every((key) => {
    const valueA = fieldsA[key];
    const valueB = fieldsB[key];
    if (valueA instanceof Date && valueB instanceof Date) {
      return valueA.getTime() === valueB.getTime();
    }
    return Object.is(valueA, valueB);
  });
}

/**
 * The history after a new step. The step goes on top, unless it is an edit
 * to the event the top step just edited, less than `EVENT_HISTORY_MERGE_MS`
 * later: then the two are one step, from the event's first value to its
 * last, and that step is dropped when it ends where it began. An edit that
 * changes no value is left out and changes nothing. Otherwise the redo
 * steps are cleared and at most `EVENT_HISTORY_LIMIT` steps are kept.
 */
export function recordEventHistory<TEvent extends CalendarEvent>(
  history: EventHistory<TEvent>,
  entry: EventHistoryEntry<TEvent>,
): EventHistory<TEvent> {
  const edit = getEdit(entry);
  if (edit && isSameEventValue(edit.before, edit.after)) return history;

  const top = history.past[history.past.length - 1];
  const topEdit = top ? getEdit(top) : null;
  if (
    !edit ||
    !top ||
    !topEdit ||
    topEdit.after !== edit.before ||
    entry.time - top.time >= EVENT_HISTORY_MERGE_MS
  ) {
    return {
      past: [...history.past, entry].slice(-EVENT_HISTORY_LIMIT),
      future: [],
    };
  }

  // Quick edits to one event: one step from its first value to its last
  const rest = history.past.slice(0, -1);
  if (isSameEventValue(topEdit.before, edit.after)) {
    return { past: rest, future: [] };
  }
  const merged: EventHistoryEntry<TEvent> = {
    action: "edit",
    changes: [
      { before: topEdit.before, after: edit.after, index: topEdit.index },
    ],
    time: entry.time,
  };
  return { past: [...rest, merged], future: [] };
}

/**
 * Where a paste goes: the spot a view last had the mouse over (`target`)
 * while it is on screen, else today when it is on screen, else the first
 * day on screen (`currentDate`), both at the copied event's own time of day
 */
export function resolvePasteTarget(
  target: EventPasteTarget | null,
  visibleRange: VisibleRange,
  now: Date,
  currentDate: Date,
): EventPasteTarget {
  const isOnScreen = (date: Date) =>
    date >= visibleRange.start && date < visibleRange.end;
  if (target && isOnScreen(target.date)) return target;
  if (isOnScreen(now)) return { date: startOfDay(now), hasTime: false };
  return { date: startOfDay(currentDate), hasTime: false };
}

/**
 * Start and end of a pasted copy of `source`. At a time slot a timed event
 * starts there and keeps its length. On a day, and for an all-day event
 * wherever it goes, the event moves by whole days: it keeps its times of
 * day by the clock, and an all-day event keeps its number of days.
 */
export function getPastedEventTimes(
  source: CalendarEvent,
  target: EventPasteTarget,
): { start: Date; end: Date } {
  if (target.hasTime && !source.isAllDay) {
    const length = source.end.getTime() - source.start.getTime();
    return {
      start: target.date,
      end: new Date(target.date.getTime() + length),
    };
  }
  const days = differenceInCalendarDays(target.date, source.start);
  return { start: addDays(source.start, days), end: addDays(source.end, days) };
}

/** What to announce after an action on an event: "Deleted Team sync" */
export function describeEventAction(
  action: EventHistoryAction | "copy",
  event: CalendarEvent,
): string {
  return `${ACTION_ANNOUNCEMENTS[action]} ${getSpokenTitle(event)}`;
}

/** What to announce after undo or redo: "Undid deleting Team sync" */
export function describeHistoryStep(
  entry: EventHistoryEntry,
  direction: "undo" | "redo",
): string {
  const verb = direction === "undo" ? "Undid" : "Redid";
  const [change] = entry.changes;
  const event = change ? (change.after ?? change.before) : null;
  if (!event) return verb;
  return `${verb} ${ACTION_NAMES[entry.action]} ${getSpokenTitle(event)}`;
}
