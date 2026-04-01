import type React from "react";

/**
 * Calendar view mode — "day" shows a single column, "week" shows 7 columns
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
 * Represents a single day in the week view
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
