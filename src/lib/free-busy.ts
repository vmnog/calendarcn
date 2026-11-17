import { addDays, startOfDay } from "date-fns";

import type {
  DetailedCalendarEvent,
  TimeSpan,
  VisibleRange,
  WorkingHours,
} from "@/components/calendar-types";
import { expandRecurringEvents } from "@/lib/recurrence";

/**
 * Hours the free times everyone shares are looked for in when the provider's
 * `workingHours` is not set: 9 AM to 5 PM, Monday to Friday
 */
export const DEFAULT_WORKING_HOURS: WorkingHours = {
  days: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 17,
};

/** Shortest stretch of shared free time worth highlighting, in minutes */
export const MIN_FREE_MINUTES = 30;

/** Whether the event's own calendar owner (`calendarEmail`) declined it */
function isDeclinedByOwner(event: DetailedCalendarEvent): boolean {
  const owner = event.calendarEmail?.toLowerCase();
  if (!owner) return false;
  return (
    event.participants?.some(
      (participant) =>
        participant.email.toLowerCase() === owner &&
        participant.response === "declined",
    ) ?? false
  );
}

/**
 * Whether an event makes the owner of its calendar busy. Events marked
 * `status: "free"`, events the owner declined and birthdays never do.
 * All-day events don't unless marked `status: "busy"`, as Google Calendar
 * shows them as free by default; every other timed event does.
 */
export function isBusyEvent(event: DetailedCalendarEvent): boolean {
  if (event.status === "free") return false;
  if (event.kind === "birthday") return false;
  if (isDeclinedByOwner(event)) return false;
  if (event.isAllDay) return event.status === "busy";
  return true;
}

/**
 * Sorts spans by start and joins the ones that overlap or touch, so the
 * result has no two spans sharing a moment. Empty spans are dropped.
 */
export function mergeTimeSpans(spans: TimeSpan[]): TimeSpan[] {
  const sorted = spans
    .filter((span) => span.end > span.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: TimeSpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      if (span.end > last.end) last.end = new Date(span.end);
      continue;
    }
    merged.push({ start: new Date(span.start), end: new Date(span.end) });
  }
  return merged;
}

/**
 * When one calendar's events keep its owner busy inside `range`: repeating
 * events on each of their dates, clipped to the range and merged. An event
 * counts as busy by `isBusyEvent`.
 */
export function getBusyTimes(
  events: DetailedCalendarEvent[],
  range: VisibleRange,
): TimeSpan[] {
  const spans: TimeSpan[] = [];
  for (const event of expandRecurringEvents(events, range)) {
    if (!isBusyEvent(event)) continue;
    if (event.end <= range.start || event.start >= range.end) continue;
    spans.push({
      start: event.start < range.start ? range.start : event.start,
      end: event.end > range.end ? range.end : event.end,
    });
  }
  return mergeTimeSpans(spans);
}

/**
 * The working hours of each given day, in the viewer's time zone: a day
 * outside `workingHours.days` has none. `endHour` 24 ends at the next
 * midnight.
 */
export function getWorkingTimes(
  days: Date[],
  workingHours: WorkingHours = DEFAULT_WORKING_HOURS,
): TimeSpan[] {
  const { startHour, endHour } = workingHours;
  if (endHour <= startHour) return [];
  return days
    .filter((day) =>
      workingHours.days.some((weekday) => weekday === day.getDay()),
    )
    .map((day) => {
      const midnight = startOfDay(day);
      return {
        start: new Date(
          midnight.getFullYear(),
          midnight.getMonth(),
          midnight.getDate(),
          startHour,
        ),
        end: new Date(
          midnight.getFullYear(),
          midnight.getMonth(),
          midnight.getDate(),
          endHour,
        ),
      };
    });
}

/** Options of `getSharedFreeTime` */
interface SharedFreeTimeOptions {
  /** Days and hours to look in. Defaults to `DEFAULT_WORKING_HOURS` */
  workingHours?: WorkingHours;
  /** Shortest free stretch kept, in minutes. Defaults to `MIN_FREE_MINUTES` */
  minMinutes?: number;
}

/**
 * The times on `days` when nobody is busy: inside working hours, outside
 * every calendar's busy times (`getBusyTimes`), and at least `minMinutes`
 * long. Each calendar is one person's events; pass yours and those of the
 * people you're meeting with. Times are instants, so events written in other
 * time zones block the moments they cover; the working hours are the
 * viewer's.
 */
export function getSharedFreeTime(
  calendars: DetailedCalendarEvent[][],
  days: Date[],
  {
    workingHours = DEFAULT_WORKING_HOURS,
    minMinutes = MIN_FREE_MINUTES,
  }: SharedFreeTimeOptions = {},
): TimeSpan[] {
  const working = getWorkingTimes(days, workingHours);
  if (working.length === 0) return [];
  const range: VisibleRange = {
    start: startOfDay(days.reduce((a, b) => (a < b ? a : b))),
    end: addDays(startOfDay(days.reduce((a, b) => (a > b ? a : b))), 1),
  };
  const busy = mergeTimeSpans(
    calendars.flatMap((events) => getBusyTimes(events, range)),
  );
  const minMs = minMinutes * 60_000;

  const free: TimeSpan[] = [];
  for (const span of working) {
    let cursor = span.start;
    for (const block of busy) {
      if (block.end <= cursor) continue;
      if (block.start >= span.end) break;
      if (block.start > cursor) free.push({ start: cursor, end: block.start });
      cursor = block.end > cursor ? block.end : cursor;
      if (cursor >= span.end) break;
    }
    if (cursor < span.end) free.push({ start: cursor, end: span.end });
  }
  return free.filter(
    (slot) => slot.end.getTime() - slot.start.getTime() >= minMs,
  );
}
