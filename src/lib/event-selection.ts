import { addDays, differenceInCalendarDays } from "date-fns";

import { getChangedEventId, getPastedEventTimes } from "@/lib/event-history";
import { expandRecurringEvents, getOccurrenceRemoval } from "@/lib/recurrence";
import type {
  CalendarEvent,
  CalendarNoticeInput,
  EventHistoryChange,
  EventPasteTarget,
  VisibleRange,
} from "@/components/calendar-types";

/** Actions that act on several selected events at once */
export type SelectionAction =
  | "delete"
  | "cut"
  | "copy"
  | "duplicate"
  | "paste"
  | "move";

/** Notion Calendar's toast for an action on several events */
const GROUP_NOTICES: Record<"delete" | "cut" | "copy", string> = {
  delete: "events deleted",
  cut: "events cut",
  copy: "events copied to clipboard",
};

/** What the live region reads after an action on several events */
const GROUP_ANNOUNCEMENTS: Record<SelectionAction, string> = {
  delete: "Deleted",
  cut: "Cut",
  copy: "Copied",
  duplicate: "Duplicated",
  paste: "Pasted",
  move: "Moved",
};

/**
 * The selection after an event is Shift- or Cmd-clicked: it joins the
 * selected events, or leaves them when it was already one of them.
 */
export function toggleSelectedEventId(
  selectedIds: string[],
  eventId: string,
): string[] {
  if (selectedIds.includes(eventId)) {
    return selectedIds.filter((id) => id !== eventId);
  }
  return [...selectedIds, eventId];
}

/**
 * Ids of the events "Select all visible" selects: every event, and every
 * date of a repeating one, that overlaps the dates on screen, in order of
 * start. Notion Calendar's takes the hours scrolled out of view too.
 */
export function getVisibleEventIds(
  events: CalendarEvent[],
  range: VisibleRange,
): string[] {
  return expandRecurringEvents(events, range)
    .filter((event) => event.start < range.end && event.end > range.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((event) => event.id);
}

/**
 * What deleting or cutting `event` changes in `events`: the event goes, or
 * for one date of a repeating series, the date is excluded from the series
 * and its stored event, when it has one, goes with it (ADR-007). The
 * series' own event stands for the series and goes as any event.
 */
export function getEventRemovalChanges<TEvent extends CalendarEvent>(
  events: TEvent[],
  event: TEvent,
): EventHistoryChange<TEvent>[] {
  const index = events.findIndex((other) => other.id === event.id);
  const removal = getOccurrenceRemoval(events, event);
  if (!removal) return [{ before: event, after: null, index }];
  const seriesChange: EventHistoryChange<TEvent> = {
    before: removal.series,
    after: removal.excluded,
    index: events.indexOf(removal.series),
  };
  if (!removal.removed) return [seriesChange];
  return [{ before: removal.removed, after: null, index }, seriesChange];
}

/**
 * One change per event: changes that touch the same event one after the
 * other (a series that loses two of its dates) become one, from its first
 * `before` to its last `after`, at its first place. Undo needs each change
 * to be about a different event.
 */
export function mergeEventChanges<TEvent extends CalendarEvent>(
  changes: EventHistoryChange<TEvent>[],
): EventHistoryChange<TEvent>[] {
  const merged: EventHistoryChange<TEvent>[] = [];
  const positionById = new Map<string, number>();
  for (const change of changes) {
    const id = getChangedEventId(change);
    const position = positionById.get(id);
    if (position === undefined) {
      positionById.set(id, merged.length);
      merged.push({ ...change });
      continue;
    }
    merged[position] = { ...merged[position], after: change.after };
  }
  // An event added and removed again by the same action leaves no change
  return merged.filter((change) => change.before || change.after);
}

/**
 * Start and end of each pasted copy of several events. The earliest one
 * goes where a single paste would (`getPastedEventTimes`), and the others
 * keep their distance from it: by the minute when it lands on a time slot,
 * by whole days otherwise. All-day events always move by whole days.
 */
export function getPastedGroupTimes(
  sources: CalendarEvent[],
  target: EventPasteTarget,
): { start: Date; end: Date }[] {
  if (sources.length === 0) return [];
  const anchor = sources.reduce((first, event) =>
    event.start < first.start ? event : first,
  );
  const anchorTimes = getPastedEventTimes(anchor, target);
  const shiftMs = anchorTimes.start.getTime() - anchor.start.getTime();
  const shiftDays = differenceInCalendarDays(anchorTimes.start, anchor.start);
  const byMinute = target.hasTime && !anchor.isAllDay;

  return sources.map((event) => {
    if (byMinute && !event.isAllDay) {
      return {
        start: new Date(event.start.getTime() + shiftMs),
        end: new Date(event.end.getTime() + shiftMs),
      };
    }
    return {
      start: addDays(event.start, shiftDays),
      end: addDays(event.end, shiftDays),
    };
  });
}

/**
 * Whether an edit only moves the event: its start changed, and its length
 * and all-day state didn't. Moving one of several selected events moves
 * them all; resizing it changes it alone.
 */
export function isEventMove(
  previous: CalendarEvent,
  next: CalendarEvent,
): boolean {
  if (Boolean(previous.isAllDay) !== Boolean(next.isAllDay)) return false;
  if (previous.start.getTime() === next.start.getTime()) return false;
  const previousLength = previous.end.getTime() - previous.start.getTime();
  return next.end.getTime() - next.start.getTime() === previousLength;
}

/**
 * Start and end of another selected event when one of them (`previous`)
 * was moved to `next`: timed events move by the same minutes, unless the
 * moved one is all-day; all-day events move by the same number of days.
 */
export function getGroupMoveTimes(
  event: CalendarEvent,
  previous: CalendarEvent,
  next: CalendarEvent,
): { start: Date; end: Date } {
  const shiftDays = differenceInCalendarDays(next.start, previous.start);
  if (event.isAllDay || previous.isAllDay) {
    return {
      start: addDays(event.start, shiftDays),
      end: addDays(event.end, shiftDays),
    };
  }
  const shiftMs = next.start.getTime() - previous.start.getTime();
  return {
    start: new Date(event.start.getTime() + shiftMs),
    end: new Date(event.end.getTime() + shiftMs),
  };
}

/**
 * Notion Calendar's toast after an action on several events: "3 events
 * deleted" and "3 events cut" (with Undo), "3 events copied to clipboard".
 * No title line.
 */
export function describeGroupNotice(
  action: "delete" | "cut" | "copy",
  count: number,
): CalendarNoticeInput {
  return { message: `${count} ${GROUP_NOTICES[action]}` };
}

/** What to announce after an action on several events: "Deleted 3 events" */
export function describeGroupAction(
  action: SelectionAction,
  count: number,
): string {
  return `${GROUP_ANNOUNCEMENTS[action]} ${count} events`;
}
