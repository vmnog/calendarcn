import type React from "react";

import type {
  AllDayResizeState,
  CalendarEvent,
  EventDragState,
  EventDragVariant,
  EventResizeState,
  HourSlot,
  PositionedEvent,
  ViewType,
  WeekDay,
} from "./calendar-types";

// Re-export all shared types for backward compatibility
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

/**
 * Props for the main WeekView component
 */
export interface WeekViewProps {
  /** Calendar view mode. Defaults to "week" */
  view?: ViewType;
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
  /** Whether the right sidebar is open */
  isSidebarOpen?: boolean;
  /** Callback to dock popover to sidebar (opens sidebar) */
  onDockToSidebar?: () => void;
  /** Callback to close popover (deselect event) */
  onClosePopover?: () => void;
  /** Navigate to previous week */
  onPrevWeek?: () => void;
  /** Navigate to next week */
  onNextWeek?: () => void;
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
  /** Current resize state if an event is being resized */
  resizeState?: EventResizeState;
  /** Mousedown handler to initiate event resize */
  onEventResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  /** Whether the right sidebar is open */
  isSidebarOpen?: boolean;
  /** Callback to dock popover to sidebar */
  onDockToSidebar?: () => void;
  /** Callback to close popover */
  onClosePopover?: () => void;
  /** Navigate to previous week */
  onPrevWeek?: () => void;
  /** Navigate to next week */
  onNextWeek?: () => void;
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
  /** Current all-day resize state */
  allDayResizeState?: AllDayResizeState;
  /** Mousedown handler to initiate all-day event resize or drag */
  onAllDayResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "left" | "right" | "move",
    startColumn: number,
    endColumn: number,
  ) => void;
  /** Callback when an event is changed */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  /** Ref to attach to the scroll content div for column measurements */
  allDayScrollContentRef?: React.RefObject<HTMLDivElement | null>;
  /** Whether the right sidebar is open */
  isSidebarOpen?: boolean;
  /** Callback to dock popover to sidebar */
  onDockToSidebar?: () => void;
  /** Callback to close popover */
  onClosePopover?: () => void;
  /** Navigate to previous week */
  onPrevWeek?: () => void;
  /** Navigate to next week */
  onNextWeek?: () => void;
  /** Index of the first visible column (used to skip buffer-only events in day view) */
  visibleStartIndex?: number;
  /** Number of visible columns (defaults to days.length when omitted) */
  visibleCount?: number;
  /** Width of a single day column in pixels (for floating drag copy sizing) */
  dayColumnWidth?: number;
  /** Optional className */
  className?: string;
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
  /** Override start time (for dragging/placeholder positioning) */
  overrideStart?: Date;
  /** Override end time (for dragging/placeholder positioning) */
  overrideEnd?: Date;
  /** Mousedown handler to initiate drag */
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  /** Mousedown handler to initiate resize */
  onResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
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
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  /** Whether the right sidebar is open (controls popover visibility) */
  isSidebarOpen?: boolean;
  /** Callback to dock popover to sidebar */
  onDockToSidebar?: () => void;
  /** Callback to close popover (deselect event) */
  onClosePopover?: () => void;
  /** Navigate to previous week */
  onPrevWeek?: () => void;
  /** Navigate to next week */
  onNextWeek?: () => void;
  /** Optional className */
  className?: string;
}
