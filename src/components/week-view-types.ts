import type React from "react";

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
 * Props for the main WeekView component
 */
export interface WeekViewProps {
  /** Reference date to show the week for. Defaults to today */
  currentDate?: Date;
  /** Day the week starts on. Defaults to 0 (Sunday) */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Events to display on the calendar */
  events?: CalendarEvent[];
  /** Optional click handler for events */
  onEventClick?: (event: CalendarEvent) => void;
  /** ID of the currently selected event */
  selectedEventId?: string;
  /** Callback when clicking empty calendar space (not on an event) */
  onBackgroundClick?: () => void;
  /** Callback when the displayed date changes (via scroll navigation) */
  onDateChange?: (date: Date) => void;
  /** Callback when the visible days change during scroll (real-time updates) */
  onVisibleDaysChange?: (days: Date[]) => void;
  /** Callback when an event is changed (e.g. dragged to a new time) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Set of event IDs with unsaved changes */
  dirtyEventIds?: Set<string>;
  /** Optional className for the root element */
  className?: string;
}

/**
 * Props for the WeekViewDayColumns component
 */
export interface WeekViewDayColumnsProps {
  /** Array of days to display */
  days: WeekDay[];
  /** When true, renders without the timezone/grid wrapper (used in scroll container) */
  standalone?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Props for the WeekViewTimeAxis component
 */
export interface WeekViewTimeAxisProps {
  /** Array of hour slots to display */
  hours: HourSlot[];
  /** Height of each hour row in pixels */
  hourHeight: number;
  /** Optional className */
  className?: string;
}

/**
 * Props for the WeekViewGrid component
 */
export interface WeekViewGridProps {
  /** Array of days for columns */
  days: WeekDay[];
  /** Array of hour slots for rows */
  hours: HourSlot[];
  /** Height of each hour row in pixels */
  hourHeight: number;
  /** Events to display on the grid */
  events?: CalendarEvent[];
  /** Optional click handler for events */
  onEventClick?: (event: CalendarEvent) => void;
  /** ID of the currently selected event */
  selectedEventId?: string;
  /** Current drag state if an event is being dragged */
  dragState?: EventDragState;
  /** Mousedown handler to initiate event drag */
  onEventDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Set of event IDs with unsaved changes */
  dirtyEventIds?: Set<string>;
  /** Optional className */
  className?: string;
}

/**
 * Props for the WeekViewTimeIndicator component
 */
export interface WeekViewTimeIndicatorProps {
  /** Array of days in the current week view */
  days: WeekDay[];
  /** Height of each hour row in pixels */
  hourHeight: number;
  /** Buffered days array for scroll-synchronized line rendering */
  scrollDays?: WeekDay[];
  /** Scroll transform style to apply to the lines */
  scrollStyle?: React.CSSProperties;
  /** Whether to render behind selected events */
  behindSelection?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * Props for the WeekViewAllDayRow component
 */
export interface WeekViewAllDayRowProps {
  /** Array of days to display */
  days: WeekDay[];
  /** All-day events to display */
  allDayEvents?: CalendarEvent[];
  /** Optional click handler for events */
  onEventClick?: (event: CalendarEvent) => void;
  /** ID of the currently selected event */
  selectedEventId?: string;
  /** Optional scroll transform style for horizontal scroll sync */
  scrollStyle?: React.CSSProperties;
  /** Optional className */
  className?: string;
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
  /** Original start time before drag */
  originalStart: Date;
  /** Original end time before drag */
  originalEnd: Date;
  /** Current snapped start time during drag */
  currentStart: Date;
  /** Current snapped end time during drag */
  currentEnd: Date;
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
 * Props for the CalendarEventItem component
 */
export interface CalendarEventItemProps {
  /** The positioned event to render */
  positionedEvent: PositionedEvent;
  /** Height of each hour in pixels */
  hourHeight: number;
  /** Whether the event is in the past */
  isPast?: boolean;
  /** Whether the event is currently selected */
  isSelected?: boolean;
  /** Optional click handler */
  onClick?: (event: CalendarEvent) => void;
  /** Drag variant for visual state during drag */
  dragVariant?: EventDragVariant;
  /** Whether this event has unsaved changes */
  isDirty?: boolean;
  /** Override start time (for dragging/placeholder positioning) */
  overrideStart?: Date;
  /** Override end time (for dragging/placeholder positioning) */
  overrideEnd?: Date;
  /** Mousedown handler to initiate drag */
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Raw cursor Y position for smooth dragging copy */
  cursorY?: number;
  /** Raw cursor X position for smooth dragging copy */
  cursorX?: number;
  /** Fixed width in px (for free-floating dragging copy) */
  fixedWidth?: number;
  /** Fixed height in px (for free-floating dragging copy) */
  fixedHeight?: number;
  /** Optional className */
  className?: string;
}
