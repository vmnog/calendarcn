import {
  isSameDay,
  startOfDay,
  addDays,
  differenceInMinutes,
  isWithinInterval,
  areIntervalsOverlapping,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  eachDayOfInterval,
  getWeek,
  format,
  isToday,
} from "date-fns";
import type {
  CalendarEvent,
  PositionedEvent,
  WeekDay,
} from "@/components/week-view-types";

/** Returns true when a timed event spans across midnight into a different day. */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  if (event.isAllDay) {
    return false;
  }
  return !isSameDay(event.start, event.end);
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
 * Calculates positioned events for rendering in the grid.
 * @param rightGapPercent - right gap in percentage. Defaults to 8.
 *   Pass 0 for day view so events fill the full column width.
 */
export function calculatePositionedEvents(
  events: CalendarEvent[],
  day: WeekDay,
  rightGapPercent = 8,
): PositionedEvent[] {
  const dayEvents = getEventsForDay(events, day);

  if (dayEvents.length === 0) {
    return [];
  }

  const columnAssignments = assignColumns(dayEvents);
  const dayStart = startOfDay(day.date);

  const nextDayMidnight = addDays(dayStart, 1);

  return dayEvents.map((event) => {
    const assignment = columnAssignments.get(event.id) ?? {
      column: 0,
      totalColumns: 1,
    };

    // Compute effective start/end clamped to this day's boundaries
    const effectiveStart = event.start > dayStart ? event.start : dayStart;
    const effectiveEnd =
      event.end < nextDayMidnight ? event.end : nextDayMidnight;

    // Calculate top position (percentage from day start)
    const minutesFromDayStart = differenceInMinutes(effectiveStart, dayStart);
    const top = (minutesFromDayStart / (24 * 60)) * 100;

    // Calculate height (percentage of the day)
    const durationMinutes = differenceInMinutes(effectiveEnd, effectiveStart);
    const height = (durationMinutes / (24 * 60)) * 100;

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

/** Height of a single event row in the month grid (px) */
export const MONTH_EVENT_ROW_HEIGHT = 22;

/** Minimum visible event slots per month cell */
const MIN_MONTH_SLOTS = 2;

/** Maximum visible event slots per month cell */
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
 */
export interface MonthDayCellLayout {
  date: Date;
  slots: MonthCellSlot[];
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
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
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
      dayName: format(day, "EEE"),
      dayNumber: day.getDate(),
      isToday: isToday(day),
    }));

    return {
      weekNumber: getWeek(weekStart, { weekStartsOn }),
      days,
    };
  });
}

/**
 * Returns the number of visible event slots for a month cell given its
 * pixel height.
 *
 * Clamped to [`MIN_MONTH_SLOTS`, `MAX_MONTH_SLOTS`].
 */
export function getMonthSlotCount(cellHeight: number): number {
  const raw = Math.floor(cellHeight / MONTH_EVENT_ROW_HEIGHT);
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

      const slots: MonthCellSlot[] = [];

      // Count total events touching this cell
      let totalEvents = timedByCol[col].length;
      for (const slotRow of slotAssignments) {
        for (const assignment of slotRow) {
          if (col >= assignment.startCol && col <= assignment.endCol) {
            totalEvents++;
          }
        }
      }

      // Fill spanning event slots
      for (let slotIdx = 0; slotIdx < slotAssignments.length; slotIdx++) {
        const assignment = slotAssignments[slotIdx].find(
          (a) => col >= a.startCol && col <= a.endCol,
        );

        if (!assignment) {
          slots.push({ type: "spacer" });
          continue;
        }

        const isStart = col === assignment.startCol;
        const colSpan = assignment.endCol - col + 1;

        const evEnd = assignment.event.isAllDay
          ? addDays(startOfDay(assignment.event.end), 1)
          : assignment.event.end;

        const roundedLeft =
          isStart && (isSameDay(assignment.event.start, day.date) || col === 0);
        const roundedRight =
          col === assignment.endCol &&
          (evEnd <= addDays(startOfDay(day.date), 1) ||
            col === row.days.length - 1);

        if (isStart) {
          slots.push({
            type: "event-bar",
            event: assignment.event,
            colSpan,
            isStart: true,
            roundedLeft,
            roundedRight,
          });
        } else {
          // Continuation cell — spacer so rendering skips it (bar rendered from isStart cell)
          slots.push({ type: "spacer" });
        }
      }

      // Fill remaining slots with timed events
      const usedSlots = slots.length;
      const remainingSlots = maxSlots - usedSlots;
      const timedEvents = timedByCol[col];

      if (totalEvents <= maxSlots) {
        // Everything fits
        for (const ev of timedEvents) {
          slots.push({ type: "event-item", event: ev });
        }
      } else {
        // Need "+N more" in the last slot
        const availableForTimed = Math.max(0, remainingSlots - 1);
        const timedToShow = timedEvents.slice(0, availableForTimed);
        for (const ev of timedToShow) {
          slots.push({ type: "event-item", event: ev });
        }
        const hiddenCount = totalEvents - (usedSlots + timedToShow.length);
        slots.push({ type: "more", count: hiddenCount });
      }

      result.set(key, {
        date: day.date,
        slots,
        totalEvents,
      });
    }
  }

  return result;
}
