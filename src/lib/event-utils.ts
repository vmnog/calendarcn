import {
  addMinutes,
  isSameDay,
  startOfDay,
  addDays,
  differenceInMinutes,
  isWithinInterval,
  areIntervalsOverlapping,
  startOfMonth,
  endOfDay,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  eachDayOfInterval,
  getWeek,
  format,
  isToday,
  isWeekend,
  parse,
  differenceInCalendarDays,
  addYears,
  startOfYear,
} from "date-fns";
import type { Locale } from "date-fns";
import type {
  AgendaDay,
  AgendaEntry,
  CalendarConfig,
  CalendarEvent,
  CalendarGroup,
  CalendarInfo,
  DetailedCalendarEvent,
  EventChangeSummaryRow,
  EventColor,
  EventParticipant,
  EventReminder,
  HourCycle,
  PositionedEvent,
  ViewType,
  VisibleRange,
  WeekDay,
  WeekStartsOn,
} from "@/components/week-view-types";
import {
  describeRecurrenceRule,
  getEventRecurrenceRule,
} from "@/lib/recurrence";
import { getTimeZoneRowLabel, isKnownTimeZone } from "@/lib/time-zones";

/** Every event color, in the order the color pickers list them */
export const EVENT_COLORS: readonly EventColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

/**
 * Picks a random event color. When `previous` is given it is excluded, so
 * two picks in a row always differ (each click-created event looks new).
 */
export function pickRandomEventColor(
  previous: EventColor | null = null,
): EventColor {
  const choices = EVENT_COLORS.filter((color) => color !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}

/** Color of an event that sets none and whose calendar isn't listed */
export const DEFAULT_EVENT_COLOR: EventColor = "blue";

/**
 * The color an event is drawn in: its own `color`, else the color of the
 * calendar its `calendarId` names, else blue
 */
export function resolveEventColor(
  event: Pick<DetailedCalendarEvent, "color" | "calendarId">,
  calendars: readonly CalendarInfo[],
): EventColor {
  if (event.color) return event.color;
  const calendar = calendars.find((c) => c.id === event.calendarId);
  return calendar?.color ?? DEFAULT_EVENT_COLOR;
}

/** Duration in minutes of an event created by clicking an empty time slot */
export const NEW_EVENT_DURATION_MINUTES = 60;

/** Minutes in a full day: the bottom edge of the time grid, on the clock */
const MINUTES_PER_DAY = 24 * 60;

/** Days in a week: the week view's default column count and prev/next step */
const DAYS_PER_WEEK = 7;

/** Monday to Friday: the columns a full week shows with weekends hidden */
export const WEEKDAYS_PER_WEEK = 5;

/** Days the agenda lists, from its first day; also its prev/next step */
export const AGENDA_DAYS = 30;

/** Day counts the week view offers: the view switcher's and the command menu's choices */
export const NUMBER_OF_DAYS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Hour heights in pixels that zooming the day and week views steps through,
 * from the most hours on screen to the fewest
 */
export const HOUR_HEIGHT_STEPS = [24, 32, 40, 48, 64, 80, 96, 128, 160];

/** Pixels two hour heights may differ by and still count as the same step */
const HOUR_HEIGHT_TOLERANCE = 0.5;

/**
 * The hour height one zoom step from `current`: the next of
 * `HOUR_HEIGHT_STEPS` above it (`"in"`, taller hours) or below it (`"out"`).
 * A height between two steps goes to the nearer one in that direction, and
 * the smallest and largest steps are the limits.
 */
export function getZoomedHourHeight(
  current: number,
  direction: "in" | "out",
): number {
  if (direction === "in") {
    const taller = HOUR_HEIGHT_STEPS.find(
      (step) => step > current + HOUR_HEIGHT_TOLERANCE,
    );
    return taller ?? HOUR_HEIGHT_STEPS[HOUR_HEIGHT_STEPS.length - 1];
  }
  // Not `findLast`: installed projects may not have ES2023's lib
  const shorter = HOUR_HEIGHT_STEPS.filter(
    (step) => step < current - HOUR_HEIGHT_TOLERANCE,
  );
  return shorter[shorter.length - 1] ?? HOUR_HEIGHT_STEPS[0];
}

/**
 * Format of a month cell's `data-date` attribute. A calendar date with no
 * time or offset, so it reads the same in every timezone and server-rendered
 * markup matches the client's.
 */
const CELL_DATE_FORMAT = "yyyy-MM-dd";

/** Formats a day as a month cell's `data-date` value ("2026-10-01"). */
export function formatCellDate(date: Date): string {
  return format(date, CELL_DATE_FORMAT);
}

/** Parses a month cell's `data-date` value into local midnight of that day. */
export function parseCellDate(value: string): Date {
  return parse(value, CELL_DATE_FORMAT, new Date());
}

/** Rounds a minute offset to the nearest `snapMinutes` increment. */
export function snapToGrid(minutes: number, snapMinutes: number): number {
  return Math.round(minutes / snapMinutes) * snapMinutes;
}

/**
 * Where `date` falls on `day`'s clock, in minutes since midnight: 0 when it
 * is before that day, 1440 when it is after. On a day the clocks change this
 * is not the minutes elapsed since midnight. The hour labels, drag and resize
 * all go by the clock.
 */
function getMinutesOnDay(date: Date, day: Date): number {
  const days = differenceInCalendarDays(date, day);
  if (days < 0) return 0;
  if (days > 0) return MINUTES_PER_DAY;
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * The time `minutes` after midnight on `day`, by the clock: 540 is 9:00 AM
 * even on a day the clocks change, and 1440 is the next midnight. A time the
 * clocks skip lands an hour later.
 */
function atMinutesOfDay(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes);
}

/**
 * Returns the start/end of a new event created by clicking a day column at
 * `minutesFromMidnight`. The start snaps down to the `snapMinutes` slot that
 * contains the click, so the new event always covers the clicked point.
 * Near the end of the visible hours the start is clamped to the last full
 * event length, and near midnight the end is capped at the end of the day,
 * so the new event's end stays on the day that was clicked.
 */
export function getNewEventRange(
  day: Date,
  minutesFromMidnight: number,
  {
    snapMinutes,
    dayStartHour,
    dayEndHour,
  }: Pick<CalendarConfig, "snapMinutes" | "dayStartHour" | "dayEndHour">,
): { start: Date; end: Date } {
  const slotStart = Math.floor(minutesFromMidnight / snapMinutes) * snapMinutes;
  const startMinutes = Math.max(
    dayStartHour * 60,
    Math.min(slotStart, dayEndHour * 60 - NEW_EVENT_DURATION_MINUTES),
  );
  const start = atMinutesOfDay(day, startMinutes);
  const clockEnd = atMinutesOfDay(
    day,
    startMinutes + NEW_EVENT_DURATION_MINUTES,
  );
  // Inside the hour the clocks skip, both land on the same time
  const end =
    clockEnd > start ? clockEnd : addMinutes(start, NEW_EVENT_DURATION_MINUTES);
  if (isSameDay(start, end)) return { start, end };
  return { start, end: endOfDay(start) };
}

/**
 * The day an event created from the keyboard (C, or "Create event...") goes
 * on, as in Notion Calendar: the day Go to date just highlighted, else today,
 * when on screen (`range`, end exclusive), else `firstDay`
 */
export function getNextSlotDay({
  range,
  today,
  highlightedDate,
  firstDay,
}: {
  range: VisibleRange;
  today: Date;
  highlightedDate: Date | null;
  firstDay: Date;
}): Date {
  const isOnScreen = (day: Date) => day >= range.start && day < range.end;
  if (highlightedDate && isOnScreen(highlightedDate)) return highlightedDate;
  if (isOnScreen(today)) return today;
  return firstDay;
}

/** Minutes the C key's new event rounds the time of day up to: the next half hour, as in Notion Calendar */
export const NEXT_SLOT_MINUTES = 30;

/**
 * Returns the start/end of an event created from the keyboard (C, or
 * "Create event..."): on `day`, at `now`'s time of day rounded up to the
 * next half hour, an hour long, kept inside the visible hours and the day
 * like a clicked slot (`getNewEventRange`)
 */
export function getNextSlotEventRange(
  day: Date,
  now: Date,
  config: Pick<CalendarConfig, "snapMinutes" | "dayStartHour" | "dayEndHour">,
): { start: Date; end: Date } {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const nextSlot = Math.ceil(minutes / NEXT_SLOT_MINUTES) * NEXT_SLOT_MINUTES;
  return getNewEventRange(day, nextSlot, config);
}

/**
 * Returns true when a timed event reaches into a day after the one it starts
 * on. An end at midnight is the end of the day before: 11 PM to 12 AM is one
 * day.
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  if (event.isAllDay) {
    return false;
  }
  const { first, last } = getEventDayRange(event);
  return first.getTime() !== last.getTime();
}

/**
 * Filters events for a specific day (excluding all-day and multi-day events)
 */
export function getEventsForDay(
  events: CalendarEvent[],
  day: WeekDay,
): CalendarEvent[] {
  const dayStart = startOfDay(day.date);
  const dayEnd = addDays(dayStart, 1);

  return events.filter((event) => {
    if (event.isAllDay || isMultiDayEvent(event)) {
      return false;
    }
    // Event spans this day if it starts before day end AND ends after day start
    return event.start < dayEnd && event.end > dayStart;
  });
}

/**
 * Gets all-day events that span a specific day
 */
export function getAllDayEventsForDay(
  events: CalendarEvent[],
  day: WeekDay,
): CalendarEvent[] {
  return events.filter((event) => {
    if (!event.isAllDay) {
      return false;
    }
    const dayStart = startOfDay(day.date);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    return (
      isWithinInterval(dayStart, { start: event.start, end: event.end }) ||
      isSameDay(event.start, day.date) ||
      isSameDay(event.end, day.date)
    );
  });
}

/**
 * Checks if two events overlap in time
 */
function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  return areIntervalsOverlapping(
    { start: a.start, end: a.end },
    { start: b.start, end: b.end },
  );
}

/**
 * Groups overlapping events into columns
 */
function assignColumns(
  events: CalendarEvent[],
): Map<string, { column: number; totalColumns: number }> {
  const columnAssignments = new Map<
    string,
    { column: number; totalColumns: number }
  >();

  if (events.length === 0) {
    return columnAssignments;
  }

  // Sort events by start time, then by duration (longer first)
  const sortedEvents = [...events].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) {
      return startDiff;
    }
    // Longer events first
    const durationA = a.end.getTime() - a.start.getTime();
    const durationB = b.end.getTime() - b.start.getTime();
    return durationB - durationA;
  });

  // Find groups of overlapping events
  const groups: CalendarEvent[][] = [];
  const processed = new Set<string>();

  for (const event of sortedEvents) {
    if (processed.has(event.id)) {
      continue;
    }

    const group: CalendarEvent[] = [event];
    processed.add(event.id);

    // Find all events that overlap with any event in the group
    let foundNew = true;
    while (foundNew) {
      foundNew = false;
      for (const otherEvent of sortedEvents) {
        if (processed.has(otherEvent.id)) {
          continue;
        }
        const overlapsWithGroup = group.some((groupEvent) =>
          eventsOverlap(groupEvent, otherEvent),
        );
        if (!overlapsWithGroup) {
          continue;
        }
        group.push(otherEvent);
        processed.add(otherEvent.id);
        foundNew = true;
      }
    }

    groups.push(group);
  }

  // Assign columns within each group
  for (const group of groups) {
    const columns: CalendarEvent[][] = [];

    // Sort group by start time
    group.sort((a, b) => a.start.getTime() - b.start.getTime());

    for (const event of group) {
      // Find the first column where this event doesn't overlap with existing events
      let placed = false;
      for (let colIndex = 0; colIndex < columns.length; colIndex++) {
        const column = columns[colIndex];
        const overlapsWithColumn = column.some((colEvent) =>
          eventsOverlap(colEvent, event),
        );
        if (overlapsWithColumn) {
          continue;
        }
        column.push(event);
        columnAssignments.set(event.id, { column: colIndex, totalColumns: 0 });
        placed = true;
        break;
      }

      if (placed) {
        continue;
      }

      // Create new column
      columns.push([event]);
      columnAssignments.set(event.id, {
        column: columns.length - 1,
        totalColumns: 0,
      });
    }

    // Update total columns for all events in group
    const totalColumns = columns.length;
    for (const event of group) {
      const assignment = columnAssignments.get(event.id);
      if (!assignment) {
        continue;
      }
      assignment.totalColumns = totalColumns;
    }
  }

  return columnAssignments;
}

/**
 * Calculates positioned events for rendering in the grid. `top` and
 * `height` are percentages of the visible hours (`dayStartHour` to
 * `dayEndHour`): events reaching past them are clipped to the edges, and
 * events entirely outside them are left out.
 * @param rightGapPercent - right gap in percentage. Defaults to 8.
 *   Pass 0 for day view so events fill the full column width.
 */
export function calculatePositionedEvents(
  events: CalendarEvent[],
  day: WeekDay,
  {
    dayStartHour,
    dayEndHour,
  }: Pick<CalendarConfig, "dayStartHour" | "dayEndHour">,
  rightGapPercent = 8,
): PositionedEvent[] {
  const dayStart = startOfDay(day.date);
  const nextDayMidnight = addDays(dayStart, 1);
  const visibleStartMinutes = dayStartHour * 60;
  const visibleEndMinutes = dayEndHour * 60;
  const visibleMinutes = visibleEndMinutes - visibleStartMinutes;
  const visibleStart = atMinutesOfDay(dayStart, visibleStartMinutes);
  const visibleEnd = atMinutesOfDay(dayStart, visibleEndMinutes);

  const dayEvents = getEventsForDay(events, day).filter(
    (event) => event.start < visibleEnd && event.end > visibleStart,
  );

  if (dayEvents.length === 0) {
    return [];
  }

  const columnAssignments = assignColumns(dayEvents);

  return dayEvents.map((event) => {
    const assignment = columnAssignments.get(event.id) ?? {
      column: 0,
      totalColumns: 1,
    };

    // Clock times of the start and end on this day, clamped to the visible hours
    const startMinutes = Math.max(
      getMinutesOnDay(event.start, dayStart),
      visibleStartMinutes,
    );
    const endMinutes = Math.min(
      getMinutesOnDay(event.end, dayStart),
      visibleEndMinutes,
    );

    // Calculate top position (percentage from the first visible hour)
    const top = ((startMinutes - visibleStartMinutes) / visibleMinutes) * 100;

    // Calculate height (percentage of the visible hours). Inside the hour the
    // clocks repeat, an event can end before it starts on the clock.
    const height =
      (Math.max(endMinutes - startMinutes, 0) / visibleMinutes) * 100;

    // Determine segment position for multi-day events
    const startsOnDay = isSameDay(event.start, dayStart);
    const endsOnDay = event.end <= nextDayMidnight;
    let segmentPosition: "start" | "middle" | "end" | "full" = "full";
    if (startsOnDay && !endsOnDay) {
      segmentPosition = "start";
    } else if (!startsOnDay && endsOnDay) {
      segmentPosition = "end";
    } else if (!startsOnDay && !endsOnDay) {
      segmentPosition = "middle";
    }

    // Calculate left and width based on column assignment
    // Events cascade with overlap - leftmost event has no gap, rightmost has gap
    const rightGap = rightGapPercent;
    const overlapAmount = 8; // percentage overlap between adjacent events
    const { column, totalColumns } = assignment;

    let left: number;
    let width: number;

    if (totalColumns === 1) {
      // Single event: full width with right gap
      left = 0;
      width = 100 - rightGap;
    } else {
      // Multiple overlapping events
      // Formula: n * eventWidth - (n-1) * overlap = availableWidth
      // So: eventWidth = (availableWidth + (n-1) * overlap) / n
      const eventWidth =
        (100 - rightGap + overlapAmount * (totalColumns - 1)) / totalColumns;

      left = column * (eventWidth - overlapAmount);

      if (column === totalColumns - 1) {
        // Last event: fill to end (has the right gap)
        width = 100 - rightGap - left;
      } else {
        // Other events extend under the next one (no gap)
        width = eventWidth;
      }
    }

    return {
      event,
      top,
      height,
      left,
      width,
      column: assignment.column,
      totalColumns: assignment.totalColumns,
      segmentPosition,
    };
  });
}

/**
 * Groups all-day events by their visual row (for stacking)
 */
export interface AllDayEventRow {
  event: CalendarEvent;
  startColumn: number;
  endColumn: number;
  row: number;
}

export function calculateAllDayEventRows(
  events: CalendarEvent[],
  days: WeekDay[],
): AllDayEventRow[] {
  const allDayEvents = events.filter((e) => e.isAllDay || isMultiDayEvent(e));

  if (allDayEvents.length === 0) {
    return [];
  }

  // Sort by start date, then by duration (longer first)
  const sortedEvents = [...allDayEvents].sort((a, b) => {
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) {
      return startDiff;
    }
    const durationA = a.end.getTime() - a.start.getTime();
    const durationB = b.end.getTime() - b.start.getTime();
    return durationB - durationA;
  });

  const rows: AllDayEventRow[] = [];
  const occupiedRows: Map<number, { start: number; end: number }[]> = new Map();

  for (const event of sortedEvents) {
    // Find start and end columns
    let startColumn = -1;
    let endColumn = -1;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const dayStart = startOfDay(day.date);

      if (
        isSameDay(event.start, day.date) ||
        (event.start <= dayStart && event.end >= dayStart)
      ) {
        if (startColumn === -1) {
          startColumn = i;
        }
        endColumn = i;
      }
    }

    if (startColumn === -1) {
      continue;
    }

    // Find the first row where this event fits
    let targetRow = 0;
    let foundRow = false;

    while (!foundRow) {
      const rowOccupied = occupiedRows.get(targetRow) ?? [];
      const hasConflict = rowOccupied.some(
        (occupied) =>
          !(endColumn < occupied.start || startColumn > occupied.end),
      );

      if (!hasConflict) {
        foundRow = true;
        break;
      }

      targetRow++;
    }

    // Mark the row as occupied
    const rowOccupied = occupiedRows.get(targetRow) ?? [];
    rowOccupied.push({ start: startColumn, end: endColumn });
    occupiedRows.set(targetRow, rowOccupied);

    rows.push({
      event,
      startColumn,
      endColumn,
      row: targetRow,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Month-view utilities
// ---------------------------------------------------------------------------

/** Week rows the month view shows at once */
export const MONTH_VIEW_ROWS = 6;

/** Height of a single event row in the month grid (px): h-5 (20px) + gap-px (1px) */
export const MONTH_EVENT_ROW_HEIGHT = 21;

/** Height consumed by the day number header inside each cell (px) */
const MONTH_DAY_HEADER_HEIGHT = 28;

/** Minimum visible event slots per month cell (just "+N more" at smallest) */
const MIN_MONTH_SLOTS = 1;

/** Maximum visible event slots per month cell (matches Notion Calendar) */
const MAX_MONTH_SLOTS = 6;

/**
 * One week row inside the month grid.
 */
export interface MonthWeekRow {
  weekNumber: number;
  days: WeekDay[];
}

/**
 * A single slot inside a month day cell.
 *
 * - `event-bar`  — a multi-day/all-day event bar that may span multiple columns
 * - `event-item` — a single-day timed event (dot + title)
 * - `more`       — the "+N more" overflow indicator
 * - `spacer`     — an empty placeholder to keep slot indices aligned
 */
export type MonthCellSlot =
  | {
      type: "event-bar";
      event: CalendarEvent;
      colSpan: number;
      isStart: boolean;
      roundedLeft: boolean;
      roundedRight: boolean;
    }
  | { type: "event-item"; event: CalendarEvent }
  | { type: "more"; count: number }
  | { type: "spacer" };

/**
 * Fully resolved layout for a single day cell in the month grid.
 *
 * `barSlots` — spanning (multi-day/all-day) event bars and alignment spacers.
 *              Rendered in a non-clipping container so bars can overflow
 *              horizontally to span adjacent columns.
 * `eventSlots` — timed single-day events and the "+N more" indicator.
 *               Rendered in an overflow-hidden container.
 */
export interface MonthDayCellLayout {
  date: Date;
  barSlots: MonthCellSlot[];
  eventSlots: MonthCellSlot[];
  totalEvents: number;
}

/**
 * Generates the month grid rows for a given date.
 *
 * Returns 4-6 week rows, each containing 7 `WeekDay` objects.
 * The grid always starts on `weekStartsOn` and includes leading/trailing
 * days from adjacent months so every row is complete.
 */
export function generateMonthGrid(
  currentDate: Date,
  weekStartsOn: WeekStartsOn,
  locale: Locale,
): MonthWeekRow[] {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const gridStart = startOfWeek(monthStart, { weekStartsOn });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn });

  const weekStarts = eachWeekOfInterval(
    { start: gridStart, end: gridEnd },
    { weekStartsOn },
  );

  return weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn });
    const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

    const days: WeekDay[] = daysInWeek.map((day) => ({
      date: day,
      dayName: format(day, "EEE", { locale }),
      dayNumber: day.getDate(),
      isToday: isToday(day),
    }));

    return {
      weekNumber: getWeek(weekStart, { weekStartsOn, locale }),
      days,
    };
  });
}

/**
 * Generates `count` consecutive MonthWeekRows starting from the week
 * containing `startDate`. Used as the base grid for the month view
 * so it can scroll row-by-row without anchoring to a calendar month.
 */
export function generateConsecutiveWeeks(
  startDate: Date,
  count: number,
  weekStartsOn: WeekStartsOn,
  locale: Locale,
): MonthWeekRow[] {
  const firstWeekStart = startOfWeek(startDate, { weekStartsOn });
  return Array.from({ length: count }, (_, i) =>
    generateWeekRow(addDays(firstWeekStart, i * 7), weekStartsOn, locale),
  );
}

/**
 * Generates a single MonthWeekRow for the week containing the given date.
 * Used by vertical scroll to extend the buffer one row at a time.
 */
export function generateWeekRow(
  date: Date,
  weekStartsOn: WeekStartsOn,
  locale: Locale,
): MonthWeekRow {
  const weekStart = startOfWeek(date, { weekStartsOn });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn });
  const daysInWeek = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const days: WeekDay[] = daysInWeek.map((day) => ({
    date: day,
    dayName: format(day, "EEE", { locale }),
    dayNumber: day.getDate(),
    isToday: isToday(day),
  }));

  return {
    weekNumber: getWeek(weekStart, { weekStartsOn, locale }),
    days,
  };
}

/**
 * Returns the number of visible event slots for a month cell given its
 * pixel height.
 *
 * Clamped to [`MIN_MONTH_SLOTS`, `MAX_MONTH_SLOTS`].
 */
export function getMonthSlotCount(cellHeight: number): number {
  const usable = cellHeight - MONTH_DAY_HEADER_HEIGHT;
  const raw = Math.floor(usable / MONTH_EVENT_ROW_HEIGHT);
  return Math.max(MIN_MONTH_SLOTS, Math.min(MAX_MONTH_SLOTS, raw));
}

/**
 * Computes the full layout (slot arrays) for every day cell in the month grid.
 *
 * The algorithm processes one week row at a time so that spanning events keep
 * a stable slot index across columns.  Timed (single-day) events fill the
 * remaining slots.  When the total events exceed `maxSlots`, the last slot is
 * replaced with a "+N more" indicator.
 *
 * The returned Map is keyed by `startOfDay(date).toISOString()`.
 */
export function calculateMonthCellLayout(
  weekRows: MonthWeekRow[],
  events: CalendarEvent[],
  maxSlots: number,
): Map<string, MonthDayCellLayout> {
  const result = new Map<string, MonthDayCellLayout>();

  for (const row of weekRows) {
    const rowStart = startOfDay(row.days[0].date);
    const rowEnd = addDays(startOfDay(row.days[row.days.length - 1].date), 1);

    // ---- 1. Identify spanning events (all-day OR multi-day) that overlap this week row ----
    const spanningEvents = events.filter((ev) => {
      if (!ev.isAllDay && !isMultiDayEvent(ev)) {
        return false;
      }
      const evStart = startOfDay(ev.start);
      const evEnd = ev.isAllDay ? addDays(startOfDay(ev.end), 1) : ev.end;
      return evStart < rowEnd && evEnd > rowStart;
    });

    // Sort: longest first, then alphabetically by title
    spanningEvents.sort((a, b) => {
      const durA = a.end.getTime() - a.start.getTime();
      const durB = b.end.getTime() - b.start.getTime();
      if (durB !== durA) {
        return durB - durA;
      }
      return a.title.localeCompare(b.title);
    });

    // ---- 2. Assign stable slot indices for spanning events ----
    // slotAssignments[slotIndex] = array of { event, startCol, endCol }
    const slotAssignments: {
      event: CalendarEvent;
      startCol: number;
      endCol: number;
    }[][] = [];

    for (const ev of spanningEvents) {
      const evStart = startOfDay(ev.start);
      const evEnd = ev.isAllDay ? addDays(startOfDay(ev.end), 1) : ev.end;

      // Determine column range within this week row (0-6)
      let startCol = 0;
      let endCol = 6;

      for (let i = 0; i < row.days.length; i++) {
        const dayStart = startOfDay(row.days[i].date);
        const dayEnd = addDays(dayStart, 1);
        if (evStart < dayEnd && evEnd > dayStart) {
          startCol = i;
          break;
        }
      }
      for (let i = row.days.length - 1; i >= 0; i--) {
        const dayStart = startOfDay(row.days[i].date);
        const dayEnd = addDays(dayStart, 1);
        if (evStart < dayEnd && evEnd > dayStart) {
          endCol = i;
          break;
        }
      }

      // Find the first slot index where no existing assignment overlaps
      let targetSlot = 0;
      let placed = false;
      while (!placed) {
        if (targetSlot >= slotAssignments.length) {
          slotAssignments.push([]);
        }
        const occupied = slotAssignments[targetSlot];
        const hasConflict = occupied.some(
          (o) => !(endCol < o.startCol || startCol > o.endCol),
        );
        if (!hasConflict) {
          occupied.push({ event: ev, startCol, endCol });
          placed = true;
        } else {
          targetSlot++;
        }
      }
    }

    // ---- 3. Collect timed (single-day) events per column ----
    const timedByCol: CalendarEvent[][] = row.days.map(() => []);
    for (const ev of events) {
      if (ev.isAllDay || isMultiDayEvent(ev)) {
        continue;
      }
      for (let col = 0; col < row.days.length; col++) {
        const dayStart = startOfDay(row.days[col].date);
        const dayEnd = addDays(dayStart, 1);
        if (ev.start < dayEnd && ev.end > dayStart) {
          timedByCol[col].push(ev);
        }
      }
    }
    // Sort each column's timed events by start time
    for (const colEvents of timedByCol) {
      colEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
    }

    // ---- 4. Build slots for each day cell ----
    for (let col = 0; col < row.days.length; col++) {
      const day = row.days[col];
      const key = startOfDay(day.date).toISOString();

      const barSlots: MonthCellSlot[] = [];
      const eventSlots: MonthCellSlot[] = [];

      // Count total events touching this cell
      let totalEvents = timedByCol[col].length;
      for (const slotRow of slotAssignments) {
        for (const assignment of slotRow) {
          if (col >= assignment.startCol && col <= assignment.endCol) {
            totalEvents++;
          }
        }
      }

      // Find the highest slot index that has a spanning event covering this column.
      // Only iterate up to that index so days without certain spanning events
      // don't get unnecessary spacer gaps.
      let maxSpanSlotIdx = -1;
      for (let slotIdx = 0; slotIdx < slotAssignments.length; slotIdx++) {
        const hasEvent = slotAssignments[slotIdx].some(
          (a) => col >= a.startCol && col <= a.endCol,
        );
        if (hasEvent) {
          maxSpanSlotIdx = slotIdx;
        }
      }

      // Fill bar slots — start cells get the full colSpan for visual spanning,
      // continuation cells get placeholders to maintain vertical alignment.
      for (let slotIdx = 0; slotIdx <= maxSpanSlotIdx; slotIdx++) {
        const assignment = slotAssignments[slotIdx].find(
          (a) => col >= a.startCol && col <= a.endCol,
        );

        if (!assignment) {
          barSlots.push({ type: "spacer" });
          continue;
        }

        const isStart = col === assignment.startCol;
        const colSpan = assignment.endCol - col + 1;

        const evEnd = assignment.event.isAllDay
          ? addDays(startOfDay(assignment.event.end), 1)
          : assignment.event.end;

        const roundedLeft =
          isStart && (isSameDay(assignment.event.start, day.date) || col === 0);

        // For roundedRight, check the END column of the assignment (not the
        // current col) so spanning bars rendered from the start cell get the
        // correct rounding on their trailing edge.
        const endDay = row.days[assignment.endCol].date;
        const roundedRight =
          evEnd <= addDays(startOfDay(endDay), 1) ||
          assignment.endCol === row.days.length - 1;

        if (isStart) {
          barSlots.push({
            type: "event-bar",
            event: assignment.event,
            colSpan,
            isStart: true,
            roundedLeft,
            roundedRight,
          });
        } else {
          // Continuation — invisible placeholder (bar rendered from start cell)
          barSlots.push({ type: "spacer" });
        }
      }

      // Fill remaining slots with timed events.
      const usedSlots = barSlots.length;
      const remainingSlots = maxSlots - usedSlots;
      const timedEvents = timedByCol[col];

      if (timedEvents.length < remainingSlots) {
        for (const ev of timedEvents) {
          eventSlots.push({ type: "event-item", event: ev });
        }
      } else if (timedEvents.length === 0) {
        // Nothing to render
      } else {
        const availableForTimed = Math.max(0, remainingSlots - 1);
        const timedToShow = timedEvents.slice(0, availableForTimed);
        for (const ev of timedToShow) {
          eventSlots.push({ type: "event-item", event: ev });
        }
        const hiddenCount = timedEvents.length - timedToShow.length;
        if (hiddenCount > 0) {
          eventSlots.push({ type: "more", count: hiddenCount });
        }
      }

      result.set(key, {
        date: day.date,
        barSlots,
        eventSlots,
        totalEvents,
      });
    }
  }

  return result;
}

/**
 * Returns how many days a view shows: one in day view, `numberOfDays` (at
 * least one) in week view, a full week in month view, `AGENDA_DAYS` in the
 * agenda. With weekends hidden, a full week shows its five weekdays, and any
 * other day count that many weekdays, as Notion Calendar does.
 */
export function getVisibleDayCount(
  view: ViewType,
  numberOfDays: number,
  showWeekends = true,
): number {
  if (view === "day") return 1;
  if (view === "month") return DAYS_PER_WEEK;
  if (view === "agenda") return AGENDA_DAYS;
  const count = Math.max(1, Math.round(numberOfDays));
  if (!showWeekends && count === DAYS_PER_WEEK) return WEEKDAYS_PER_WEEK;
  return count;
}

/**
 * Returns `date` when the time grid draws it, else the Monday after it: with
 * weekends hidden, a Saturday or Sunday shows as the next weekday.
 */
export function getFirstShownDay(date: Date, showWeekends: boolean): Date {
  if (showWeekends || !isWeekend(date)) return date;
  return addDays(date, date.getDay() === 6 ? 2 : 1);
}

/**
 * Moves `date` by `amount` days the time grid draws: calendar days, or
 * weekdays while weekends are hidden, counted from the day it shows first
 * (`getFirstShownDay`). Friday plus one is Monday then.
 */
export function addShownDays(
  date: Date,
  amount: number,
  showWeekends: boolean,
): Date {
  if (showWeekends) return addDays(date, amount);
  const step = amount < 0 ? -1 : 1;
  const weeks = Math.trunc(amount / WEEKDAYS_PER_WEEK);
  let day = addDays(getFirstShownDay(date, false), weeks * DAYS_PER_WEEK);
  let remaining = amount - weeks * WEEKDAYS_PER_WEEK;
  while (remaining !== 0) {
    day = addDays(day, step);
    if (!isWeekend(day)) remaining -= step;
  }
  return day;
}

/**
 * How many days the time grid draws from `from` to `to`, negative when `to`
 * comes first: calendar days, or weekdays while weekends are hidden. It
 * undoes `addShownDays`.
 */
export function countShownDaysBetween(
  from: Date,
  to: Date,
  showWeekends: boolean,
): number {
  if (showWeekends) return differenceInCalendarDays(to, from);
  const start = getFirstShownDay(from, false);
  const end = getFirstShownDay(to, false);
  const step = end < start ? -1 : 1;
  const weeks = Math.trunc(
    differenceInCalendarDays(end, start) / DAYS_PER_WEEK,
  );
  let count = weeks * WEEKDAYS_PER_WEEK;
  let day = addDays(start, weeks * DAYS_PER_WEEK);
  while (!isSameDay(day, end)) {
    day = addDays(day, step);
    if (!isWeekend(day)) count += step;
  }
  return count;
}

/**
 * The `count` days the time grid draws from `start` on: consecutive days, or
 * weekdays from the first one on or after `start` while weekends are hidden
 */
export function getShownDays(
  start: Date,
  count: number,
  showWeekends: boolean,
): Date[] {
  const days = [getFirstShownDay(start, showWeekends)];
  while (days.length < count) {
    days.push(addShownDays(days[days.length - 1], 1, showWeekends));
  }
  return days;
}

/**
 * Returns how many days the week view moves per prev/next: its column count
 * when that is shorter than a week, a full week otherwise.
 */
export function getWeekViewStepDays(numberOfDays: number): number {
  return Math.min(getVisibleDayCount("week", numberOfDays), DAYS_PER_WEEK);
}

/**
 * Whether the view starts its period on any day and steps by days: day view,
 * and a week view shorter than a week
 */
export function stepsByDay(view: ViewType, numberOfDays: number): boolean {
  if (view === "day") return true;
  return view === "week" && getWeekViewStepDays(numberOfDays) < DAYS_PER_WEEK;
}

/**
 * Returns the first day of the period that contains `date`: the day itself
 * in day view, the agenda and a week view shorter than a week, the start of
 * its week otherwise, and January 1 in year view. With weekends hidden, day
 * view and a week view shorter than a week start on the next weekday
 * instead of a Saturday or Sunday.
 */
export function getPeriodStart(
  date: Date,
  view: ViewType,
  weekStartsOn: WeekStartsOn,
  numberOfDays: number,
  showWeekends = true,
): Date {
  if (view === "year") return startOfYear(date);
  if (view === "agenda") return startOfDay(date);
  if (stepsByDay(view, numberOfDays)) {
    return getFirstShownDay(startOfDay(date), showWeekends);
  }
  return startOfWeek(date, { weekStartsOn });
}

/**
 * Returns the visible days starting from the given date (used for sidebar
 * highlighting). Day and week view leave the weekend out while it is hidden.
 */
export function getVisibleDays(
  currentDate: Date,
  view: ViewType,
  numberOfDays: number,
  showWeekends = true,
): Date[] {
  const count = getVisibleDayCount(view, numberOfDays, showWeekends);
  if (view === "day" || view === "week") {
    return getShownDays(currentDate, count, showWeekends);
  }
  const end = addDays(currentDate, count - 1);
  return eachDayOfInterval({ start: currentDate, end });
}

/**
 * Returns the dates a view draws, from the first visible day's midnight to
 * the midnight after the last (end exclusive). Day and week views start on
 * `currentDate` and span their columns; with weekends hidden they start on
 * the first weekday and end after their last weekday column. The agenda
 * spans its `AGENDA_DAYS` days, weekends included (it lists none of their
 * events while they are hidden). Month view spans its whole grid,
 * `MONTH_VIEW_ROWS` weeks from the week containing `currentDate`, days of
 * other months included; with weekends hidden, the weekend columns at the
 * grid's edges are left out. Year view spans its year, January 1 to the
 * next January 1.
 */
export function getVisibleRange(
  currentDate: Date,
  view: ViewType,
  numberOfDays: number,
  weekStartsOn: WeekStartsOn,
  showWeekends: boolean,
): VisibleRange {
  if (view === "year") {
    const start = startOfYear(currentDate);
    return { start, end: addYears(start, 1) };
  }
  if (view === "day" || view === "week") {
    const days = getShownDays(
      startOfDay(currentDate),
      getVisibleDayCount(view, numberOfDays, showWeekends),
      showWeekends,
    );
    return { start: days[0], end: addDays(days[days.length - 1], 1) };
  }
  if (view === "agenda") {
    const start = startOfDay(currentDate);
    return { start, end: addDays(start, AGENDA_DAYS) };
  }

  let start = startOfWeek(currentDate, { weekStartsOn });
  let end = addDays(start, MONTH_VIEW_ROWS * DAYS_PER_WEEK);
  if (showWeekends) return { start, end };

  while (isWeekend(start)) start = addDays(start, 1);
  while (isWeekend(addDays(end, -1))) end = addDays(end, -1);
  return { start, end };
}

/**
 * Returns the month name, year, and week number for the visible range.
 *
 * `rangeEnd` is the last visible day, and it is what names the month. A week
 * straddling a month boundary is labeled with the later month — Notion Calendar
 * shows "October 2026" for Sep 27 - Oct 3 — rather than the month of the first
 * day, which would label that week "September". Omitting `rangeEnd` labels
 * `currentDate` alone, which is what month view wants.
 *
 * The week number stays derived from `currentDate` (the week's first day).
 */
export function getCalendarHeaderInfo(
  currentDate: Date,
  weekStartsOn: WeekStartsOn,
  locale: Locale,
  rangeEnd?: Date,
) {
  const labelDate = rangeEnd ?? currentDate;

  return {
    monthName: format(labelDate, "MMMM", { locale }),
    year: format(labelDate, "yyyy", { locale }),
    weekNumber: getWeek(currentDate, { weekStartsOn, locale }),
  };
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

/** First and last day an event covers, at the start of each day */
function getEventDayRange(event: CalendarEvent): { first: Date; last: Date } {
  const first = startOfDay(event.start);
  // All-day events end on the start of their last day. A timed event that
  // ends at midnight doesn't reach into the day that starts then.
  if (event.isAllDay || event.end <= event.start) {
    return { first, last: startOfDay(event.end) };
  }
  return { first, last: startOfDay(new Date(event.end.getTime() - 1)) };
}

/**
 * Minutes into `day` an entry starts, for sorting: 0 when it was already
 * going on when the day began
 */
function getEntryStartMinutes(entry: AgendaEntry, day: Date): number {
  if (entry.dayIndex > 1) return 0;
  return differenceInMinutes(entry.event.start, day);
}

/** Orders a day's entries: whole-day ones first (longest first), then by start */
function compareAgendaEntries(
  a: AgendaEntry,
  b: AgendaEntry,
  day: Date,
): number {
  if (a.isAllDayOnThisDay !== b.isAllDayOnThisDay) {
    return a.isAllDayOnThisDay ? -1 : 1;
  }
  if (a.isAllDayOnThisDay && a.dayCount !== b.dayCount) {
    return b.dayCount - a.dayCount;
  }
  const startDifference =
    getEntryStartMinutes(a, day) - getEntryStartMinutes(b, day);
  if (startDifference !== 0) return startDifference;
  const endDifference = a.event.end.getTime() - b.event.end.getTime();
  if (endDifference !== 0) return endDifference;
  return a.event.title.localeCompare(b.event.title);
}

/**
 * Lists the events of `dayCount` days from `firstDay`, one `AgendaDay` per
 * day (including days without events). An event spanning several days is
 * listed under each of them, with its position (`dayIndex` of `dayCount`).
 * All-day events use the calendar's convention: `end` is the start of their
 * last day.
 */
export function getAgendaDays(
  events: CalendarEvent[],
  firstDay: Date,
  dayCount: number,
): AgendaDay[] {
  const rangeStart = startOfDay(firstDay);
  const rangeEnd = addDays(rangeStart, Math.max(1, dayCount) - 1);
  const ranges = events
    .map((event) => ({ event, ...getEventDayRange(event) }))
    .filter(({ first, last }) => first <= rangeEnd && last >= rangeStart);

  return eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((date) => {
    const entries = ranges
      .filter(({ first, last }) => first <= date && last >= date)
      .map(({ event, first, last }): AgendaEntry => {
        const dayIndex = differenceInCalendarDays(date, first) + 1;
        const dayCount = differenceInCalendarDays(last, first) + 1;
        const isAllDayOnThisDay =
          Boolean(event.isAllDay) || (dayIndex > 1 && dayIndex < dayCount);
        return { event, dayIndex, dayCount, isAllDayOnThisDay };
      })
      .sort((a, b) => compareAgendaEntries(a, b, date));
    return { date, entries };
  });
}

/**
 * When an agenda entry happens on its day: "All day", the time range
 * ("10–11 AM"), or for a multi-day timed event "From 4 PM" on its first day
 * and "Until 1 PM" on its last
 */
export function formatAgendaTime(
  entry: AgendaEntry,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  const { event, dayIndex, dayCount, isAllDayOnThisDay } = entry;
  if (isAllDayOnThisDay) return "All day";
  if (dayCount === 1) {
    return formatTimeRange(event.start, event.end, hourCycle, locale);
  }
  if (dayIndex === 1)
    return `From ${formatTime(event.start, hourCycle, locale)}`;
  return `Until ${formatTime(event.end, hourCycle, locale)}`;
}

/** Which day of a multi-day event an entry is ("Day 2 of 3"), or `null` */
export function formatAgendaDayOfSpan(entry: AgendaEntry): string | null {
  if (entry.dayCount === 1) return null;
  return `Day ${entry.dayIndex} of ${entry.dayCount}`;
}

// ---------------------------------------------------------------------------
// Year view
// ---------------------------------------------------------------------------

/**
 * How many events fall on each day of `range` (end exclusive), keyed by
 * `formatCellDate` ("2026-06-04"). An event counts on every day it covers,
 * as the agenda lists it: an all-day event through the start of its last
 * day, a timed event that ends at midnight not on the day that starts then.
 * Days without events are left out. Year view marks days with it.
 */
export function countEventsByDay(
  events: CalendarEvent[],
  range: VisibleRange,
): Map<string, number> {
  const counts = new Map<string, number>();
  const rangeFirst = startOfDay(range.start);
  const rangeLast = addDays(startOfDay(range.end), -1);
  for (const event of events) {
    const { first, last } = getEventDayRange(event);
    if (last < rangeFirst || first > rangeLast) continue;
    const end = last > rangeLast ? rangeLast : last;
    for (
      let day = first < rangeFirst ? rangeFirst : first;
      day <= end;
      day = addDays(day, 1)
    ) {
      const key = formatCellDate(day);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Time labels
// ---------------------------------------------------------------------------

/**
 * Formats a time of day: "3 PM" / "3:30 PM" on a 12-hour clock, "15:00" /
 * "15:30" on a 24-hour clock.
 */
export function formatTime(
  date: Date,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  if (hourCycle === 24) return format(date, "HH:mm", { locale });
  if (date.getMinutes() === 0) return format(date, "h a", { locale });
  return format(date, "h:mm a", { locale });
}

/**
 * Formats a time range compactly: "10–11 AM" or "11 AM–2 PM" (the period
 * is shown once when both ends share it) on a 12-hour clock, "10:00–11:00"
 * on a 24-hour clock.
 */
export function formatTimeRange(
  start: Date,
  end: Date,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  if (hourCycle === 24) {
    return `${format(start, "HH:mm", { locale })}\u2013${format(end, "HH:mm", { locale })}`;
  }

  const startTime = formatHourAndMinutes(start, locale);
  const endTime = formatHourAndMinutes(end, locale);
  const startPeriod = format(start, "a", { locale });
  const endPeriod = format(end, "a", { locale });

  if (startPeriod === endPeriod) {
    return `${startTime}\u2013${endTime} ${endPeriod}`;
  }
  return `${startTime} ${startPeriod}\u2013${endTime} ${endPeriod}`;
}

/** 12-hour clock without the period, minutes only when set: "10", "2:45" */
function formatHourAndMinutes(date: Date, locale: Locale): string {
  if (date.getMinutes() === 0) return format(date, "h", { locale });
  return format(date, "h:mm", { locale });
}

/**
 * Formats an hour of the day (0-23) for the time axis: "12 AM", "1 AM", ...
 * "11 PM" on a 12-hour clock, "00:00" ... "23:00" on a 24-hour clock.
 *
 * Computed from the number alone, not from a Date on today's date: on a
 * daylight-saving transition day, setting the hour that is skipped would
 * yield the next hour, so the labels would depend on the runtime's timezone
 * and date and could differ between server and client.
 */
export function formatHourLabel(
  hour: number,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  if (hourCycle === 24) return `${String(hour).padStart(2, "0")}:00`;
  const hourOnClock = hour % 12 === 0 ? 12 : hour % 12;
  // Same period text as `format(date, "a")`
  const period = locale.localize.dayPeriod(hour < 12 ? "am" : "pm", {
    width: "abbreviated",
    context: "formatting",
  });
  return `${hourOnClock} ${period}`;
}

/** A time of day in minutes, wrapped into one day (0 to 1439): -180 becomes 1260, 9 PM */
function wrapMinutesOfDay(minutes: number): number {
  const whole = Math.floor(minutes);
  return ((whole % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** The period `format(date, "a")` writes for `hour` (0-23), "AM" or "PM" in English */
function getDayPeriod(hour: number, locale: Locale): string {
  return locale.localize.dayPeriod(hour < 12 ? "am" : "pm", {
    width: "abbreviated",
    context: "formatting",
  });
}

/**
 * Formats a time of day, given in minutes since midnight and wrapped into
 * one day, for the second time zone's column of the time axis: "7 PM" or
 * "7:30 PM" on a 12-hour clock, "19:00" or "19:30" on a 24-hour clock.
 * Whole hours read exactly like `formatHourLabel`. Like it, this reads the
 * number alone, so it doesn't depend on the runtime's time zone.
 */
export function formatTimeOfDayLabel(
  minutes: number,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  const time = wrapMinutesOfDay(minutes);
  const hour = Math.floor(time / 60);
  const minute = time % 60;
  if (minute === 0) return formatHourLabel(hour, hourCycle, locale);

  const paddedMinute = String(minute).padStart(2, "0");
  if (hourCycle === 24) {
    return `${String(hour).padStart(2, "0")}:${paddedMinute}`;
  }
  const hourOnClock = hour % 12 === 0 ? 12 : hour % 12;
  return `${hourOnClock}:${paddedMinute} ${getDayPeriod(hour, locale)}`;
}

/**
 * Formats the time in a badge of the current-time line, from minutes since
 * midnight wrapped into one day: "5:48PM" on a 12-hour clock, "17:48" on a
 * 24-hour clock. Reads the number alone, so a second time zone's badge
 * reads like the viewer's.
 */
export function formatNowLineTime(
  minutes: number,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  const time = wrapMinutesOfDay(minutes);
  const hour = Math.floor(time / 60);
  const paddedMinute = String(time % 60).padStart(2, "0");
  if (hourCycle === 24) {
    return `${String(hour).padStart(2, "0")}:${paddedMinute}`;
  }
  const hourOnClock = hour % 12 === 0 ? 12 : hour % 12;
  return `${hourOnClock}:${paddedMinute}${getDayPeriod(hour, locale)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Accessibility: labels, announcements and keyboard editing
// ---------------------------------------------------------------------------

/** Name read for an event whose title is empty */
const UNTITLED_EVENT_LABEL = "Untitled event";

/** Days a month-view event moves per Alt+ArrowUp/Down (one row) */
const MONTH_KEYBOARD_STEP_DAYS = 7;

/** Day a date falls on, read in full: "Tuesday, October 31" in the calendar's locale */
export function formatFullDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale.code, {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** Time with minutes, as read aloud: "3:00 PM", or "15:00" on a 24-hour clock */
function formatSpokenTime(
  date: Date,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  return format(date, hourCycle === 24 ? "HH:mm" : "h:mm a", { locale });
}

/** An event's title, or a stand-in when it has none */
export function getSpokenTitle(event: CalendarEvent): string {
  return event.title.trim() || UNTITLED_EVENT_LABEL;
}

/**
 * When an event happens, as read aloud: "3:00 PM to 4:00 PM, Tuesday,
 * October 31", "all day, Tuesday, October 31", or a range across days.
 */
export function describeEventTime(
  event: CalendarEvent,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  const startDate = formatFullDate(event.start, locale);
  const endDate = formatFullDate(event.end, locale);
  if (event.isAllDay) {
    if (isSameDay(event.start, event.end)) return `all day, ${startDate}`;
    return `all day, ${startDate} to ${endDate}`;
  }

  const startTime = formatSpokenTime(event.start, hourCycle, locale);
  const endTime = formatSpokenTime(event.end, hourCycle, locale);
  if (!isMultiDayEvent(event)) {
    return `${startTime} to ${endTime}, ${startDate}`;
  }
  return `${startDate}, ${startTime} to ${endDate}, ${endTime}`;
}

/**
 * Accessible name of an event: its title, then when it happens
 * ("Team sync, 3:00 PM to 4:00 PM, Tuesday, October 31")
 */
export function getEventLabel(
  event: CalendarEvent,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  const label = `${getSpokenTitle(event)}, ${describeEventTime(event, hourCycle, locale)}`;
  return isDeclinedByViewer(event) ? `${label}, declined` : label;
}

/**
 * The participant who is the viewer: the one marked `self` (Google
 * Calendar's flag), else the one whose email is the event calendar's
 * `calendarEmail`, the account the event shows in
 */
function getViewerParticipant(
  event: DetailedCalendarEvent,
): EventParticipant | undefined {
  const { participants, calendarEmail } = event;
  if (!participants) return undefined;
  const self = participants.find((participant) => participant.self);
  if (self || !calendarEmail) return self;
  const viewerEmail = calendarEmail.toLowerCase();
  return participants.find(
    (participant) => participant.email.toLowerCase() === viewerEmail,
  );
}

/**
 * Whether the viewer declined the event: their participant's `response` is
 * "declined". The views hide these events while `showDeclinedEvents` is off
 * and draw them struck through otherwise.
 */
export function isDeclinedByViewer(event: DetailedCalendarEvent): boolean {
  return getViewerParticipant(event)?.response === "declined";
}

/**
 * The events a view draws with the "Declined events" setting: all of them,
 * or all but the ones the viewer declined
 */
export function filterDeclinedEvents<TEvent extends CalendarEvent>(
  events: TEvent[],
  showDeclinedEvents: boolean,
): TEvent[] {
  if (showDeclinedEvents) return events;
  return events.filter((event) => !isDeclinedByViewer(event));
}

/**
 * What to announce after an event changed: "Moved Team sync to Wednesday,
 * November 4, 3:00 PM", or "Resized Team sync, now ..." when its length
 * changed. Returns `null` when its time didn't change (e.g. a title edit).
 */
export function describeEventChange(
  previous: CalendarEvent,
  next: CalendarEvent,
  hourCycle: HourCycle,
  locale: Locale,
): string | null {
  const isSameTime =
    previous.start.getTime() === next.start.getTime() &&
    previous.end.getTime() === next.end.getTime() &&
    Boolean(previous.isAllDay) === Boolean(next.isAllDay);
  if (isSameTime) return null;

  const title = getSpokenTitle(next);
  const previousLength = previous.end.getTime() - previous.start.getTime();
  const nextLength = next.end.getTime() - next.start.getTime();
  if (previousLength !== nextLength) {
    return `Resized ${title}, now ${describeEventTime(next, hourCycle, locale)}`;
  }

  const startDate = formatFullDate(next.start, locale);
  if (next.isAllDay) return `Moved ${title} to ${startDate}`;
  return `Moved ${title} to ${startDate}, ${formatSpokenTime(next.start, hourCycle, locale)}`;
}

/** What to announce after an event was created ("Created New event, ...") */
export function describeEventCreated(
  event: CalendarEvent,
  hourCycle: HourCycle,
  locale: Locale,
): string {
  return `Created ${getSpokenTitle(event)}, ${describeEventTime(event, hourCycle, locale)}`;
}

/**
 * Returns the event after an Alt+Arrow key press on it, or `null` when the
 * key doesn't apply (or the event can't move further):
 *
 * - Alt+ArrowLeft/Right: one day earlier/later, over the weekend while
 *   it is hidden (`showWeekends` false): Friday to Monday
 * - Alt+ArrowUp/Down: one `snapMinutes` step earlier/later in the day and
 *   week views (single-day timed events only, kept inside the visible
 *   hours), one week earlier/later in month view
 * - Alt+Shift+ArrowUp/Down: the end one step earlier/later (day and week
 *   views, single-day timed events, at least one step long)
 */
export function getKeyboardEventChange(
  event: CalendarEvent,
  key: string,
  shiftKey: boolean,
  view: ViewType,
  {
    snapMinutes,
    dayStartHour,
    dayEndHour,
  }: Pick<CalendarConfig, "snapMinutes" | "dayStartHour" | "dayEndHour">,
  showWeekends = true,
): CalendarEvent | null {
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : -1;

  if (key === "ArrowLeft" || key === "ArrowRight") {
    if (shiftKey) return null;
    const days = differenceInCalendarDays(
      addShownDays(event.start, direction, showWeekends),
      event.start,
    );
    return {
      ...event,
      start: addDays(event.start, days),
      end: addDays(event.end, days),
    };
  }
  if (key !== "ArrowUp" && key !== "ArrowDown") return null;

  // Month view has no time axis: up and down move by a row (a week)
  if (view === "month") {
    if (shiftKey) return null;
    const days = direction * MONTH_KEYBOARD_STEP_DAYS;
    return {
      ...event,
      start: addDays(event.start, days),
      end: addDays(event.end, days),
    };
  }

  // Only single-day timed events have a time of day to change
  if (event.isAllDay || isMultiDayEvent(event)) return null;

  const dayStart = startOfDay(event.start);
  const startMinutes = getMinutesOnDay(event.start, dayStart);
  const endMinutes = getMinutesOnDay(event.end, dayStart);
  const visibleStart = dayStartHour * 60;
  const visibleEnd = dayEndHour * 60;
  // Next grid line in the key's direction, so an off-grid time lands on it
  const step = (minutes: number) =>
    direction > 0
      ? Math.floor(minutes / snapMinutes) * snapMinutes + snapMinutes
      : Math.ceil(minutes / snapMinutes) * snapMinutes - snapMinutes;
  const clampMinutes = (minutes: number, min: number, max: number) =>
    Math.min(Math.max(minutes, min), max);
  // An end past the last minute of the day is capped at the end of the day
  const toDate = (minutes: number) => {
    if (minutes >= MINUTES_PER_DAY) return endOfDay(dayStart);
    const date = atMinutesOfDay(dayStart, minutes);
    // A time the clocks skip lands an hour later, which is the next real time
    // going down. Going up, the next real time is the hour before.
    const skipped = getMinutesOnDay(date, dayStart) - minutes;
    if (direction > 0 || skipped <= 0) return date;
    return atMinutesOfDay(dayStart, minutes - skipped);
  };

  if (shiftKey) {
    const nextEnd = clampMinutes(
      step(endMinutes),
      startMinutes + snapMinutes,
      visibleEnd,
    );
    if (nextEnd === endMinutes) return null;
    return { ...event, end: toDate(nextEnd) };
  }

  const length = endMinutes - startMinutes;
  // Inside the hour the clocks repeat, the end can come first on the clock
  if (length < 0) return null;
  const nextStart = clampMinutes(
    step(startMinutes),
    visibleStart,
    visibleEnd - length,
  );
  if (nextStart === startMinutes) return null;
  return {
    ...event,
    start: toDate(nextStart),
    end: toDate(nextStart + length),
  };
}

// ---------------------------------------------------------------------------
// Calendars and reminders
// ---------------------------------------------------------------------------

/** Minutes in one of each reminder unit */
const MINUTES_PER_REMINDER_UNIT: Record<EventReminder["unit"], number> = {
  minutes: 1,
  hours: 60,
  days: 24 * 60,
  weeks: 7 * 24 * 60,
};

/** Groups calendars by account email, keeping the order they were given in */
export function groupCalendarsByEmail(
  calendars: readonly CalendarInfo[],
): CalendarGroup[] {
  const groups: CalendarGroup[] = [];
  for (const calendar of calendars) {
    const group = groups.find((g) => g.email === calendar.email);
    if (group) {
      group.calendars.push(calendar);
      continue;
    }
    groups.push({ email: calendar.email, calendars: [calendar] });
  }
  return groups;
}

/**
 * How many minutes before the event's start a reminder fires. An all-day
 * reminder's `time` moves it later in its day: "1 day before at 9 AM" fires
 * 15 hours before the event's midnight start.
 */
export function getReminderMinutes(reminder: EventReminder): number {
  const minutes = reminder.amount * MINUTES_PER_REMINDER_UNIT[reminder.unit];
  if (!reminder.time) return minutes;
  return minutes - (reminder.time.hours * 60 + reminder.time.minutes);
}

/** Whether two reminders fire at the same moment, as "60min" and "1hour" do */
export function isSameReminder(a: EventReminder, b: EventReminder): boolean {
  return getReminderMinutes(a) === getReminderMinutes(b);
}

/**
 * Adds a reminder, keeping the list sorted from the one closest to the start
 * to the earliest. Returns `reminders` itself when one firing at the same
 * moment is already set.
 */
export function addReminder(
  reminders: EventReminder[],
  reminder: EventReminder,
): EventReminder[] {
  if (reminders.some((r) => isSameReminder(r, reminder))) return reminders;
  return [...reminders, reminder].sort(
    (a, b) => getReminderMinutes(a) - getReminderMinutes(b),
  );
}

/** Whether two reminder lists fire at the same moments, in any order */
function isSameReminderList(
  a: readonly EventReminder[],
  b: readonly EventReminder[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((reminder) =>
    b.some((other) => isSameReminder(reminder, other)),
  );
}

/**
 * Moves an event to another calendar, as Notion Calendar does: an event
 * drawn in its calendar's color takes the new calendar's, and one that kept
 * its calendar's default reminders takes the new calendar's defaults. A
 * color or reminders set by hand stay. `calendarEmail` becomes the new
 * calendar's account.
 */
export function moveEventToCalendar<TEvent extends DetailedCalendarEvent>(
  event: TEvent,
  to: CalendarInfo,
  calendars: readonly CalendarInfo[],
): TEvent {
  const from = calendars.find((c) => c.id === event.calendarId);
  const moved: TEvent = {
    ...event,
    calendarId: to.id,
    calendarEmail: to.email,
  };
  if (event.color !== undefined && event.color === from?.color) {
    moved.color = to.color;
  }
  if (
    to.defaultReminders &&
    from?.defaultReminders &&
    isSameReminderList(event.reminders ?? [], from.defaultReminders)
  ) {
    moved.reminders = [...to.defaultReminders];
  }
  return moved;
}

/** Whether an event is on one of the hidden calendars. An event without a calendar always shows */
function isOnHiddenCalendar(
  event: DetailedCalendarEvent,
  hiddenCalendarIds: readonly string[],
): boolean {
  return (
    event.calendarId !== undefined &&
    hiddenCalendarIds.includes(event.calendarId)
  );
}

/**
 * The events left when some calendars are hidden: what to give
 * `CalendarProvider` so a hidden calendar's events leave every view. Gives
 * back the same array when nothing is hidden.
 */
export function filterShownEvents<TEvent extends DetailedCalendarEvent>(
  events: TEvent[],
  hiddenCalendarIds: readonly string[],
): TEvent[] {
  if (hiddenCalendarIds.length === 0) return events;
  return events.filter(
    (event) => !isOnHiddenCalendar(event, hiddenCalendarIds),
  );
}

/**
 * Every event again, after the provider changed the shown ones (its
 * `onEventsChange` only knows about those). Hidden events stay where they
 * are, a shown event takes its new value in place, one the provider dropped
 * is dropped, and new events go last. Keeping the order keeps events that
 * start together in the same columns after a calendar is hidden and shown
 * again.
 */
export function mergeShownEvents<TEvent extends DetailedCalendarEvent>(
  allEvents: TEvent[],
  shownEvents: TEvent[],
  hiddenCalendarIds: readonly string[],
): TEvent[] {
  if (hiddenCalendarIds.length === 0) return shownEvents;

  const pending = new Map(shownEvents.map((event) => [event.id, event]));
  const merged: TEvent[] = [];
  for (const event of allEvents) {
    if (isOnHiddenCalendar(event, hiddenCalendarIds)) {
      merged.push(event);
      continue;
    }
    const next = pending.get(event.id);
    if (!next) continue;
    merged.push(next);
    pending.delete(event.id);
  }
  return [...merged, ...pending.values()];
}

/** The summary's label of each field it shows without values, in the details' order */
const EVENT_FIELD_LABELS: Record<string, string> = {
  kind: "Type",
  participants: "Participants",
  rooms: "Rooms",
  conference: "Conferencing",
  aiMeetingNotes: "AI meeting notes",
  links: "Links",
  attachments: "Attachments",
  reminders: "Reminders",
  status: "Availability",
  visibility: "Visibility",
};

/** What the summary shows for a field that is empty */
const NO_VALUE_LABEL = "None";

/** Options of `getEventChangeSummary` */
interface EventChangeSummaryOptions {
  hourCycle: HourCycle;
  locale: Locale;
  calendars: CalendarInfo[];
}

/** Whether two field values are equal: dates by time, the rest by their JSON */
function isSameSummaryValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

/** An event's time for the summary: "2–3:30 PM", or "All day", after its date when asked */
function formatSummaryTime(
  event: DetailedCalendarEvent,
  withDate: boolean,
  { hourCycle, locale }: EventChangeSummaryOptions,
): string {
  const time = event.isAllDay
    ? "All day"
    : formatTimeRange(event.start, event.end, hourCycle, locale);
  if (!withDate) return time;
  return `${format(event.start, "EEE MMM d", { locale })}, ${time}`;
}

/** An event's repeat rule for the summary: "Every week on Thu", or "Does not repeat" */
function formatSummaryRepeat(
  event: DetailedCalendarEvent,
  locale: Locale,
): string {
  const rule = getEventRecurrenceRule(event);
  if (!rule) return "Does not repeat";
  const { main, detail } = describeRecurrenceRule(rule, event.start, locale);
  return `${main} ${detail}`.trim();
}

/** An event's time zone for the summary: "GMT−3 Sao Paulo", or "None" */
function formatSummaryTimeZone(event: DetailedCalendarEvent): string {
  if (!event.timeZone || !isKnownTimeZone(event.timeZone)) {
    return NO_VALUE_LABEL;
  }
  const { offset, city } = getTimeZoneRowLabel(event.start, event.timeZone);
  return `${offset} ${city}`;
}

/**
 * What changed between two versions of an event, for the edit question of
 * a repeating event: "Title", "Time", "Time zone", "Repeat", "Location",
 * "Description", "Calendar" and "Color" with their new and old values,
 * then the other changed fields by label alone. Empty when nothing
 * changed.
 */
export function getEventChangeSummary(
  before: DetailedCalendarEvent,
  after: DetailedCalendarEvent,
  options: EventChangeSummaryOptions,
): EventChangeSummaryRow[] {
  const rows: EventChangeSummaryRow[] = [];
  const add = (label: string, next: string, previous: string) => {
    if (next !== previous) rows.push({ label, after: next, before: previous });
  };
  const calendarName = (event: DetailedCalendarEvent) =>
    options.calendars.find((calendar) => calendar.id === event.calendarId)
      ?.name ??
    event.calendarId ??
    NO_VALUE_LABEL;
  const colorName = (event: DetailedCalendarEvent) =>
    event.color
      ? `${event.color.charAt(0).toUpperCase()}${event.color.slice(1)}`
      : "Default";

  add("Title", after.title, before.title);
  const timeChanged =
    after.start.getTime() !== before.start.getTime() ||
    after.end.getTime() !== before.end.getTime() ||
    Boolean(after.isAllDay) !== Boolean(before.isAllDay);
  if (timeChanged) {
    const withDate = !isSameDay(after.start, before.start);
    rows.push({
      label: "Time",
      after: formatSummaryTime(after, withDate, options),
      before: formatSummaryTime(before, withDate, options),
    });
  }
  add("Time zone", formatSummaryTimeZone(after), formatSummaryTimeZone(before));
  add(
    "Repeat",
    formatSummaryRepeat(after, options.locale),
    formatSummaryRepeat(before, options.locale),
  );
  add(
    "Location",
    after.location || NO_VALUE_LABEL,
    before.location || NO_VALUE_LABEL,
  );
  add(
    "Description",
    after.description || NO_VALUE_LABEL,
    before.description || NO_VALUE_LABEL,
  );
  add("Calendar", calendarName(after), calendarName(before));
  add("Color", colorName(after), colorName(before));

  const left = before as unknown as Record<string, unknown>;
  const right = after as unknown as Record<string, unknown>;
  for (const [key, label] of Object.entries(EVENT_FIELD_LABELS)) {
    if (isSameSummaryValue(left[key], right[key])) continue;
    rows.push({ label, after: null, before: null });
  }
  return rows;
}
