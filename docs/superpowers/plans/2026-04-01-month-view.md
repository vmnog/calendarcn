# Month View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a month view to CalendarCN that displays a 7-column grid with 5-6 week rows, all-day/multi-day event bars, timed event text lines, "+N more" overflow navigation, and drag-to-move interactions.

**Architecture:** Standalone MonthView component tree parallel to WeekView. Shared types extracted to `calendar-types.ts`. Day headers renamed to `calendar-day-headers.tsx` for reuse. Layout algorithm in `event-utils.ts` computes per-cell slot assignments. Drag hook follows the existing ref-based pattern from `use-event-drag.ts`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, date-fns, shadcn/ui

---

## File Structure

| Action | File                                                                                   | Responsibility                                                                                                                       |
| ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Create | `src/components/calendar-types.ts`                                                     | Shared types: `CalendarEvent`, `EventColor`, `ViewType`, `ViewSettings`, `EventReminder`, `PositionedEvent`, drag/resize state types |
| Modify | `src/components/week-view-types.ts`                                                    | Remove extracted types, re-export from `calendar-types.ts`, keep week-specific prop interfaces                                       |
| Rename | `src/components/week-view-day-columns.tsx` → `src/components/calendar-day-headers.tsx` | Generic day-of-week header row                                                                                                       |
| Modify | `src/components/week-view.tsx`                                                         | Update import from `calendar-day-headers`                                                                                            |
| Modify | `src/app/page.tsx`                                                                     | Add `MonthView` rendering, `highlightedDate` state, month navigation, `handleMoreClick`                                              |
| Create | `src/components/month-view.tsx`                                                        | Month view orchestrator: computes grid, filters events, delegates to children                                                        |
| Create | `src/components/month-view-grid.tsx`                                                   | Renders week rows, measures cell height via ResizeObserver, computes slot count                                                      |
| Create | `src/components/month-view-day-cell.tsx`                                               | Individual day cell: day number, event bars, event items, "+N more" button                                                           |
| Create | `src/components/month-view-event-bar.tsx`                                              | All-day/multi-day colored bar (reuses `eventColorStyles` pattern)                                                                    |
| Create | `src/components/month-view-event-item.tsx`                                             | Timed event line: colored dot + time + title                                                                                         |
| Create | `src/hooks/use-month-event-drag.ts`                                                    | Day-snapping drag for month view events                                                                                              |
| Modify | `src/lib/event-utils.ts`                                                               | Add `generateMonthGrid()` and `calculateMonthCellLayout()`                                                                           |
| Modify | `src/lib/mock-events.ts`                                                               | Add multi-day events spanning week boundaries for month view testing                                                                 |

---

### Task 1: Extract Shared Types to `calendar-types.ts`

**Files:**

- Create: `src/components/calendar-types.ts`
- Modify: `src/components/week-view-types.ts`
- Modify: All files that import from `week-view-types.ts` (listed below)

This task extracts generic types that both week and month views need into a shared file, then updates `week-view-types.ts` to re-export them for backward compatibility.

- [ ] **Step 1: Create `calendar-types.ts` with extracted types**

Create `src/components/calendar-types.ts` with these types moved from `week-view-types.ts`:

```ts
import type React from "react";

/**
 * Calendar view mode — "day" shows a single column, "week" shows 7 columns, "month" shows a month grid
 */
export type ViewType = "day" | "week" | "month";

/**
 * View settings for display preferences (toggleable from the view dropdown)
 */
export interface ViewSettings {
  showWeekends: boolean;
  showDeclinedEvents: boolean;
  showWeekNumbers: boolean;
}

/**
 * Represents a single day in a calendar view
 */
export interface WeekDay {
  /** The full Date object for this day */
  date: Date;
  /** Short day name (e.g., "Sun", "Mon") */
  dayName: string;
  /** Day of month (1-31) */
  dayNumber: number;
  /** Whether this day is today */
  isToday: boolean;
}

/**
 * Represents a single hour slot in the time axis
 */
export interface HourSlot {
  /** Hour in 24-hour format (0-23) */
  hour: number;
  /** Formatted label (e.g., "12 AM", "1 PM") */
  label: string;
}

/**
 * Represents an event reminder
 */
export interface EventReminder {
  amount: number;
  unit: "minutes" | "hours" | "days";
}

/**
 * Represents a calendar event
 */
export interface CalendarEvent {
  /** Unique identifier for the event */
  id: string;
  /** Event title */
  title: string;
  /** Start date and time */
  start: Date;
  /** End date and time */
  end: Date;
  /** Whether this is an all-day event */
  isAllDay?: boolean;
  /** Event color (for styling) */
  color?: EventColor;
  /** Calendar ID this event belongs to */
  calendarId?: string;
  /** Optional description */
  description?: string;
  /** Optional location */
  location?: string;
  /** Timezone string (e.g. "GMT-3 Sao Paulo") */
  timezone?: string;
  /** Recurrence rule display string (e.g. "Every week on Thu") */
  recurrence?: string;
  /** Reminders list */
  reminders?: EventReminder[];
  /** Busy/Free status */
  status?: "busy" | "free";
  /** Visibility setting */
  visibility?: "default" | "public" | "private";
  /** Calendar account email for display */
  calendarEmail?: string;
}

/**
 * Predefined event colors
 */
export type EventColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "gray";

/**
 * Represents a positioned event for rendering in the grid
 */
export interface PositionedEvent {
  /** The original event */
  event: CalendarEvent;
  /** Top position as percentage from the day start */
  top: number;
  /** Height as percentage of the day */
  height: number;
  /** Left position as percentage (for overlap handling) */
  left: number;
  /** Width as percentage (for overlap handling) */
  width: number;
  /** Column index when events overlap */
  column: number;
  /** Total columns when events overlap */
  totalColumns: number;
  /** Segment position for multi-day timed events (controls corner rounding) */
  segmentPosition?: "start" | "middle" | "end" | "full";
}

/**
 * Drag variant for rendering events in different visual states during drag
 */
export type EventDragVariant = "default" | "ghost" | "dragging" | "placeholder";

/**
 * State of an in-progress event drag operation
 */
export interface EventDragState {
  /** ID of the event being dragged */
  eventId: string;
  /** The original event being dragged (preserved across week navigations) */
  event: CalendarEvent;
  /** Original start time before drag */
  originalStart: Date;
  /** Original end time before drag */
  originalEnd: Date;
  /** Current snapped start time during drag */
  currentStart: Date;
  /** Current snapped end time during drag */
  currentEnd: Date;
  /** Target day for the placeholder (decoupled from currentStart for cross-column drag) */
  currentDate: Date;
  /** Whether the drag threshold has been met */
  isDragging: boolean;
  /** Raw cursor Y position in px (unsnapped, for smooth dragging copy) */
  cursorY: number;
  /** Raw cursor X position in px relative to grid container */
  cursorX: number;
  /** Viewport clientX for fixed-position dragging copy */
  clientX: number;
  /** Viewport clientY for fixed-position dragging copy */
  clientY: number;
}

/**
 * State of an in-progress event resize operation
 */
export interface EventResizeState {
  /** ID of the event being resized */
  eventId: string;
  /** The original event being resized */
  event: CalendarEvent;
  /** Original start time before resize */
  originalStart: Date;
  /** Original end time before resize */
  originalEnd: Date;
  /** Current snapped start time during resize */
  currentStart: Date;
  /** Current snapped end time during resize */
  currentEnd: Date;
  /** Which edge was originally grabbed */
  edge: "top" | "bottom";
  /** Which edge the cursor is effectively on (flips when crossing anchor) */
  effectiveEdge: "top" | "bottom";
  /** Whether the drag threshold has been met */
  isResizing: boolean;
  /** Target day column for the end during cross-day bottom resize */
  currentEndDate: Date;
  /** Target day column for the start during cross-day top resize */
  currentStartDate: Date;
}

/**
 * State of an in-progress all-day event resize operation
 */
export interface AllDayResizeState {
  /** ID of the event being resized */
  eventId: string;
  /** The original event being resized */
  event: CalendarEvent;
  /** Original start column index in the buffered days array */
  originalStartColumn: number;
  /** Original end column index in the buffered days array */
  originalEndColumn: number;
  /** Current start column index during resize */
  currentStartColumn: number;
  /** Current end column index during resize */
  currentEndColumn: number;
  /** Which edge is being dragged, or "move" for drag-and-drop */
  edge: "left" | "right" | "move";
  /** Whether the drag threshold has been met */
  isResizing: boolean;
  /** Viewport-relative cursor X during move (for floating copy) */
  clientX?: number;
  /** Viewport-relative cursor Y during move (for floating copy) */
  clientY?: number;
  /** Offset from cursor to event left edge at mousedown (px) */
  cursorOffsetX?: number;
  /** Offset from cursor to event top edge at mousedown (px) */
  cursorOffsetY?: number;
}
```

- [ ] **Step 2: Update `week-view-types.ts` to re-export and keep only week-specific interfaces**

Replace the contents of `src/components/week-view-types.ts` with re-exports from `calendar-types.ts` plus the week-specific prop interfaces that remain:

```ts
import type React from "react";

// Re-export all shared types from the canonical source
export type {
  ViewType,
  ViewSettings,
  WeekDay,
  HourSlot,
  EventReminder,
  CalendarEvent,
  EventColor,
  PositionedEvent,
  EventDragVariant,
  EventDragState,
  EventResizeState,
  AllDayResizeState,
} from "./calendar-types";

import type {
  CalendarEvent,
  EventDragState,
  EventResizeState,
  AllDayResizeState,
  ViewType,
  WeekDay,
  HourSlot,
} from "./calendar-types";

// --- Week-view-specific prop interfaces below ---

/**
 * Props for the main WeekView component
 */
export interface WeekViewProps {
  view?: ViewType;
  currentDate?: Date;
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  onBackgroundClick?: () => void;
  onDateChange?: (date: Date) => void;
  onVisibleDaysChange?: (days: Date[]) => void;
  onEventChange?: (event: CalendarEvent) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  className?: string;
}

/**
 * Props for the WeekViewDayColumns component (renamed to CalendarDayHeaders)
 */
export interface WeekViewDayColumnsProps {
  days: WeekDay[];
  standalone?: boolean;
  className?: string;
}

/**
 * Props for the WeekViewTimeAxis component
 */
export interface WeekViewTimeAxisProps {
  hours: HourSlot[];
  hourHeight: number;
  className?: string;
}

/**
 * Props for the WeekViewGrid component
 */
export interface WeekViewGridProps {
  days: WeekDay[];
  hours: HourSlot[];
  hourHeight: number;
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  dragState?: EventDragState;
  onEventDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  resizeState?: EventResizeState;
  onEventResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
  onEventChange?: (event: CalendarEvent) => void;
  onContextMenuOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  className?: string;
}

/**
 * Props for the WeekViewTimeIndicator component
 */
export interface WeekViewTimeIndicatorProps {
  days: WeekDay[];
  hourHeight: number;
  scrollDays?: WeekDay[];
  scrollStyle?: React.CSSProperties;
  behindSelection?: boolean;
  className?: string;
}

/**
 * Props for the WeekViewAllDayRow component
 */
export interface WeekViewAllDayRowProps {
  days: WeekDay[];
  allDayEvents?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  scrollStyle?: React.CSSProperties;
  allDayResizeState?: AllDayResizeState;
  onAllDayResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "left" | "right" | "move",
    startColumn: number,
    endColumn: number,
  ) => void;
  onEventChange?: (event: CalendarEvent) => void;
  onContextMenuOpenChange?: (open: boolean) => void;
  allDayScrollContentRef?: React.RefObject<HTMLDivElement | null>;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  visibleStartIndex?: number;
  visibleCount?: number;
  dayColumnWidth?: number;
  className?: string;
}

/**
 * Props for the CalendarEventItem component
 */
export interface CalendarEventItemProps {
  positionedEvent: import("./calendar-types").PositionedEvent;
  hourHeight: number;
  isPast?: boolean;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  dragVariant?: import("./calendar-types").EventDragVariant;
  overrideStart?: Date;
  overrideEnd?: Date;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
  onEventChange?: (event: CalendarEvent) => void;
  cursorY?: number;
  cursorX?: number;
  fixedWidth?: number;
  fixedHeight?: number;
  onContextMenuOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  className?: string;
}
```

- [ ] **Step 3: Verify all existing imports still resolve**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: No type errors. All files that import from `week-view-types.ts` continue to work because of the re-exports.

- [ ] **Step 4: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/calendar-types.ts src/components/week-view-types.ts
git commit -m "refactor: extract shared types to calendar-types.ts"
```

---

### Task 2: Rename `week-view-day-columns.tsx` to `calendar-day-headers.tsx`

**Files:**

- Rename: `src/components/week-view-day-columns.tsx` → `src/components/calendar-day-headers.tsx`
- Modify: `src/components/week-view.tsx` (update import)

- [ ] **Step 1: Rename the file and update the component name**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git mv src/components/week-view-day-columns.tsx src/components/calendar-day-headers.tsx
```

Then in `src/components/calendar-day-headers.tsx`:

- Rename the exported function from `WeekViewDayColumns` to `CalendarDayHeaders`
- Keep `WeekViewDayColumnsProps` as the props type name (it's defined in `week-view-types.ts` and imported by the component — rename it later when convenient, but alias for now)

```tsx
// In calendar-day-headers.tsx, change:
export function WeekViewDayColumns({
// To:
export function CalendarDayHeaders({
```

- [ ] **Step 2: Update import in `week-view.tsx`**

In `src/components/week-view.tsx`, change:

```ts
import { WeekViewDayColumns } from "./week-view-day-columns";
```

To:

```ts
import { CalendarDayHeaders } from "./calendar-day-headers";
```

And update the JSX usage from `<WeekViewDayColumns` to `<CalendarDayHeaders`.

- [ ] **Step 3: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/calendar-day-headers.tsx src/components/week-view.tsx
git add -u  # catches the deletion of the old file
git commit -m "refactor: rename WeekViewDayColumns to CalendarDayHeaders"
```

---

### Task 3: Add `generateMonthGrid()` and `calculateMonthCellLayout()` to `event-utils.ts`

**Files:**

- Modify: `src/lib/event-utils.ts`

These are the core algorithms the month view needs: grid generation and per-cell event slot allocation.

- [ ] **Step 1: Add the `generateMonthGrid` function**

Add to the end of `src/lib/event-utils.ts`:

```ts
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachWeekOfInterval,
  eachDayOfInterval,
  getWeek,
  isSameMonth,
  format,
  isToday,
} from "date-fns";
```

(Merge these with the existing date-fns imports at the top of the file.)

```ts
/** Height of a single event row in the month grid (px) */
export const MONTH_EVENT_ROW_HEIGHT = 22;

/** Minimum number of event slots per cell (1 event + "+N more") */
const MIN_MONTH_SLOTS = 2;

/** Maximum number of event slots per cell at default viewport */
const MAX_MONTH_SLOTS = 6;

/**
 * Represents a single row (week) in the month grid.
 * Each row contains 7 days (or 5 if weekends hidden).
 */
export interface MonthWeekRow {
  /** ISO week number */
  weekNumber: number;
  /** Days in this row */
  days: WeekDay[];
}

/**
 * Generates the month grid: an array of week rows for the given month.
 * Each row has 7 days (Sun-Sat). Days from adjacent months are included
 * to fill complete weeks. Returns 4-6 rows; caller pads to minimum 5 if needed.
 */
export function generateMonthGrid(
  currentDate: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 0,
): MonthWeekRow[] {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });

  const weekStarts = eachWeekOfInterval(
    { start: calendarStart, end: calendarEnd },
    { weekStartsOn },
  );

  return weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return {
      weekNumber: getWeek(weekStart, { weekStartsOn }),
      days: days.map((date) => ({
        date,
        dayName: format(date, "EEE"),
        dayNumber: date.getDate(),
        isToday: isToday(date),
      })),
    };
  });
}
```

- [ ] **Step 2: Add the `MonthCellLayout` types and `calculateMonthCellLayout` function**

Add below the previous code in `src/lib/event-utils.ts`:

```ts
/**
 * A single event slot within a month day cell.
 * Either a visible event or a "+N more" overflow indicator.
 */
export type MonthCellSlot =
  | {
      type: "event-bar";
      event: CalendarEvent;
      /** Column span (1 for single-day, >1 for multi-day) */
      colSpan: number;
      /** Whether this is the start cell (renders the bar) or a continuation (empty placeholder) */
      isStart: boolean;
      /** Whether the bar has a rounded left edge */
      roundedLeft: boolean;
      /** Whether the bar has a rounded right edge */
      roundedRight: boolean;
    }
  | {
      type: "event-item";
      event: CalendarEvent;
    }
  | {
      type: "more";
      count: number;
    }
  | {
      type: "spacer";
    };

/**
 * Layout for a single day cell in the month grid.
 */
export interface MonthDayCellLayout {
  date: Date;
  slots: MonthCellSlot[];
  /** Total events on this day (visible + hidden) */
  totalEvents: number;
}

/**
 * Computes the dynamic slot count based on cell height.
 */
export function getMonthSlotCount(cellHeight: number): number {
  const raw = Math.floor(cellHeight / MONTH_EVENT_ROW_HEIGHT);
  if (raw < MIN_MONTH_SLOTS) return MIN_MONTH_SLOTS;
  if (raw > MAX_MONTH_SLOTS) return MAX_MONTH_SLOTS;
  return raw;
}

/**
 * Calculates the layout for all cells in the month grid.
 *
 * Algorithm:
 * 1. For each week row, find all multi-day/all-day events that span into it.
 *    Assign them stable slot indices (same index across all cells the event spans).
 *    Longer events get priority; ties broken alphabetically.
 * 2. For each day cell, fill remaining slots with timed events sorted by start time.
 * 3. If total events exceed maxSlots, the last slot becomes "+N more".
 *
 * @param weekRows - The month grid from generateMonthGrid()
 * @param events - All calendar events
 * @param maxSlots - Maximum visible slots per cell (from getMonthSlotCount)
 * @returns Map from date ISO string to MonthDayCellLayout
 */
export function calculateMonthCellLayout(
  weekRows: MonthWeekRow[],
  events: CalendarEvent[],
  maxSlots: number,
): Map<string, MonthDayCellLayout> {
  const result = new Map<string, MonthDayCellLayout>();

  // Separate multi-day/all-day events from timed events
  const spanningEvents = events.filter((e) => e.isAllDay || isMultiDayEvent(e));
  const timedEvents = events.filter((e) => !e.isAllDay && !isMultiDayEvent(e));

  // Sort spanning events: longer duration first, then alphabetically
  const sortedSpanning = [...spanningEvents].sort((a, b) => {
    const durationA = a.end.getTime() - a.start.getTime();
    const durationB = b.end.getTime() - b.start.getTime();
    if (durationB !== durationA) return durationB - durationA;
    return a.title.localeCompare(b.title);
  });

  for (const weekRow of weekRows) {
    const { days } = weekRow;
    const weekStart = startOfDay(days[0].date);
    const weekEnd = addDays(startOfDay(days[days.length - 1].date), 1);

    // Find spanning events that overlap this week
    const weekSpanningEvents = sortedSpanning.filter(
      (e) => e.start < weekEnd && e.end > weekStart,
    );

    // Allocate slot indices for spanning events within this week row.
    // Each event gets a stable slot index that's the same across all cells it spans.
    // occupiedSlots[slotIndex] = array of { startCol, endCol } ranges
    const occupiedSlots: { startCol: number; endCol: number }[][] = [];

    interface SpanningAllocation {
      event: CalendarEvent;
      slotIndex: number;
      startCol: number;
      endCol: number;
    }
    const spanningAllocations: SpanningAllocation[] = [];

    for (const event of weekSpanningEvents) {
      // Determine which columns this event spans in this week row
      let startCol = -1;
      let endCol = -1;

      for (let i = 0; i < days.length; i++) {
        const dayStart = startOfDay(days[i].date);
        const dayEnd = addDays(dayStart, 1);

        if (event.start < dayEnd && event.end > dayStart) {
          if (startCol === -1) startCol = i;
          endCol = i;
        }
      }

      if (startCol === -1) continue;

      // Find first slot that doesn't conflict with this column range
      let targetSlot = 0;
      let found = false;
      while (!found) {
        if (!occupiedSlots[targetSlot]) {
          occupiedSlots[targetSlot] = [];
        }
        const hasConflict = occupiedSlots[targetSlot].some(
          (range) => !(endCol < range.startCol || startCol > range.endCol),
        );
        if (!hasConflict) {
          found = true;
        } else {
          targetSlot++;
        }
      }

      occupiedSlots[targetSlot].push({ startCol, endCol });
      spanningAllocations.push({
        event,
        slotIndex: targetSlot,
        startCol,
        endCol,
      });
    }

    // Now build each day cell's layout
    for (let colIdx = 0; colIdx < days.length; colIdx++) {
      const day = days[colIdx];
      const dayKey = startOfDay(day.date).toISOString();
      const dayStart = startOfDay(day.date);
      const dayEnd = addDays(dayStart, 1);

      // Get spanning events allocated to slots that cover this column
      const spanningForDay = spanningAllocations
        .filter((a) => colIdx >= a.startCol && colIdx <= a.endCol)
        .sort((a, b) => a.slotIndex - b.slotIndex);

      // Get timed events for this day
      const timedForDay = timedEvents
        .filter((e) => e.start < dayEnd && e.end > dayStart)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      const totalEvents = spanningForDay.length + timedForDay.length;
      const slots: MonthCellSlot[] = [];

      // Determine how many spanning event slots we need
      const maxSpanSlot =
        spanningForDay.length > 0
          ? Math.max(...spanningForDay.map((a) => a.slotIndex))
          : -1;
      const spanSlotCount = maxSpanSlot + 1;

      // Check if we need a "+N more" row
      const needsMore = totalEvents > maxSlots;
      const availableForTimed = needsMore
        ? maxSlots - spanSlotCount - 1 // reserve 1 for "+N more"
        : maxSlots - spanSlotCount;

      // Fill spanning event slots (with spacers for empty indices)
      for (let slotIdx = 0; slotIdx < spanSlotCount; slotIdx++) {
        if (slotIdx >= maxSlots - (needsMore ? 1 : 0)) break;

        const allocation = spanningForDay.find((a) => a.slotIndex === slotIdx);
        if (allocation) {
          const isStartCell = colIdx === allocation.startCol;
          const colSpan = allocation.endCol - allocation.startCol + 1;

          // Rounding: round left if event starts on or before this cell's day
          const eventStartDay = startOfDay(allocation.event.start);
          const eventEndDay = startOfDay(allocation.event.end);
          const roundedLeft =
            isSameDay(eventStartDay, day.date) ||
            (eventStartDay >= dayStart && colIdx === allocation.startCol);
          const roundedRight =
            isSameDay(eventEndDay, day.date) || colIdx === allocation.endCol;

          slots.push({
            type: "event-bar",
            event: allocation.event,
            colSpan,
            isStart: isStartCell,
            roundedLeft:
              (colIdx === allocation.startCol &&
                isSameDay(allocation.event.start, day.date)) ||
              (colIdx === 0 && allocation.event.start < dayStart),
            roundedRight:
              (colIdx === allocation.endCol &&
                (isSameDay(allocation.event.end, day.date) ||
                  allocation.event.end <= dayEnd)) ||
              (colIdx === days.length - 1 && allocation.event.end > dayEnd),
          });
        } else {
          slots.push({ type: "spacer" });
        }
      }

      // Fill timed event slots
      const timedToShow =
        availableForTimed > 0
          ? timedForDay.slice(0, Math.max(0, availableForTimed))
          : [];

      for (const event of timedToShow) {
        slots.push({ type: "event-item", event });
      }

      // Add "+N more" if needed
      if (needsMore) {
        const hiddenCount = totalEvents - (spanSlotCount + timedToShow.length);
        if (hiddenCount > 0) {
          slots.push({ type: "more", count: hiddenCount });
        }
      }

      result.set(dayKey, {
        date: day.date,
        slots,
        totalEvents,
      });
    }
  }

  return result;
}
```

- [ ] **Step 3: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/lib/event-utils.ts
git commit -m "feat: add generateMonthGrid and calculateMonthCellLayout utilities"
```

---

### Task 4: Create `MonthViewEventItem` (timed event line)

**Files:**

- Create: `src/components/month-view-event-item.tsx`

The simplest rendering component — a single text line: colored dot + time + title.

- [ ] **Step 1: Create the component**

Create `src/components/month-view-event-item.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { CalendarEvent, EventColor } from "./calendar-types";

/** Color dot styles matching the event color palette */
const dotColorStyles: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
};

export interface MonthViewEventItemProps {
  event: CalendarEvent;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  className?: string;
}

/**
 * Formats time for month view: "9 AM", "2:30 PM" (no leading zero)
 */
function formatMonthTime(date: Date): string {
  const minutes = date.getMinutes();
  if (minutes === 0) {
    return format(date, "h a");
  }
  return format(date, "h:mm a");
}

/**
 * Timed event rendered as a single line in a month day cell.
 * Layout: [colored dot] [time] [title]
 */
export function MonthViewEventItem({
  event,
  isSelected,
  onClick,
  onContextMenu,
  onDragMouseDown,
  className,
}: MonthViewEventItemProps) {
  const color = event.color ?? "blue";
  const dotStyle = dotColorStyles[color];

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick?.(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, event);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onDragMouseDown?.(e, event);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(event);
        }
      }}
      className={cn(
        "flex items-center gap-1 px-1 py-0.5 rounded-sm cursor-pointer",
        "text-xs leading-tight truncate select-none",
        "hover:bg-accent/50",
        isSelected && "bg-primary/20 ring-1 ring-primary/40",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dotStyle)} />
      <span className="text-muted-foreground shrink-0">
        {formatMonthTime(event.start)}
      </span>
      <span className="truncate text-foreground">{event.title}</span>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/month-view-event-item.tsx
git commit -m "feat: add MonthViewEventItem component"
```

---

### Task 5: Create `MonthViewEventBar` (all-day/multi-day bar)

**Files:**

- Create: `src/components/month-view-event-bar.tsx`

Colored horizontal bar for all-day and multi-day events in the month grid.

- [ ] **Step 1: Create the component**

Create `src/components/month-view-event-bar.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "./calendar-types";

const barColorStyles: Record<
  EventColor,
  { bg: string; bgHover: string; border: string; text: string }
> = {
  red: {
    bg: "bg-event-red-bg",
    bgHover: "hover:bg-event-red-bg/70",
    border: "bg-event-red-border",
    text: "text-event-red",
  },
  orange: {
    bg: "bg-event-orange-bg",
    bgHover: "hover:bg-event-orange-bg/70",
    border: "bg-event-orange-border",
    text: "text-event-orange",
  },
  yellow: {
    bg: "bg-event-yellow-bg",
    bgHover: "hover:bg-event-yellow-bg/70",
    border: "bg-event-yellow-border",
    text: "text-event-yellow",
  },
  green: {
    bg: "bg-event-green-bg",
    bgHover: "hover:bg-event-green-bg/70",
    border: "bg-event-green-border",
    text: "text-event-green",
  },
  blue: {
    bg: "bg-event-blue-bg",
    bgHover: "hover:bg-event-blue-bg/70",
    border: "bg-event-blue-border",
    text: "text-event-blue",
  },
  purple: {
    bg: "bg-event-purple-bg",
    bgHover: "hover:bg-event-purple-bg/70",
    border: "bg-event-purple-border",
    text: "text-event-purple",
  },
  gray: {
    bg: "bg-event-gray-bg",
    bgHover: "hover:bg-event-gray-bg/70",
    border: "bg-event-gray-border",
    text: "text-event-gray",
  },
};

export interface MonthViewEventBarProps {
  event: CalendarEvent;
  /** Number of columns this bar spans */
  colSpan: number;
  /** Whether to round the left edge */
  roundedLeft: boolean;
  /** Whether to round the right edge */
  roundedRight: boolean;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  className?: string;
}

/**
 * Colored horizontal bar for all-day/multi-day events in the month grid.
 * Spans multiple columns via CSS grid or absolute positioning from the parent.
 */
export function MonthViewEventBar({
  event,
  colSpan,
  roundedLeft,
  roundedRight,
  isSelected,
  onClick,
  onContextMenu,
  onDragMouseDown,
  className,
}: MonthViewEventBarProps) {
  const color = event.color ?? "blue";
  const styles = barColorStyles[color];

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick?.(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, event);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onDragMouseDown?.(e, event);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(event);
        }
      }}
      className={cn(
        "relative h-5 px-1 py-0.5 cursor-pointer",
        "overflow-hidden select-none flex items-center",
        "hover:z-10 focus:outline-none focus-visible:outline-none",
        roundedLeft && "rounded-l-sm",
        roundedRight && "rounded-r-sm",
        isSelected && "z-20",
        className,
      )}
    >
      {/* Solid background */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          roundedLeft && "rounded-l-sm",
          roundedRight && "rounded-r-sm",
        )}
      />
      {/* Color layer */}
      <div
        className={cn(
          "absolute inset-0",
          isSelected ? styles.border : styles.bg,
          roundedLeft && "rounded-l-sm",
          roundedRight && "rounded-r-sm",
        )}
      />
      {/* Left border accent */}
      {roundedLeft && !isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] dark:bg-white dark:mix-blend-overlay",
            roundedLeft && "rounded-l-sm",
            styles.border,
          )}
        />
      )}
      {/* Title */}
      <span
        className={cn(
          "relative text-[0.625rem] font-medium leading-tight truncate",
          roundedLeft && "pl-0.5",
          isSelected
            ? "text-white dark:text-white"
            : cn(styles.text, "dark:text-white/80"),
        )}
      >
        {event.title}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/month-view-event-bar.tsx
git commit -m "feat: add MonthViewEventBar component"
```

---

### Task 6: Create `MonthViewDayCell` (individual day cell)

**Files:**

- Create: `src/components/month-view-day-cell.tsx`

Renders a single day in the month grid: day number, event slots, "+N more".

- [ ] **Step 1: Create the component**

Create `src/components/month-view-day-cell.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { isToday, isSameMonth } from "date-fns";
import type { CalendarEvent } from "./calendar-types";
import type { MonthCellSlot } from "@/lib/event-utils";
import { MonthViewEventItem } from "./month-view-event-item";
import { MonthViewEventBar } from "./month-view-event-bar";

export interface MonthViewDayCellProps {
  date: Date;
  /** The reference month (for dimming adjacent months) */
  currentMonth: Date;
  slots: MonthCellSlot[];
  totalEvents: number;
  onEventClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onMoreClick?: (date: Date) => void;
  onBackgroundClick?: () => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  selectedEventId?: string;
  className?: string;
}

/**
 * Individual day cell in the month grid.
 * Renders day number, event bars, event items, and "+N more" button.
 */
export function MonthViewDayCell({
  date,
  currentMonth,
  slots,
  totalEvents,
  onEventClick,
  onContextMenu,
  onMoreClick,
  onBackgroundClick,
  onDragMouseDown,
  selectedEventId,
  className,
}: MonthViewDayCellProps) {
  const isCurrentMonth = isSameMonth(date, currentMonth);
  const isTodayDate = isToday(date);

  function handleCellClick(e: React.MouseEvent) {
    // Only fire if clicking the cell background, not an event
    if ((e.target as HTMLElement).closest("[role=button]")) return;
    onBackgroundClick?.();
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden border-b border-r border-border",
        !isCurrentMonth && "opacity-50",
        className,
      )}
      onClick={handleCellClick}
    >
      {/* Day number header */}
      <div className="flex items-center justify-center py-0.5">
        <span
          className={cn(
            "flex size-6 items-center justify-center text-xs",
            isTodayDate
              ? "rounded-full bg-primary text-primary-foreground font-medium"
              : "text-foreground",
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Event slots */}
      <div className="flex flex-col gap-px px-0.5 pb-0.5 min-h-0 flex-1">
        {slots.map((slot, index) => {
          if (slot.type === "spacer") {
            return <div key={`spacer-${index}`} className="h-5 shrink-0" />;
          }

          if (slot.type === "event-bar") {
            if (!slot.isStart) {
              // Continuation cell — render empty placeholder to maintain slot height
              return (
                <div
                  key={`bar-cont-${slot.event.id}-${index}`}
                  className="h-5 shrink-0"
                />
              );
            }
            return (
              <MonthViewEventBar
                key={`bar-${slot.event.id}`}
                event={slot.event}
                colSpan={slot.colSpan}
                roundedLeft={slot.roundedLeft}
                roundedRight={slot.roundedRight}
                isSelected={slot.event.id === selectedEventId}
                onClick={onEventClick}
                onContextMenu={onContextMenu}
                onDragMouseDown={onDragMouseDown}
              />
            );
          }

          if (slot.type === "event-item") {
            return (
              <MonthViewEventItem
                key={`item-${slot.event.id}`}
                event={slot.event}
                isSelected={slot.event.id === selectedEventId}
                onClick={onEventClick}
                onContextMenu={onContextMenu}
                onDragMouseDown={onDragMouseDown}
              />
            );
          }

          if (slot.type === "more") {
            return (
              <button
                key="more"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMoreClick?.(date);
                }}
                className={cn(
                  "px-1 py-0.5 text-xs text-muted-foreground",
                  "hover:text-foreground hover:bg-accent/50 rounded-sm",
                  "text-left cursor-pointer select-none",
                )}
              >
                {slot.count} more
              </button>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/month-view-day-cell.tsx
git commit -m "feat: add MonthViewDayCell component"
```

---

### Task 7: Create `MonthViewGrid` (week rows with cell height measurement)

**Files:**

- Create: `src/components/month-view-grid.tsx`

The grid component that renders week rows, measures cell height, and computes slot counts.

- [ ] **Step 1: Create the component**

Create `src/components/month-view-grid.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { startOfDay } from "date-fns";
import type { CalendarEvent } from "./calendar-types";
import type { MonthWeekRow } from "@/lib/event-utils";
import {
  calculateMonthCellLayout,
  getMonthSlotCount,
  MONTH_EVENT_ROW_HEIGHT,
} from "@/lib/event-utils";
import { MonthViewDayCell } from "./month-view-day-cell";

export interface MonthViewGridProps {
  /** Week rows from generateMonthGrid() */
  weekRows: MonthWeekRow[];
  /** All calendar events */
  events: CalendarEvent[];
  /** The reference date (for current month determination) */
  currentMonth: Date;
  /** Show week numbers column */
  showWeekNumbers?: boolean;
  /** Show weekend columns */
  showWeekends?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onMoreClick?: (date: Date) => void;
  onBackgroundClick?: () => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  selectedEventId?: string;
  className?: string;
}

/**
 * Month grid: renders week rows with day cells.
 * Measures cell height to determine dynamic event slot count.
 */
export function MonthViewGrid({
  weekRows,
  events,
  currentMonth,
  showWeekNumbers,
  showWeekends = true,
  onEventClick,
  onContextMenu,
  onMoreClick,
  onBackgroundClick,
  onDragMouseDown,
  selectedEventId,
  className,
}: MonthViewGridProps) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [cellHeight, setCellHeight] = React.useState(120);

  // Measure cell height via ResizeObserver
  React.useEffect(() => {
    const container = gridRef.current;
    if (!container) return;

    const updateHeight = () => {
      const totalHeight = container.clientHeight;
      const rowCount = weekRows.length;
      if (rowCount > 0) {
        setCellHeight(totalHeight / rowCount);
      }
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);
    return () => observer.disconnect();
  }, [weekRows.length]);

  const maxSlots = getMonthSlotCount(cellHeight);

  const cellLayouts = React.useMemo(
    () => calculateMonthCellLayout(weekRows, events, maxSlots),
    [weekRows, events, maxSlots],
  );

  const columnCount = showWeekends ? 7 : 5;

  return (
    <div
      ref={gridRef}
      className={cn("flex-1 grid", className)}
      style={{
        gridTemplateRows: `repeat(${weekRows.length}, 1fr)`,
      }}
    >
      {weekRows.map((weekRow) => {
        const days = showWeekends
          ? weekRow.days
          : weekRow.days.filter(
              (d) => d.date.getDay() !== 0 && d.date.getDay() !== 6,
            );

        return (
          <div
            key={weekRow.weekNumber}
            className="grid min-h-0"
            style={{
              gridTemplateColumns: showWeekNumbers
                ? `2rem repeat(${columnCount}, 1fr)`
                : `repeat(${columnCount}, 1fr)`,
            }}
          >
            {showWeekNumbers && (
              <div className="flex items-start justify-center pt-1 text-xs text-muted-foreground border-b border-r border-border">
                {weekRow.weekNumber}
              </div>
            )}
            {days.map((day) => {
              const dayKey = startOfDay(day.date).toISOString();
              const layout = cellLayouts.get(dayKey);

              return (
                <MonthViewDayCell
                  key={dayKey}
                  date={day.date}
                  currentMonth={currentMonth}
                  slots={layout?.slots ?? []}
                  totalEvents={layout?.totalEvents ?? 0}
                  onEventClick={onEventClick}
                  onContextMenu={onContextMenu}
                  onMoreClick={onMoreClick}
                  onBackgroundClick={onBackgroundClick}
                  onDragMouseDown={onDragMouseDown}
                  selectedEventId={selectedEventId}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/month-view-grid.tsx
git commit -m "feat: add MonthViewGrid component"
```

---

### Task 8: Create `MonthView` orchestrator

**Files:**

- Create: `src/components/month-view.tsx`

The top-level month view component that receives props from `page.tsx` and assembles the grid.

- [ ] **Step 1: Create the component**

Create `src/components/month-view.tsx`:

```tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import type { CalendarEvent, ViewSettings } from "./calendar-types";
import { generateMonthGrid } from "@/lib/event-utils";
import { MonthViewGrid } from "./month-view-grid";
import { EventContextMenu } from "./event-context-menu";
import { CalendarPopoverBoundaryProvider } from "./calendar-popover-context";

export interface MonthViewProps {
  currentDate: Date;
  events?: CalendarEvent[];
  viewSettings?: ViewSettings;
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  onBackgroundClick?: () => void;
  onEventChange?: (event: CalendarEvent) => void;
  onMoreClick?: (date: Date) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  className?: string;
}

/** Day-of-week header labels */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * Month view orchestrator.
 * Computes the month grid and delegates rendering to MonthViewGrid.
 */
export function MonthView({
  currentDate,
  events = [],
  viewSettings,
  onEventClick,
  selectedEventId,
  onBackgroundClick,
  onEventChange,
  onMoreClick,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  className,
}: MonthViewProps) {
  const showWeekends = viewSettings?.showWeekends ?? true;
  const showWeekNumbers = viewSettings?.showWeekNumbers ?? false;

  const monthDate = startOfMonth(currentDate);
  const weekRows = React.useMemo(
    () => generateMonthGrid(monthDate),
    [monthDate],
  );

  // Filter events based on view settings
  const filteredEvents = React.useMemo(() => {
    if (viewSettings?.showDeclinedEvents === false) {
      // When we have a declined status, filter here.
      // For now, pass all events through.
      return events;
    }
    return events;
  }, [events, viewSettings?.showDeclinedEvents]);

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    event: CalendarEvent;
  } | null>(null);

  const handleContextMenu = React.useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      setContextMenu({ x: e.clientX, y: e.clientY, event });
    },
    [],
  );

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
  }, []);

  const calendarBoundaryRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);

  const dayNames = showWeekends ? DAY_NAMES : WEEKDAY_NAMES;
  const columnCount = dayNames.length;

  return (
    <CalendarPopoverBoundaryProvider
      boundaryRef={calendarBoundaryRef}
      headerRef={headerRef}
      view="month"
    >
      <div
        ref={calendarBoundaryRef}
        className={cn("flex h-full flex-col", className)}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-radix-popper-content-wrapper]")) return;
          if (target.closest("[role=button]")) return;
          if (target.closest("button")) return;
          onBackgroundClick?.();
        }}
      >
        {/* Day-of-week header */}
        <div
          ref={headerRef}
          className="grid border-b border-border bg-background flex-shrink-0"
          style={{
            gridTemplateColumns: showWeekNumbers
              ? `2rem repeat(${columnCount}, 1fr)`
              : `repeat(${columnCount}, 1fr)`,
          }}
        >
          {showWeekNumbers && <div />}
          {dayNames.map((name) => (
            <div
              key={name}
              className="flex items-center justify-center py-2 text-xs text-muted-foreground font-medium"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <MonthViewGrid
          weekRows={weekRows}
          events={filteredEvents}
          currentMonth={monthDate}
          showWeekNumbers={showWeekNumbers}
          showWeekends={showWeekends}
          onEventClick={onEventClick}
          onContextMenu={handleContextMenu}
          onMoreClick={onMoreClick}
          onBackgroundClick={onBackgroundClick}
          selectedEventId={selectedEventId}
        />

        {/* Context menu */}
        {contextMenu && (
          <EventContextMenu
            event={contextMenu.event}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={closeContextMenu}
            onEventChange={onEventChange}
          />
        )}
      </div>
    </CalendarPopoverBoundaryProvider>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/month-view.tsx
git commit -m "feat: add MonthView orchestrator component"
```

---

### Task 9: Integrate MonthView into `page.tsx`

**Files:**

- Modify: `src/app/page.tsx`

Wire up the MonthView, add month navigation, "+N more" click handler, and highlighted column state.

- [ ] **Step 1: Add imports and `highlightedDate` state**

In `src/app/page.tsx`, add the MonthView import:

```ts
import { MonthView } from "@/components/month-view";
import { addMonths, startOfMonth } from "date-fns";
```

(Merge `addMonths` and `startOfMonth` with existing date-fns imports.)

Add state for `highlightedDate` after the existing state declarations:

```ts
const [highlightedDate, setHighlightedDate] = React.useState<Date | null>(null);
```

- [ ] **Step 2: Update navigation functions for month view**

Update `goToToday`:

```ts
const goToToday = React.useCallback(() => {
  if (view === "day") {
    setCurrentDate(startOfDay(new Date()));
  } else if (view === "month") {
    setCurrentDate(startOfMonth(new Date()));
  } else {
    setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 0 }));
  }
}, [view]);
```

Update `goToPrev`:

```ts
const goToPrev = React.useCallback(() => {
  if (view === "day") {
    setCurrentDate((prev) => addDays(prev, -1));
  } else if (view === "month") {
    setCurrentDate((prev) => addMonths(prev, -1));
  } else {
    setCurrentDate((prev) => addWeeks(prev, -1));
  }
}, [view]);
```

Update `goToNext`:

```ts
const goToNext = React.useCallback(() => {
  if (view === "day") {
    setCurrentDate((prev) => addDays(prev, 1));
  } else if (view === "month") {
    setCurrentDate((prev) => addMonths(prev, 1));
  } else {
    setCurrentDate((prev) => addWeeks(prev, 1));
  }
}, [view]);
```

Update `switchView` to handle month:

```ts
const switchView = React.useCallback(
  (newView: ViewType) => {
    if (newView === view) return;
    setView(newView);
    if (newView === "day") {
      setCurrentDate(startOfDay(new Date()));
      return;
    }
    if (newView === "month") {
      setCurrentDate((prev) => startOfMonth(prev));
      return;
    }
    setCurrentDate((prev) => startOfWeek(prev, { weekStartsOn: 0 }));
  },
  [view],
);
```

- [ ] **Step 3: Add `handleMoreClick` callback**

```ts
const handleMoreClick = React.useCallback((date: Date) => {
  setView("week");
  setCurrentDate(startOfWeek(date, { weekStartsOn: 0 }));
  setHighlightedDate(date);
}, []);

// Clear highlightedDate after 2 seconds
React.useEffect(() => {
  if (!highlightedDate) return;
  const timer = setTimeout(() => setHighlightedDate(null), 2000);
  return () => clearTimeout(timer);
}, [highlightedDate]);
```

- [ ] **Step 4: Conditionally render MonthView or WeekView**

Replace the current `<WeekView ... />` block in the JSX with:

```tsx
<div className="flex flex-1 flex-col overflow-hidden">
  {view === "month" ? (
    <MonthView
      currentDate={currentDate}
      events={events}
      viewSettings={viewSettings}
      onEventClick={(e) => setSelectedEventId(e.id)}
      selectedEventId={selectedEvent?.id}
      onBackgroundClick={() => setSelectedEventId(null)}
      onEventChange={handleEventChange}
      onMoreClick={handleMoreClick}
      isSidebarOpen={rightSidebarOpen}
      onDockToSidebar={() => {
        if (!rightSidebarOpen) toggleSidebar();
      }}
      onClosePopover={() => setSelectedEventId(null)}
    />
  ) : (
    <WeekView
      view={view}
      currentDate={currentDate}
      events={events}
      onEventClick={(e) => setSelectedEventId(e.id)}
      selectedEventId={selectedEvent?.id}
      onBackgroundClick={() => setSelectedEventId(null)}
      onDateChange={goToDate}
      onVisibleDaysChange={setVisibleDays}
      onEventChange={handleEventChange}
      isSidebarOpen={rightSidebarOpen}
      onDockToSidebar={() => {
        if (!rightSidebarOpen) toggleSidebar();
      }}
      onClosePopover={() => setSelectedEventId(null)}
      onPrevWeek={goToPrev}
      onNextWeek={goToNext}
    />
  )}
</div>
```

- [ ] **Step 5: Update header to show month/year for month view**

The header already has `{view === "month" && format(currentDate, "MMMM")}` for the subtext. Verify it renders correctly. The `monthName` and `year` variables from `getCalendarHeaderInfo` may need updating for month view since `visibleDays[0]` might not be set when in month view. Add a fallback:

```ts
const headerDate =
  view === "month" ? currentDate : (visibleDays[0] ?? currentDate);
const { monthName, year, weekNumber } = getCalendarHeaderInfo(headerDate, 0);
```

- [ ] **Step 6: Update prev/next button aria labels**

Update the sr-only text for prev/next buttons to include "month":

```tsx
<span className="sr-only">
  {view === "day"
    ? "Previous day"
    : view === "month"
      ? "Previous month"
      : "Previous week"}
</span>
```

```tsx
<span className="sr-only">
  {view === "day" ? "Next day" : view === "month" ? "Next month" : "Next week"}
</span>
```

- [ ] **Step 7: Verify typecheck and lint pass**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck && pnpm lint
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/app/page.tsx
git commit -m "feat: integrate MonthView into page with navigation and more-click"
```

---

### Task 10: Add mock events for month view testing

**Files:**

- Modify: `src/lib/mock-events.ts`

Add multi-day events that span week boundaries and several all-day events to exercise the month view layout.

- [ ] **Step 1: Add month-view-friendly mock events**

In `src/lib/mock-events.ts`, add the following events inside the `generateMockEvents` function (after the existing events, before the return):

```ts
// Multi-day event spanning a week boundary (for month view testing)
const monthViewMultiDay = new Date(baseDate);
monthViewMultiDay.setDate(
  baseDate.getDate() + ((4 - baseDate.getDay() + 7) % 7),
); // Thursday
const multiDayStart = new Date(monthViewMultiDay);
multiDayStart.setHours(0, 0, 0, 0);
const multiDayEnd = new Date(multiDayStart);
multiDayEnd.setDate(multiDayEnd.getDate() + 4); // Thu-Mon (spans weekend)

events.push({
  id: "multi-day-spanning",
  title: "Team Offsite",
  start: multiDayStart,
  end: multiDayEnd,
  isAllDay: true,
  color: "purple" as EventColor,
  calendarId: "cal1",
  description: "Annual team offsite spanning Thu-Mon",
  timezone: "America/Sao_Paulo",
  status: "busy" as const,
  visibility: "default" as const,
});

// All-day event on a single day
const allDaySingle = new Date(baseDate);
allDaySingle.setDate(baseDate.getDate() + 2);
events.push({
  id: "all-day-single",
  title: "Company Holiday",
  start: startOfDay(allDaySingle),
  end: startOfDay(allDaySingle),
  isAllDay: true,
  color: "green" as EventColor,
  calendarId: "cal1",
  timezone: "America/Sao_Paulo",
  status: "free" as const,
  visibility: "default" as const,
});
```

(Adjust based on existing patterns in the file — the key is to have at least one multi-day event spanning a week boundary and one single-day all-day event.)

- [ ] **Step 2: Verify app builds**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/lib/mock-events.ts
git commit -m "feat: add month-view-friendly mock events"
```

---

### Task 11: Create `useMonthEventDrag` hook

**Files:**

- Create: `src/hooks/use-month-event-drag.ts`

Day-snapping drag for moving events in the month view. Timed events change date but keep time; all-day events shift start date preserving duration.

- [ ] **Step 1: Create the hook**

Create `src/hooks/use-month-event-drag.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import type { CalendarEvent } from "@/components/calendar-types";

/** State exposed to the month view during drag */
export interface MonthDragState {
  eventId: string;
  event: CalendarEvent;
  originalDate: Date;
  targetDate: Date;
  isDragging: boolean;
}

interface UseMonthEventDragOptions {
  /** Ref to the grid container for coordinate calculations */
  gridRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
  /** Number of columns (5 or 7 depending on showWeekends) */
  columnCount: number;
  /** Number of rows */
  rowCount: number;
}

interface UseMonthEventDragReturn {
  dragState: MonthDragState | null;
  handleDragMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void;
}

const DRAG_THRESHOLD_PX = 4;

interface DragInfo {
  eventId: string;
  event: CalendarEvent;
  startClientX: number;
  startClientY: number;
  isDragging: boolean;
}

/**
 * Hook for drag-to-move in month view.
 * Snaps to whole days. Timed events change date but keep time/duration.
 * All-day/multi-day events shift start date, preserving duration.
 */
export function useMonthEventDrag({
  gridRef,
  events,
  onEventChange,
  onEventClick,
  columnCount,
  rowCount,
}: UseMonthEventDragOptions): UseMonthEventDragReturn {
  const [dragState, setDragState] = useState<MonthDragState | null>(null);

  const dragRef = useRef<DragInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const eventsRef = useRef(events);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    onEventClickRef.current = onEventClick;
  }, [onEventClick]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const handleMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleMouseUpRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    if (handleMouseMoveRef.current) {
      window.removeEventListener("mousemove", handleMouseMoveRef.current);
    }
    if (handleMouseUpRef.current) {
      window.removeEventListener("mouseup", handleMouseUpRef.current);
    }
  }, []);

  useEffect(() => {
    handleMouseMoveRef.current = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaX = Math.abs(e.clientX - drag.startClientX);
      const deltaY = Math.abs(e.clientY - drag.startClientY);
      if (
        !drag.isDragging &&
        deltaX < DRAG_THRESHOLD_PX &&
        deltaY < DRAG_THRESHOLD_PX
      )
        return;

      if (!drag.isDragging) {
        drag.isDragging = true;
      }

      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const cellWidth = rect.width / columnCount;
      const cellHeight = rect.height / rowCount;

      const col = Math.floor((e.clientX - rect.left) / cellWidth);
      const row = Math.floor((e.clientY - rect.top) / cellHeight);
      const clampedCol = Math.max(0, Math.min(col, columnCount - 1));
      const clampedRow = Math.max(0, Math.min(row, rowCount - 1));

      // Calculate target date from grid position
      // The grid's first cell is the first day of the first visible week row
      const dayIndex = clampedRow * columnCount + clampedCol;

      // We need to get the actual date from the grid — store the first date
      // For now, compute the day delta from the event's original position
      const originalDate = startOfDay(drag.event.start);

      // Find original position in the grid
      const firstCellElements = grid.querySelectorAll("[data-date]");
      const dates: Date[] = [];
      firstCellElements.forEach((el) => {
        const dateStr = el.getAttribute("data-date");
        if (dateStr) dates.push(new Date(dateStr));
      });

      if (dates.length > dayIndex) {
        const targetDate = dates[dayIndex];
        setDragState({
          eventId: drag.eventId,
          event: drag.event,
          originalDate,
          targetDate,
          isDragging: true,
        });
      }
    };

    handleMouseUpRef.current = () => {
      const drag = dragRef.current;
      if (!drag) return;

      cleanup();

      if (drag.isDragging) {
        setDragState((prev) => {
          if (!prev) return null;

          const event = eventsRef.current.find((e) => e.id === drag.eventId);
          if (!event) return null;

          const daysDelta = differenceInCalendarDays(
            prev.targetDate,
            prev.originalDate,
          );
          if (daysDelta !== 0) {
            onEventChangeRef.current?.({
              ...event,
              start: addDays(event.start, daysDelta),
              end: addDays(event.end, daysDelta),
            });
          }

          return null;
        });
      } else {
        setDragState(null);
      }

      dragRef.current = null;
    };
  }, [gridRef, cleanup, columnCount, rowCount]);

  const handleDragMouseDown = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      if (e.button !== 0) return;

      onEventClickRef.current?.(event);

      dragRef.current = {
        eventId: event.id,
        event,
        startClientX: e.clientX,
        startClientY: e.clientY,
        isDragging: false,
      };

      setDragState({
        eventId: event.id,
        event,
        originalDate: startOfDay(event.start),
        targetDate: startOfDay(event.start),
        isDragging: false,
      });

      if (handleMouseMoveRef.current) {
        window.addEventListener("mousemove", handleMouseMoveRef.current);
      }
      if (handleMouseUpRef.current) {
        window.addEventListener("mouseup", handleMouseUpRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { dragState, handleDragMouseDown };
}
```

- [ ] **Step 2: Wire drag into MonthViewGrid**

In `src/components/month-view-grid.tsx`, the `onDragMouseDown` prop is already passed through to day cells. The parent `MonthView` needs to create the hook and pass handlers. Update `src/components/month-view.tsx` to use the hook:

Add import:

```ts
import { useMonthEventDrag } from "@/hooks/use-month-event-drag";
```

Inside the `MonthView` component, add:

```ts
const gridRef = React.useRef<HTMLDivElement>(null);
const columnCount = showWeekends ? 7 : 5;

const { dragState, handleDragMouseDown } = useMonthEventDrag({
  gridRef,
  events: filteredEvents,
  onEventChange,
  onEventClick,
  columnCount,
  rowCount: weekRows.length,
});
```

Pass `gridRef` to `MonthViewGrid` (add a `gridRef` prop to `MonthViewGridProps` and forward it to the grid's root div `ref`).

Pass `handleDragMouseDown` as the `onDragMouseDown` prop to `MonthViewGrid`.

- [ ] **Step 3: Add `data-date` attributes to day cells for drag coordinate lookup**

In `src/components/month-view-day-cell.tsx`, add a `data-date` attribute to the root div:

```tsx
<div
  data-date={date.toISOString()}
  className={cn(
    "flex flex-col overflow-hidden border-b border-r border-border",
    ...
  )}
>
```

- [ ] **Step 4: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/hooks/use-month-event-drag.ts src/components/month-view.tsx src/components/month-view-grid.tsx src/components/month-view-day-cell.tsx
git commit -m "feat: add useMonthEventDrag hook and wire into month view"
```

---

### Task 12: Add column highlight animation for "+N more" navigation

**Files:**

- Modify: `src/components/week-view.tsx`
- Modify: `src/app/globals.css`

When clicking "+N more" in month view, the week view should highlight the target day column with a 2-second background fade.

- [ ] **Step 1: Add `highlightedDate` prop to WeekView**

In `src/components/week-view-types.ts`, add to `WeekViewProps`:

```ts
/** Date to highlight with a temporary background animation (for "+N more" navigation) */
highlightedDate?: Date | null;
```

In `src/components/week-view.tsx`, destructure the new prop and pass it to `WeekViewGrid`:

```ts
export function WeekView({
  // ... existing props
  highlightedDate,
}: WeekViewProps) {
```

- [ ] **Step 2: Add highlight CSS class**

In `src/app/globals.css`, add:

```css
@keyframes column-highlight-fade {
  from {
    background-color: var(--color-primary) / 0.08;
  }
  to {
    background-color: transparent;
  }
}

.column-highlight {
  animation: column-highlight-fade 2s ease-out forwards;
}
```

- [ ] **Step 3: Apply highlight class in WeekViewGrid**

In `src/components/week-view-grid.tsx`, when rendering day columns, check if the day matches `highlightedDate` and apply the `column-highlight` class. Add `highlightedDate` to `WeekViewGridProps` and pass it through from `WeekView`.

- [ ] **Step 4: Pass `highlightedDate` from `page.tsx` to `WeekView`**

In `src/app/page.tsx`, add to the `<WeekView>` JSX:

```tsx
highlightedDate = { highlightedDate };
```

- [ ] **Step 5: Verify typecheck passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm typecheck
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add src/components/week-view.tsx src/components/week-view-types.ts src/components/week-view-grid.tsx src/app/page.tsx src/app/globals.css
git commit -m "feat: add column highlight animation for more-click navigation"
```

---

### Task 13: Visual polish and edge cases

**Files:**

- Modify: Various month view components

Final pass for visual refinement and edge case handling.

- [ ] **Step 1: Weekend background in month grid**

In `src/components/month-view-day-cell.tsx`, add weekend background:

```tsx
const isWeekend = date.getDay() === 0 || date.getDay() === 6;
```

Add to the root div className:

```tsx
isWeekend && "bg-calendar-weekend",
```

- [ ] **Step 2: Ensure multi-day bars span columns visually**

The current `MonthViewDayCell` renders bars within a single cell. For multi-day bars to visually span columns, the bars with `isStart: true` need to use absolute positioning that extends beyond their cell boundary. Update the bar rendering in `MonthViewDayCell`:

For `event-bar` slots where `isStart` is true and `colSpan > 1`:

```tsx
<div
  className="absolute left-0"
  style={{
    width: `${slot.colSpan * 100}%`,
    zIndex: 1,
  }}
>
  <MonthViewEventBar ... />
</div>
```

The slot container for bars needs `position: relative` and `overflow: visible` so bars can extend beyond cell boundaries.

- [ ] **Step 3: Handle `showDeclinedEvents` filtering**

If/when declined event status is added, the filter in `MonthView` is already in place. No action needed now.

- [ ] **Step 4: Verify full build passes**

Run:

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm lint && pnpm typecheck && pnpm format:check
```

Expected: All PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add -A
git commit -m "feat: visual polish for month view - weekends, spanning bars, edge cases"
```

---

### Task 14: Manual testing and final verification

- [ ] **Step 1: Start dev server and test month view**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm dev
```

Verify:

- Press `M` to switch to month view — grid renders with correct number of weeks
- Today's date has accent circle
- Adjacent month days are dimmed
- Events appear in correct cells
- Multi-day bars span across columns
- "+N more" appears when events exceed slot count
- Clicking "+N more" switches to week view with column highlight
- Press `J`/`K` to navigate months
- Press `T` to go to today
- Toggle weekends on/off (Shift+Cmd+E)
- Toggle week numbers
- Event click opens popover/selects in sidebar
- Right-click opens context menu
- Drag events between days

- [ ] **Step 2: Test responsive behavior**

- Resize browser window smaller — slot count should decrease, more events overflow
- Resize larger — more events visible per cell
- Test with 5-week and 6-week months

- [ ] **Step 3: Verify week view still works**

- Press `W` to switch back to week view
- All existing functionality intact: drag, resize, scroll, all-day row, popovers

- [ ] **Step 4: Final lint/typecheck/format**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view && pnpm lint && pnpm typecheck && pnpm format:check
```

Fix any issues found.

- [ ] **Step 5: Commit any fixes**

```bash
cd /Users/victornogueira/fun/calendarcn/.claude/worktrees/feat-month-view
git add -A
git commit -m "fix: address issues found during manual testing"
```
