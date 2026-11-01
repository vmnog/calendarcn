import type React from "react";

import type {
  AllDayResizeState,
  CalendarEvent,
  CalendarProviderProps,
  EventDragState,
  EventDragVariant,
  EventResizeState,
  HourSlot,
  NewEventRange,
  PositionedEvent,
  TimeGridView,
  WeekDay,
} from "./calendar-types";

// Re-export all shared types for backward compatibility
export type {
  ViewType,
  TimeGridView,
  WeekStartsOn,
  HourCycle,
  ViewSettings,
  WeekDay,
  HourSlot,
  EventReminder,
  CalendarEvent,
  DetailedCalendarEvent,
  EventColor,
  PositionedEvent,
  EventDragVariant,
  EventDragState,
  EventResizeState,
  AllDayResizeState,
  NewEventRange,
  PointerGestureStart,
  CalendarInfo,
  CalendarConfig,
  EventContentPlacement,
  EventContentProps,
  EventDetailsRenderProps,
  CalendarRenderSlots,
  CalendarProviderProps,
  CalendarContextValue,
} from "./calendar-types";

/**
 * Event popover options shared by the time grid views and MonthView
 */
export interface EventPopoverProps {
  /**
   * Whether the selected event opens a details popover beside it. Turn it
   * off when the details are shown elsewhere (e.g. a side panel). Defaults
   * to true.
   */
  showEventPopover?: boolean;
  /**
   * Called by the popover's expand button (e.g. to move the details into a
   * side panel). The button is hidden when this is not set.
   */
  onEventPopoverExpand?: () => void;
}

/**
 * Props for the DayView component. Date, events and selection come from the
 * surrounding CalendarProvider.
 */
export interface DayViewProps extends EventPopoverProps {
  /**
   * Hour the grid scrolls to when it mounts, so the first rows on screen
   * are the ones with events (e.g. `8` for 8 AM, `8.5` for 8:30). Applied
   * once; clamped to `dayStartHour`..`dayEndHour`. Unset starts at the top.
   */
  scrollToHour?: number;
  /** Optional className for the root element */
  className?: string;
}

/**
 * Props for the WeekView component. Date, events and selection come from the
 * surrounding CalendarProvider.
 */
export interface WeekViewProps extends DayViewProps {
  /**
   * Number of day columns. Defaults to the provider's `numberOfDays`. When
   * set, it fixes the column count, and the provider adopts it while its
   * `numberOfDays` is uncontrolled (so prev/next step by it below 7).
   */
  numberOfDays?: number;
}

/**
 * Props for the TimeGrid component, the hourly grid behind DayView and
 * WeekView. Date, events and selection come from the surrounding
 * CalendarProvider.
 */
export interface TimeGridProps extends WeekViewProps {
  /**
   * "day" shows one column, "week" shows `numberOfDays` columns. While the
   * provider's `view` is uncontrolled, the provider adopts this type, so
   * navigation and header info follow it.
   */
  view: TimeGridView;
}

/**
 * Props for the MonthView component. Date, events, selection and view
 * settings come from the surrounding CalendarProvider.
 */
export interface MonthViewProps extends EventPopoverProps {
  /** Optional className for the root element */
  className?: string;
}

/**
 * Props for the Calendar block: everything CalendarProvider takes (events,
 * view, date, configuration, render slots), plus options for its toolbar
 * and views. `children` render inside the provider, after the calendar.
 */
export type CalendarProps<TEvent extends CalendarEvent = CalendarEvent> =
  CalendarProviderProps<TEvent> & {
    /**
     * Hour the time grid scrolls to when it mounts (e.g. `8` for 8 AM).
     * Defaults to 8.
     */
    scrollToHour?: number;
    /**
     * Whether the single-key shortcuts (T, J, K, D, W, M, 2-9, Escape) are
     * on. They listen on `window`, so turn them off when several calendars
     * share a page. Defaults to true.
     */
    shortcuts?: boolean;
    /** Optional className for the root element */
    className?: string;
  };

/**
 * Event popover props passed from a view down to its event items
 */
export interface EventItemPopoverProps {
  /** Whether a selected event shows its details popover */
  showEventPopover?: boolean;
  /** Callback for the popover's expand button (hidden when absent) */
  onEventPopoverExpand?: () => void;
  /**
   * Callback to close the popover of the given event. Clears the selection
   * only while that event is still the selected one.
   */
  onEventPopoverClose?: (eventId: string) => void;
  /** Navigate to the previous period (recurrence arrows in the details) */
  onPrevWeek?: () => void;
  /** Navigate to the next period (recurrence arrows in the details) */
  onNextWeek?: () => void;
}

/**
 * Props for the WeekViewDayColumns component
 */
export interface WeekViewDayColumnsProps {
  /** Array of days to display */
  days: WeekDay[];
  /** When true, renders without the timezone/grid wrapper (used in scroll container) */
  standalone?: boolean;
  /** Date to highlight with a temporary background animation */
  highlightedDate?: Date | null;
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
export interface WeekViewGridProps extends EventItemPopoverProps {
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
  /** Callback when an empty slot is clicked while no event is selected */
  onEventCreate?: (range: NewEventRange) => void;
  /** Current drag state if an event is being dragged */
  dragState?: EventDragState;
  /** Pointerdown handler to initiate event drag */
  onEventDragPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
  /** Current resize state if an event is being resized */
  resizeState?: EventResizeState;
  /** Pointerdown handler to initiate event resize */
  onEventResizePointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  /** Date to highlight with a temporary background animation (for "+N more" navigation) */
  highlightedDate?: Date | null;
  /**
   * Index in `days` of the first on-screen column. Columns outside the
   * on-screen range are scroll buffer: inert and hidden from assistive tech.
   */
  visibleStartIndex?: number;
  /** Number of on-screen columns (defaults to all of `days`) */
  visibleCount?: number;
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
export interface WeekViewAllDayRowProps extends EventItemPopoverProps {
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
  /** Pointerdown handler to initiate all-day event resize or drag */
  onAllDayResizePointerDown?: (
    e: React.PointerEvent<HTMLElement>,
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
  /** Index of the first visible column (used to skip buffer-only events in day view) */
  visibleStartIndex?: number;
  /** Number of visible columns (defaults to days.length when omitted) */
  visibleCount?: number;
  /** Width of a single day column in pixels (for floating drag copy sizing) */
  dayColumnWidth?: number;
  /** Date to highlight with a temporary background animation */
  highlightedDate?: Date | null;
  /** Optional className */
  className?: string;
}

/**
 * Props for the CalendarEventItem component
 */
export interface CalendarEventItemProps extends EventItemPopoverProps {
  /** The positioned event to render */
  positionedEvent: PositionedEvent;
  /** Height of each hour in pixels */
  hourHeight: number;
  /**
   * Overrides whether the event renders as past. Defaults to comparing
   * `event.end` with the shared clock (`useIsPast`), which is `false` during
   * server rendering and hydration.
   */
  isPast?: boolean;
  /** Whether the event is currently selected */
  isSelected?: boolean;
  /** Optional click handler */
  onClick?: (event: CalendarEvent) => void;
  /** Drag variant for visual state during drag */
  dragVariant?: EventDragVariant;
  /** Whether this block shows an in-progress resize (passed to `renderEventContent`) */
  isResizing?: boolean;
  /** Override start time (for dragging/placeholder positioning) */
  overrideStart?: Date;
  /** Override end time (for dragging/placeholder positioning) */
  overrideEnd?: Date;
  /** Pointerdown handler to initiate drag */
  onDragPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
  /** Pointerdown handler to initiate resize */
  onResizePointerDown?: (
    e: React.PointerEvent<HTMLElement>,
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
  /** Optional className */
  className?: string;
}
