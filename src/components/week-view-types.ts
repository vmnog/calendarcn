import type React from "react";

import type {
  AllDayResizeState,
  CalendarEvent,
  CalendarTheme,
  HourCycle,
  CalendarProviderProps,
  DetailedCalendarEvent,
  EventDetailSectionProps,
  EventDragState,
  EventDragVariant,
  EventResizeState,
  HourSlot,
  NewEventRange,
  PersonCalendarEvent,
  PositionedEvent,
  SchedulingLinkRequest,
  TimeGridView,
  TimeSpan,
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
  AgendaEntry,
  AgendaDay,
  EventReminder,
  EventKind,
  RecurrenceFrequency,
  RecurrenceWeekday,
  RecurrenceEnd,
  RecurrenceRule,
  RecurrenceLabel,
  NormalizedRecurrenceRule,
  FormatRRuleOptions,
  SeriesOccurrence,
  SeriesEditScope,
  SeriesEditOptions,
  SeriesEditResult,
  SeriesDeleteOptions,
  EventChangeSummaryRow,
  SeriesScopeQuestion,
  SeriesScopeAnswer,
  TimeZoneOption,
  CalendarTimeZones,
  ParticipantResponse,
  EventParticipant,
  EventRoom,
  ConferenceProvider,
  EventConference,
  EventContact,
  ConferenceProviderOption,
  LocationSuggestion,
  EventLink,
  EventAttachment,
  CalendarEvent,
  DetailedCalendarEvent,
  EventDetailSectionProps,
  EventColor,
  PositionedEvent,
  EventDragVariant,
  EventDragState,
  EventResizeState,
  AllDayResizeState,
  NewEventRange,
  EventDrawPhase,
  PointerGestureStart,
  VisibleRange,
  EventPasteTarget,
  EventHistoryAction,
  EventHistoryChange,
  EventHistoryEntry,
  EventHistory,
  CalendarNotice,
  CalendarNoticeInput,
  CalendarNoticeValue,
  AvailabilityRange,
  SchedulingLinkKind,
  SchedulingLinkRequest,
  SchedulingPurpose,
  AvailabilityTextOptions,
  SchedulingContextValue,
  CalendarInfo,
  CalendarGroup,
  CalendarConfig,
  EventContentPlacement,
  EventContentProps,
  EventDetailsRenderProps,
  CalendarRenderSlots,
  CalendarProviderProps,
  CalendarContextValue,
  CalendarTheme,
  TimeSpan,
  WorkingHours,
  CalendarPerson,
  CalendarPeopleValue,
  PersonCalendarEvent,
  PeoplePickerMode,
  KeyboardShortcut,
  KeyboardShortcutGroup,
} from "./calendar-types";

/** A rectangle in viewport pixels that a popover is placed beside */
export interface PopoverAnchorRect {
  getBoundingClientRect: () => DOMRect;
}

/**
 * Props of the draft layers the time grid and the all-day row draw over
 * their day columns (TimeGridEventDraft, AllDayEventDraft)
 */
export interface EventDraftLayerProps {
  /** The layer's day columns, scroll buffer included */
  days: WeekDay[];
  /** Index in `days` of the first on-screen column. Defaults to 0 */
  visibleStartIndex?: number;
  /** Number of on-screen columns. Defaults to all of `days` */
  visibleCount?: number;
}

/**
 * Props of the details popover a view keeps for the event being created
 * (EventDraftPopover)
 */
export interface EventDraftPopoverProps {
  /** Callback for the popover's expand button (hidden when absent) */
  onExpand?: () => void;
}

/**
 * Where an event's details popover is placed: beside an element (by its
 * ref), or beside a fixed rectangle in viewport pixels
 */
export type EventPopoverAnchor =
  | React.RefObject<Element | null>
  | PopoverAnchorRect;

/** ARIA of an event element that opens the event's details in a popover */
export interface EventDetailsTriggerProps {
  "aria-haspopup"?: "dialog";
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
}

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
 * Props for the AgendaView component. Date, events, selection and view
 * settings come from the surrounding CalendarProvider.
 */
export interface AgendaViewProps extends EventPopoverProps {
  /** Optional className for the root element */
  className?: string;
}

/**
 * Props for the YearView component. Date, events, week start, locale and
 * week numbers come from the surrounding CalendarProvider.
 */
export interface YearViewProps {
  /**
   * Called when a day is clicked, or picked with Enter or Space. Defaults to
   * the provider's `showDay()`, which opens the day's week and briefly
   * highlights the day.
   */
  onDayClick?: (date: Date) => void;
  /** Optional className for the root element */
  className?: string;
}

/**
 * Props for CalendarToaster. The notices come from the surrounding
 * CalendarProvider.
 */
export interface CalendarToasterProps {
  /**
   * Milliseconds a toast stays before it closes by itself. The pointer or
   * focus on it holds it. Defaults to 5000
   */
  duration?: number;
  /**
   * Classes for the toaster. It sits `absolute` at the bottom right of its
   * nearest positioned parent
   */
  className?: string;
}

/**
 * A page of the command menu: its list of commands, or the date field "Go
 * to date..." opens
 */
export type CommandMenuPage = "commands" | "go-to-date";

/** What an app can open in the details sidebar, through its `actionsRef` */
export interface DetailsSidebarActions {
  /**
   * Opens the panel on event search with `query` typed in (empty by
   * default) and focuses the field. A selected event is deselected
   */
  searchEvents: (query?: string) => void;
  /**
   * Opens the panel on the full keyboard shortcut list and focuses its find
   * field. A selected event is deselected
   */
  showAllShortcuts: () => void;
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
     * Whether the single-key shortcuts (T, J, K, D, W, M, Y, A, 2-9, Escape) are
     * on. They listen on `window`, so turn them off when several calendars
     * share a page. Defaults to true.
     */
    shortcuts?: boolean;
    /** Optional className for the root element */
    className?: string;
  };

/**
 * Props for the Calendar App block, the live demo as one component:
 * everything CalendarProvider takes for `DetailedCalendarEvent` (events,
 * view, date, calendars, contacts, rooms, conferencing, configuration,
 * render slots), plus the app's own slots and options. `children` render
 * inside the provider, after the app.
 */
export type CalendarAppProps = CalendarProviderProps<DetailedCalendarEvent> & {
  /**
   * Hour the time grid scrolls to when it mounts (e.g. `8` for 8 AM).
   * Defaults to 8.
   */
  scrollToHour?: number;
  /**
   * Shown in the header before the view switcher on wide screens, e.g. the
   * signed-in user's avatar
   */
  headerActions?: React.ReactNode;
  /** Buttons in the calendar sidebar's footer, before the theme toggle */
  sidebarFooterActions?: React.ReactNode;
  /**
   * Called with the events read from an .ics file imported from the command
   * menu, after they're added (an event whose id is already there is
   * replaced). Use it to save them.
   */
  onEventsImport?: (events: DetailedCalendarEvent[]) => void;
  /** Name of the file the command menu's .ics export downloads. Defaults to "calendar.ics" */
  exportFileName?: string;
  /** Calendar name written into the exported .ics (Google and Apple show it) */
  exportCalendarName?: string;
  /**
   * Called on Cmd+, (Ctrl+, elsewhere) and "Go to settings", for settings of
   * your own. The key is left to the browser without it or `settingsDialog`
   */
  onOpenSettings?: () => void;
  /**
   * Creates a scheduling link (a booking page) in your app, which CalendarCN
   * has no backend for. With it, the sidebar's Scheduling menu and the
   * command menu offer "Create recurring scheduling link..." and "Create
   * one-off scheduling link...". A recurring link calls it right away; a
   * one-off link calls it with the times marked on the calendar
   */
  onCreateSchedulingLink?: (request: SchedulingLinkRequest) => void;
  /**
   * Turns on the built-in settings dialog (`CalendarSettingsDialog`): Cmd+,
   * (Ctrl+, elsewhere) and "Go to settings" open it, and "Manage calendar
   * accounts" opens it on the calendars. It wins over `onOpenSettings`.
   * Defaults to false
   */
  settingsDialog?: boolean;
  /**
   * Adds "Add calendar account" to the sidebar, the command menu and the
   * settings dialog. Called with helpers: `importIcsCalendar()` adds an .ics
   * file as a new calendar, as the live demo does
   */
  onAddCalendarAccount?: (helpers: CalendarAccountHelpers) => void;
  /** Adds "Support & feedback" to the command menu, e.g. to open your issue tracker */
  onSupport?: () => void;
  /** Adds "About CalendarCN" to the command menu, e.g. to open your docs */
  onAbout?: () => void;
  /**
   * Also lists the Notion Calendar commands CalendarCN doesn't have yet in
   * the command menu, disabled with a "Soon" badge. Defaults to false
   */
  showComingSoon?: boolean;
  /**
   * Whether the keyboard shortcuts (the calendar's single keys, plus Cmd+K,
   * Cmd+/, /, Shift+M, . and ?) are on. They listen on `window`. Defaults to
   * true
   */
  shortcuts?: boolean;
  /**
   * Classes for the root, which fills the viewport (`h-screen`). The
   * sidebars are fixed to the viewport, so the app is meant to be the page.
   */
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
  /**
   * Labels shown instead of the slots' own, one per slot in order: the time
   * grid's second time zone column. A missing or empty label leaves its row
   * blank
   */
  labels?: string[];
  /**
   * Fills the column with the primary color, its hours in white: the zone
   * the calendar travelled to, as Notion Calendar marks it
   */
  highlighted?: boolean;
  /** Optional className */
  className?: string;
}

/**
 * One time zone column of the time grid's axis, left to right: an
 * additional zone, the home zone while travelling, or the zone the
 * calendar draws in
 */
export interface TimeZoneAxisColumn {
  /** IANA zone */
  timeZone: string;
  /** Short label at the top ("EST", "GMT+9"); empty before hydration */
  label: string;
  /**
   * - `"secondary"`: an additional zone
   * - `"home"`: the primary zone while the calendar travels
   * - `"primary"`: the zone the calendar draws in, at home
   * - `"travel"`: the zone the calendar travelled to
   */
  kind: "secondary" | "home" | "primary" | "travel";
}

/**
 * Props for the TimeZoneAxisLabel component
 */
export interface TimeZoneAxisLabelProps {
  column: TimeZoneAxisColumn;
  /** Whether other zones are shown, so this one can be removed or made secondary */
  hasOtherZones: boolean;
}

/**
 * A command menu command that picks a time zone from a list:
 * - `"travel"`: "Travel to time zone..."
 * - `"add"`: "Show additional time zones..."
 * - `"primary"`: "Make time zone primary..."
 * - `"hide"`: "Hide time zone..."
 */
export type TimeZoneCommand = "travel" | "add" | "primary" | "hide";

/** How a time zone list reads: the command menu's rows, or a dark menu's */
export type TimeZoneListVariant = "command" | "menu";

/**
 * Props for the TimeZoneList component: the zones of a picker, inside a
 * cmdk `Command` with `shouldFilter={false}`
 */
export interface TimeZoneListProps {
  /** Text typed in the picker's input: lists the zones that match */
  query: string;
  /** Called with the IANA id of the zone picked */
  onSelect: (timeZone: string) => void;
  /**
   * Only these zones, in this order (e.g. the zones shown, for hiding one).
   * Every zone by default, the popular ones first
   */
  timeZones?: string[];
  /**
   * `"command"`: "(GMT−08:00) Pacific Standard Time – Los Angeles", as the
   * command menu lists them. `"menu"`: the offset in its own column, on a
   * dark menu
   */
  variant?: TimeZoneListVariant;
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
  /**
   * Callback when an empty slot is double-clicked: the range of a new
   * event there, `defaultEventDuration` long
   */
  onEventCreate?: (range: NewEventRange) => void;
  /**
   * Pointerdown handler for a day column's empty space: starts drawing a
   * new event by dragging (`useEventDraw`)
   */
  onEventDrawPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    columnDate: Date,
  ) => void;
  /**
   * Called with the slot under the mouse as it moves over a day column,
   * events included: where `pasteEvent()` puts the next paste
   */
  onSlotHover?: (range: NewEventRange) => void;
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
   * Other people's timed events, drawn read-only behind yours ("Meet
   * with...", "Show teammate calendar...")
   */
  personEvents?: PersonCalendarEvent[];
  /** Free time you and the people you meet with share, highlighted under the events */
  freeTimes?: TimeSpan[];
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
  /**
   * Width in px of the whole time axis, two columns with a second time
   * zone. The badge stays in the last column, next to the days. Defaults to
   * one column (4rem)
   */
  timeAxisWidth?: number;
  /** Optional className */
  className?: string;
}

/**
 * Props for the WeekViewAllDayRow component
 */
export interface WeekViewAllDayRowProps extends EventItemPopoverProps {
  /** Array of days to display */
  days: WeekDay[];
  /**
   * Callback when a day's empty space in the row is double-clicked: the
   * whole-day range of a new all-day event
   */
  onEventCreate?: (range: NewEventRange) => void;
  /**
   * Pointerdown handler for a day's empty space in the row: starts drawing
   * a new all-day event by dragging across days (`useDayRangeDraw`)
   */
  onEventDrawPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    day: Date,
  ) => void;
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
  /**
   * Width in px of the "All-day" corner: the width of the time axis below
   * it, two columns with a second time zone. Defaults to one column (4rem)
   */
  timeAxisWidth?: number;
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

/** One option of the details' time menu */
export interface TimeOption {
  /** The time it sets */
  date: Date;
  /** "4:15 PM", or "16:15" on a 24-hour clock */
  label: string;
  /** Muted text after the label: on an end time, how long the event lasts */
  hint?: string;
}

/**
 * Props for EventDetailFieldPopover
 */
export interface EventDetailFieldPopoverProps {
  open: boolean;
  /** The time section, whose left edge is the panel's: the popover opens beside it */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Classes of the field's box */
  boxClassName?: string;
  /** Called on a press anywhere in the box */
  onBoxClick?: () => void;
  /** Called as a press in the box starts */
  onBoxPointerDown?: () => void;
  /** What the box holds: icon, input, duration */
  field: React.ReactNode;
  /** The field's input: focus stays in it while the popover is open */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Called before focus comes back to the input from the popover */
  onReturnFocus: () => void;
  /** Classes of the popover */
  className?: string;
  children: React.ReactNode;
}

/**
 * Props for EventDetailTimeField
 */
export interface EventDetailTimeFieldProps {
  /** The time the field shows */
  value: Date;
  /** Builds every option of the menu, in order; called only while it's open */
  getOptions: () => TimeOption[];
  /** Options for typed text, best first */
  getMatches: (text: string) => TimeOption[];
  /** Sets a new time; returns false when the event can't take it */
  onCommit: (date: Date) => boolean;
  formatValue: (date: Date) => string;
  /** Accessible name, e.g. "Start time" */
  label: string;
  testId: string;
  /** The time section, whose left edge is the panel's */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Icon or arrow before the time */
  leading: React.ReactNode;
  /** Text after the time: the duration */
  trailing?: React.ReactNode;
  /** Muted and inert, the times of an all-day event */
  disabled?: boolean;
  /** Shows the time without a menu, for details without `onEventChange` */
  readOnly?: boolean;
  /** Fits the input to its text, so `trailing` follows it */
  fitText?: boolean;
  className?: string;
}

/**
 * Props for EventDetailDateField
 */
export interface EventDetailDateFieldProps {
  /** The day the field shows */
  value: Date;
  /** Sets a new day (time of day left to the caller); returns false when the event can't take it */
  onCommit: (day: Date) => boolean;
  /** First day the picker offers; earlier days are disabled */
  minDate?: Date;
  /** Accessible name, e.g. "Start date" */
  label: string;
  testId: string;
  /** The time section, whose left edge is the panel's */
  panelRef: React.RefObject<HTMLElement | null>;
  /** Shows the date without a picker, for details without `onEventChange` */
  readOnly?: boolean;
  className?: string;
}

/**
 * Which clock the details' times read on when the calendar draws in a zone
 * (`timeZone`, or travelling) other than the event's own, as Notion
 * Calendar's details switch between them
 */
export interface EventDetailClock {
  /**
   * `"calendar"`: the calendar's zone, which the time zone row shows.
   * `"event"`: the event's own zone, which the row can change
   */
  showing: "calendar" | "event";
  /** The zone the calendar draws in */
  calendarTimeZone: string;
  /** Switches the details to the other clock */
  onSwitch: () => void;
}

/**
 * Props for the EventDetailTimezone component
 */
export interface EventDetailTimezoneProps<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> extends EventDetailSectionProps<TEvent> {
  /**
   * Set when the calendar draws in another zone than the event's: the row
   * shows the calendar's zone with "Switch to event's time zone to edit",
   * or the event's with "Switch to your primary time zone"
   */
  clock?: EventDetailClock;
}

/**
 * Props for the EventDetailRecurrence component
 */
export interface EventDetailRecurrenceProps<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> extends EventDetailSectionProps<TEvent> {
  /**
   * Shows the previous event of the series. Leave it out at the start of
   * the series: the button is disabled then.
   */
  onPrevious?: () => void;
  /**
   * Shows the next event of the series. Leave it out at the end of the
   * series: the button is disabled then.
   */
  onNext?: () => void;
}

/**
 * Props for SchedulingProvider. Goes inside CalendarProvider, around the
 * views, sidebars and command menu that read `useScheduling()`.
 */
export interface SchedulingProviderProps {
  /**
   * Creates a scheduling link (a booking page) in your app. Without it the
   * scheduling links aren't offered, and only the times are copied as text
   */
  onCreateSchedulingLink?: (request: SchedulingLinkRequest) => void;
  /** Meeting length the scheduling panel starts with, in minutes. Defaults to 30 */
  defaultDurationMinutes?: number;
  children?: React.ReactNode;
}

/** Options of `useSchedulingShortcuts()` */
export interface UseSchedulingShortcutsOptions {
  /** Whether S, Escape and Delete are handled. Defaults to true */
  enabled?: boolean;
}

/**
 * Props for AvailabilityLayer, the time grid's layer for marking open times.
 * Lies over the grid's day columns, inside its scrolling content.
 */
export interface AvailabilityLayerProps {
  /** The grid's days, scroll buffer included, in column order */
  days: WeekDay[];
  /** Height of one hour row in pixels */
  hourHeight: number;
  /** Index in `days` of the first day on screen */
  visibleStartIndex: number;
  /** How many days are on screen */
  visibleCount: number;
  className?: string;
}

/**
 * Props for AvailabilityHint, the "Mark available times on your calendar"
 * pill at the bottom of the calendar while open times are marked
 */
export interface AvailabilityHintProps {
  /**
   * Adds Cancel and Copy (or Create) buttons, for when the scheduling panel
   * isn't on screen (phones, or a closed context panel)
   */
  showActions?: boolean;
  /** Classes for the pill's row; it sits `absolute` at the bottom of its positioned parent */
  className?: string;
}

/** The pane the settings dialog opens on: General, or the first calendar account */
export type CalendarSettingsSection = "general" | "calendars";

/**
 * Props for CalendarSettingsDialog. Each setting shows only when something
 * can change it: the calendar view settings come from the surrounding
 * CalendarProvider, the rest from these handlers.
 */
export interface CalendarSettingsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Called when the dialog opens or closes (Escape, a click outside, the close button) */
  onOpenChange: (open: boolean) => void;
  /** Pane the dialog opens on, each time it opens. Defaults to "general" */
  defaultSection?: CalendarSettingsSection;
  /** The current theme, for the Theme setting. Defaults to "system" */
  theme?: CalendarTheme;
  /** Adds the Theme setting (Auto, Light mode, Dark mode) */
  onThemeChange?: (theme: CalendarTheme) => void;
  /** Adds the Time format setting; the current clock is the provider's `hourCycle` */
  onHourCycleChange?: (hourCycle: HourCycle) => void;
  /** Ids of the hidden calendars, for each calendar's show or hide button */
  hiddenCalendarIds?: string[];
  /** Adds a show or hide button to each calendar in an account's pane */
  onHiddenCalendarIdsChange?: (hiddenCalendarIds: string[]) => void;
  /** Adds "Add calendar account" under the accounts */
  onAddCalendarAccount?: () => void;
}

/** What `CalendarApp` hands its `onAddCalendarAccount` */
export interface CalendarAccountHelpers {
  /**
   * Opens a file picker and adds the picked .ics file's events as a new
   * calendar named after the file (the same file again updates it), then
   * shows its first event's period: what the live demo does
   */
  importIcsCalendar: () => void;
}
