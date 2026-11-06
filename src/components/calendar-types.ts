import type React from "react";
import type { Locale } from "date-fns";

/**
 * Calendar view mode — "day" shows a single column, "week" shows 7 columns,
 * "month" a month grid and "agenda" a list of the coming days' events
 */
export type ViewType = "day" | "week" | "month" | "agenda";

/**
 * Views drawn by the hourly time grid: "day" (one column) and "week"
 * (`numberOfDays` columns)
 */
export type TimeGridView = Extract<ViewType, "day" | "week">;

/**
 * Day a week starts on, using the date-fns convention (0 = Sunday ... 6 = Saturday)
 */
export type WeekStartsOn = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Clock style for time labels: 12 ("3 PM", "3:30 PM") or 24 ("15:00")
 */
export type HourCycle = 12 | 24;

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
  /**
   * Time of day the reminder fires, for all-day events ("1 day before at
   * 9 AM"). Timed events leave it out: their reminders count back from the
   * start.
   */
  time?: { hours: number; minutes: number };
}

/**
 * Kind of event, picked from the menu at the top of the details panel
 */
export type EventKind = "event" | "focus-time" | "out-of-office" | "birthday";

/**
 * How often a repeat rule repeats
 */
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

/**
 * Day of the week in a repeat rule, using the date-fns convention
 * (0 = Sunday ... 6 = Saturday)
 */
export type RecurrenceWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * When a repeating event stops: never, on a date (inclusive), or after a
 * number of occurrences
 */
export type RecurrenceEnd =
  | { type: "never" }
  | { type: "on"; date: Date }
  | { type: "after"; count: number };

/**
 * A structured repeat rule, the subset of RFC 5545 RRULE the details panel
 * edits ("Every 2 weeks on Mon, Thu", "Every month on the first Thu")
 */
export interface RecurrenceRule {
  /** How often it repeats */
  frequency: RecurrenceFrequency;
  /** Repeats every `interval` days, weeks, months or years. Defaults to 1 */
  interval?: number;
  /**
   * Days a weekly rule falls on. Defaults to the weekday of the event's
   * start. Monday to Friday reads as "Every weekday".
   */
  weekdays?: RecurrenceWeekday[];
  /**
   * What a monthly rule repeats on: the start's day of the month ("on the
   * 5th") or its weekday and position in the month ("on the first Thu").
   * Defaults to "day-of-month".
   */
  monthlyBy?: "day-of-month" | "weekday-of-month";
  /**
   * Which of its weekdays in the month a `"weekday-of-month"` rule falls on:
   * 1 to 4 for the first to the fourth, -1 for the last (RRULE's
   * `BYDAY=-1TH`). Defaults to the start's position in its month, so set -1
   * to keep "the last Thu" when the start is also the fourth one.
   */
  weekOfMonth?: 1 | 2 | 3 | 4 | -1;
  /**
   * Day the weeks of a weekly rule start on, which decides the weeks an
   * "every 2 weeks" rule skips (RFC 5545 WKST). Defaults to 1 (Monday), as
   * in RFC 5545.
   */
  weekStartsOn?: WeekStartsOn;
  /** When the series stops. Defaults to never */
  end?: RecurrenceEnd;
}

/**
 * A rule as the details show it: "Every week" in full color and "on Thu"
 * muted
 */
export interface RecurrenceLabel {
  /** "Every week", "Every 2 days", "Every weekday" */
  main: string;
  /** "on Thu", "on the 1st Sat until Dec 6", "for 7 times"; may be empty */
  detail: string;
}

/**
 * A repeat rule with every default filled in, so two rules compare by value
 */
export interface NormalizedRecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: RecurrenceWeekday[];
  monthlyBy: NonNullable<RecurrenceRule["monthlyBy"]>;
  weekOfMonth: NonNullable<RecurrenceRule["weekOfMonth"]>;
  weekStartsOn: WeekStartsOn;
  end: RecurrenceEnd;
}

/**
 * Options of `formatRRule`, which writes a rule as an RFC 5545 RRULE
 */
export interface FormatRRuleOptions {
  /** IANA zone the series is set in; the viewer's when unset */
  timeZone?: string;
  /** Whether the series is all-day, so UNTIL is written as a DATE */
  isAllDay?: boolean;
}

/**
 * The previous or next occurrence of a repeating event: its event when the
 * events have one for it, else only its start
 */
export interface SeriesOccurrence<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  /**
   * Id of the occurrence: its event's, or the id a copy of it gets
   * (`createSeriesOccurrence`)
   */
  id: string;
  /** When the occurrence starts */
  start: Date;
  /** The event of that occurrence, when the events have it */
  event?: TEvent;
}

/**
 * One zone of the details' time zone picker
 */
export interface TimeZoneOption {
  /** IANA id, e.g. "America/Sao_Paulo" */
  id: string;
  /** Offset from UTC on the reference date, in minutes (-180 for GMT−3) */
  offsetMinutes: number;
  /** "GMT−03:00" */
  offsetLabel: string;
  /** "Brasilia Standard Time", or the IANA id when the zone has no name */
  name: string;
  /** "Sao Paulo", or the IANA id when the zone has no city */
  city: string;
}

/**
 * A guest's answer to an invitation
 */
export type ParticipantResponse =
  | "accepted"
  | "declined"
  | "tentative"
  | "needs-action";

/**
 * A person invited to an event
 */
export interface EventParticipant {
  /** Email address, also the participant's identity */
  email: string;
  /** Display name. Defaults to the email */
  name?: string;
  /** Their answer to the invitation. Defaults to "needs-action" */
  response?: ParticipantResponse;
  /** Whether they organize the event */
  organizer?: boolean;
  /** Whether their attendance is optional */
  optional?: boolean;
}

/**
 * A meeting room booked for an event
 */
export interface EventRoom {
  /** Unique identifier for the room (its resource email in Google Calendar) */
  id: string;
  /** Display name (e.g. "Room 3A") */
  name: string;
  /** Building or floor shown under the name */
  location?: string;
  /** Number of seats */
  capacity?: number;
  /** Whether the room accepted the booking. Defaults to "needs-action" */
  response?: ParticipantResponse;
}

/**
 * Video conferencing service attached to an event
 */
export type ConferenceProvider =
  | "google-meet"
  | "zoom"
  | "microsoft-teams"
  | "other";

/**
 * A video call attached to an event
 */
export interface EventConference {
  /** Service that hosts the call */
  provider: ConferenceProvider;
  /** Link that joins the call */
  url: string;
  /** Meeting code or ID shown beside the link (e.g. "abc-defg-hij") */
  meetingId?: string;
}

/**
 * A link attached to an event
 */
export interface EventLink {
  /** Address the link opens */
  url: string;
  /** Text shown instead of the address */
  title?: string;
}

/**
 * A file attached to an event
 */
export interface EventAttachment {
  /** File name (e.g. "agenda.pdf") */
  name: string;
  /** Address the file opens from (a download link or an object URL) */
  url: string;
  /** Size in bytes */
  size?: number;
  /** MIME type (e.g. "application/pdf"), picks the file icon */
  type?: string;
}

/**
 * The fields the calendar needs to place and draw an event. Extend it with
 * your own fields and pass that type to `CalendarProvider<TEvent>` and
 * `useCalendar<TEvent>()` to get it back, fully typed, in every callback.
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
}

/**
 * Event with the Notion Calendar-style details that the default event details
 * (popover body and detail panel) and the context menu read and edit. Every
 * detail is optional; a missing one shows a placeholder.
 */
export interface DetailedCalendarEvent extends CalendarEvent {
  /** Kind picked in the header menu. Defaults to "event" */
  kind?: EventKind;
  /** Calendar ID this event belongs to */
  calendarId?: string;
  /** Calendar account email for display */
  calendarEmail?: string;
  /** Optional description */
  description?: string;
  /** Optional location */
  location?: string;
  /**
   * IANA time zone the event is set in (e.g. "America/Sao_Paulo"), shown
   * as "GMT-3 Sao Paulo". Defaults to the viewer's zone.
   */
  timeZone?: string;
  /**
   * Time zone label (e.g. "GMT-3 Sao Paulo"), shown when `timeZone` is not
   * set.
   * @deprecated Set `timeZone` to an IANA zone instead.
   */
  timezone?: string;
  /**
   * Repeat rule. Takes precedence over `recurrence`; `.ics` import fills it
   * and export writes it as an RRULE
   */
  recurrenceRule?: RecurrenceRule;
  /**
   * Repeat rule as display text (e.g. "Every week on Thu") or an RFC 5545
   * RRULE (`.ics` import keeps one here when `recurrenceRule` can't hold it,
   * e.g. "FREQ=MONTHLY;BYMONTHDAY=1,15"). Used when `recurrenceRule` is not
   * set; an RRULE the details can't read shows as "Custom repeat".
   */
  recurrence?: string;
  /** People invited, the organizer included */
  participants?: EventParticipant[];
  /** Meeting rooms booked */
  rooms?: EventRoom[];
  /** Video call */
  conference?: EventConference;
  /** Whether AI meeting notes are taken during the event */
  aiMeetingNotes?: boolean;
  /** Links attached to the event */
  links?: EventLink[];
  /** Files attached to the event */
  attachments?: EventAttachment[];
  /** Reminders list */
  reminders?: EventReminder[];
  /** Busy/Free status */
  status?: "busy" | "free";
  /** Visibility setting */
  visibility?: "default" | "public" | "private";
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
 * An event as listed under one day of the agenda. An event that spans
 * several days is listed under each of them.
 */
export interface AgendaEntry {
  /** The original event */
  event: CalendarEvent;
  /** Which of the event's days this is, counting from 1 */
  dayIndex: number;
  /** How many days the event spans (1 for a single-day event) */
  dayCount: number;
  /**
   * Whether the event fills this whole day: an all-day event, or a day
   * between the first and last of a multi-day timed event
   */
  isAllDayOnThisDay: boolean;
}

/**
 * A day in the agenda and the events listed under it
 */
export interface AgendaDay {
  /** Start of the day */
  date: Date;
  /** Its events: whole-day entries first, then by start time */
  entries: AgendaEntry[];
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

/**
 * Where a press-to-drag gesture started: the pointerdown for mouse and pen,
 * the point where the long press completed for touch
 */
export interface PointerGestureStart {
  /** Viewport X of the pointer when the gesture started */
  clientX: number;
  /** Viewport Y of the pointer when the gesture started */
  clientY: number;
  /** Pointer that drives the gesture; events from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  /** Element the press began on (the pointerdown's `currentTarget`) */
  element: HTMLElement;
}

/**
 * Start and end of a new event created by clicking an empty time slot
 */
export interface NewEventRange {
  /** Start of the clicked `snapMinutes` slot */
  start: Date;
  /**
   * End time (start + NEW_EVENT_DURATION_MINUTES, kept inside the visible
   * hours and the clicked day)
   */
  end: Date;
}

/**
 * Dates a view draws, passed to `onVisibleRangeChange` and returned as
 * `visibleRange` by `useCalendar()`. Both are local midnights and `end` is
 * exclusive, so an event is in range when `event.start < end` and
 * `event.end > start`.
 */
export interface VisibleRange {
  /** Midnight that starts the first visible day */
  start: Date;
  /** Midnight after the last visible day (exclusive) */
  end: Date;
}

/**
 * A calendar events can belong to (e.g. "Work"), listed by the event
 * context menu's "Block on calendar" submenu
 */
export interface CalendarInfo {
  /** Stored in the event's `calendarId` when picked */
  id: string;
  /** Display name */
  name: string;
  /** Swatch color shown beside the name */
  color: EventColor;
  /** Account the calendar belongs to; calendars are grouped under it */
  email?: string;
}

/**
 * Display and interaction settings set on CalendarProvider, read with
 * `useCalendarConfig()`. Every field has a default, listed on the matching
 * provider prop.
 */
export interface CalendarConfig {
  /** Minute step that timed-event drag, resize and click-to-create snap to */
  snapMinutes: number;
  /** First hour (0-23) the time grid shows */
  dayStartHour: number;
  /** Hour (1-24) the time grid ends at; the last row is `dayEndHour - 1` */
  dayEndHour: number;
  /** Clock style for every time label */
  hourCycle: HourCycle;
  /** date-fns locale for day names, month names and dates */
  locale: Locale;
  /** Calendars offered by the event context menu */
  calendars: CalendarInfo[];
}

/**
 * Where an event's content is drawn. Each placement gives it a different
 * amount of room:
 * - "time-grid": a timed block in the day/week hour grid, as tall as the event
 * - "all-day": a 24px bar in the day/week all-day row
 * - "month-item": a 20px line for a timed event in a month cell
 * - "month-bar": a 20px bar for an all-day or multi-day event in month view
 * - "agenda": a row in the agenda list, as wide as the list
 */
export type EventContentPlacement =
  | "time-grid"
  | "all-day"
  | "month-item"
  | "month-bar"
  | "agenda";

/**
 * Props passed to `renderEventContent`. The calendar keeps drawing the
 * event's box (position, color, selection, drag and resize handles); the
 * returned content fills its inside.
 */
export interface EventContentProps<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  /** The event, with its in-progress start and end while dragged or resized */
  event: TEvent;
  /** View the event is drawn in */
  view: ViewType;
  /** Where the content is drawn, which sets how much room it has */
  placement: EventContentPlacement;
  /** Whether the event is selected */
  isSelected: boolean;
  /** Whether the event has already ended */
  isPast: boolean;
  /** Whether this is the copy that follows the pointer while the event is dragged */
  isDragging: boolean;
  /** Whether the event is being resized */
  isResizing: boolean;
  /**
   * Whether there is room for one line only: true for time-grid blocks
   * under 40px tall, and always true for the single-line all-day and month
   * placements
   */
  isCompact: boolean;
  /**
   * Time the default content shows: the range in the time grid and the
   * agenda ("10–11 AM"), the start in month cells and for all-day events
   * that have one ("9 AM"). Empty where the default content shows no time.
   */
  timeLabel: string;
}

/**
 * Props passed to `renderEventDetails`
 */
export interface EventDetailsRenderProps<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  /** The selected event */
  event: TEvent;
  /** Closes the popover (clears the selection) */
  close: () => void;
  /**
   * Whether the event was just created by clicking an empty slot, so its
   * title should be focused. True on the first render after creation only.
   */
  isNew: boolean;
}

/**
 * Props every section of the event details panel takes (time, time zone,
 * repeat, participants, and so on). A section reads its fields from `event`
 * and calls `onEventChange` with the whole event and its edit applied,
 * keeping the app's other fields.
 */
export interface EventDetailSectionProps<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> {
  /** The event shown */
  event: TEvent;
  /**
   * Called with the edited event. Without it a section renders read-only:
   * no menus, no inputs that accept typing.
   */
  onEventChange?: (event: TEvent) => void;
}

/**
 * Custom renderers set on CalendarProvider. Each replaces only the content
 * it names; leave it out to keep the default.
 */
export interface CalendarRenderSlots<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  /**
   * Renders the inside of an event in the time grid, the all-day row,
   * month view and the agenda. Defaults to the title and time.
   */
  renderEventContent?: (props: EventContentProps<TEvent>) => React.ReactNode;
  /**
   * Renders the body of the event details popover. Defaults to the
   * Notion-style detail panel, which reads `DetailedCalendarEvent` fields.
   */
  renderEventDetails?: (
    props: EventDetailsRenderProps<TEvent>,
  ) => React.ReactNode;
}

/**
 * The `createEvent` prop. Optional while the default event (id, title,
 * start, end) is a valid `TEvent`; required once `TEvent` adds required
 * fields, since only the app knows how to fill them.
 */
type CalendarCreateEventProps<TEvent extends CalendarEvent> =
  CalendarEvent extends TEvent
    ? {
        /**
         * Builds the event created by clicking an empty time slot. Return
         * `null` to create nothing. Defaults to a "New event" with a random UUID.
         */
        createEvent?: (range: NewEventRange) => TEvent | null;
      }
    : {
        /**
         * Builds the event created by clicking an empty time slot. Return
         * `null` to create nothing. Required because `TEvent` has required
         * fields the default "New event" can't fill.
         */
        createEvent: (range: NewEventRange) => TEvent | null;
      };

/**
 * CalendarProvider props other than `createEvent`
 */
interface CalendarProviderBaseProps<
  TEvent extends CalendarEvent,
> extends CalendarRenderSlots<TEvent> {
  /** Events to display (controlled) */
  events?: TEvent[];
  /** Initial events when `events` is not controlled. Defaults to none */
  defaultEvents?: TEvent[];
  /**
   * Called with the full next list whenever events change (drag, resize,
   * create, edit, or an occurrence the series arrows open)
   */
  onEventsChange?: (events: TEvent[]) => void;
  /** Active view (controlled) */
  view?: ViewType;
  /** Initial view when `view` is not controlled. Defaults to "week" */
  defaultView?: ViewType;
  /** Called when the view changes */
  onViewChange?: (view: ViewType) => void;
  /** First day of the displayed period (controlled) */
  date?: Date;
  /**
   * Initial first day when `date` is not controlled. Defaults to the start of
   * today's period (today in day and agenda views, the start of this week
   * otherwise).
   * Today is unknown during server rendering and hydration, so without
   * `date` or `defaultDate` the provider renders nothing until hydration ends.
   */
  defaultDate?: Date;
  /** Called when the displayed date changes (navigation or scroll) */
  onDateChange?: (date: Date) => void;
  /** Day the week starts on. Defaults to 0 (Sunday) */
  weekStartsOn?: WeekStartsOn;
  /**
   * Number of days the week view shows (controlled). Below 7, the columns
   * start on the current day and prev/next move by that many days; from 7
   * up they start on the week's first day and prev/next move by a week.
   */
  numberOfDays?: number;
  /** Initial number of days when `numberOfDays` is not controlled. Defaults to 7 */
  defaultNumberOfDays?: number;
  /** Called when the number of days changes */
  onNumberOfDaysChange?: (numberOfDays: number) => void;
  /**
   * Initial display preferences. Unset fields default to showing weekends
   * and declined events, and hiding week numbers.
   */
  defaultViewSettings?: Partial<ViewSettings>;
  /** Minute step that timed-event drag, resize and click-to-create snap to. Defaults to 15 */
  snapMinutes?: number;
  /**
   * First hour (0-23) the day and week views show. Events before it are
   * clipped at the top edge (hidden when they end before it), and drag,
   * resize and click-to-create stay inside the range. Defaults to 0
   */
  dayStartHour?: number;
  /**
   * Hour (1-24) the day and week views end at, after `dayStartHour`. Events
   * after it are clipped at the bottom edge (hidden when they start after
   * it). Defaults to 24
   */
  dayEndHour?: number;
  /** Clock style for time labels: 12 ("3 PM") or 24 ("15:00"). Defaults to 12 */
  hourCycle?: HourCycle;
  /**
   * date-fns locale for day names, month names, dates and week numbers.
   * Defaults to `enUS`
   */
  locale?: Locale;
  /**
   * Calendars the event context menu offers under "Block on calendar".
   * The submenu is hidden when empty. Defaults to none
   */
  calendars?: CalendarInfo[];
  /**
   * Called after an event is added: one created by clicking an empty slot,
   * or an occurrence copy the series arrows add (`showSeriesOccurrence`)
   */
  onEventCreate?: (event: TEvent) => void;
  /** Called after an event is changed (drag, resize, or an edit in the details) */
  onEventUpdate?: (event: TEvent) => void;
  /** Called whenever an event is selected (clicked, or just created) */
  onEventSelect?: (eventId: string) => void;
  /**
   * Called with the dates the view draws: once after it mounts, then each
   * time they change (navigation, a view switch, a settled scroll). Never
   * twice in a row for the same range. Use it to fetch events by range.
   */
  onVisibleRangeChange?: (range: VisibleRange) => void;
  /**
   * Shows a thin progress bar under the day headers of every view, e.g.
   * while events for a new range load. The calendar stays usable.
   * Defaults to false
   */
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * Props for CalendarProvider. Stateful values come in shadcn/Radix-style
 * pairs: pass `value` + `onValueChange` to control them, or `defaultValue`
 * (or nothing) to let the provider own them. `TEvent` is the app's event
 * type (`CalendarEvent` plus its own fields); callbacks receive it as-is.
 */
export type CalendarProviderProps<
  TEvent extends CalendarEvent = CalendarEvent,
> = CalendarProviderBaseProps<TEvent> & CalendarCreateEventProps<TEvent>;

/**
 * Calendar state and actions returned by `useCalendar<TEvent>()`
 */
export interface CalendarContextValue<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  /** All events */
  events: TEvent[];
  /** Active view */
  view: ViewType;
  /** First day of the displayed period */
  currentDate: Date;
  /** Day the week starts on */
  weekStartsOn: WeekStartsOn;
  /** Number of days the week view shows */
  numberOfDays: number;
  /** Display preferences toggled from the view menu */
  viewSettings: ViewSettings;
  /**
   * Days the day/week view currently shows, updated live while it scrolls
   * horizontally, or the days the agenda covers. Empty in month view.
   */
  visibleDays: Date[];
  /**
   * First day of the month the month view shows (follows its vertical
   * scroll), or `null` before month view has rendered
   */
  displayMonth: Date | null;
  /**
   * Dates the view draws (end exclusive): the visible days in day and week
   * view, the whole six-week grid in month view, trimmed to the first and
   * last weekday when month view hides weekends. Follows settled
   * navigation, so a horizontal scroll moves it once it snaps.
   */
  visibleRange: VisibleRange;
  /** Whether the provider's `loading` prop is set */
  loading: boolean;
  /** ID of the selected event, or `null` */
  selectedEventId: string | null;
  /** The selected event, or `null` when nothing (or a missing event) is selected */
  selectedEvent: TEvent | null;
  /**
   * The selected event's previous occurrence in its repeating series (see
   * `findSeriesOccurrence`), or `null`: nothing selected, the event doesn't
   * repeat, or it is the series' first
   */
  previousInSeries: SeriesOccurrence<TEvent> | null;
  /**
   * The selected event's next occurrence in its repeating series, or `null`:
   * nothing selected, the event doesn't repeat, or the series ends with it
   */
  nextInSeries: SeriesOccurrence<TEvent> | null;
  /**
   * Selects an occurrence of the selected event's series (`previousInSeries`
   * or `nextInSeries`) and shows it, moving to its period when it is off
   * screen. An occurrence the events have no event for yet is added first,
   * as a copy of the selected event (`createSeriesOccurrence`), through
   * `onEventsChange` and `onEventCreate`.
   */
  showSeriesOccurrence: (occurrence: SeriesOccurrence<TEvent>) => void;
  /** Day briefly highlighted after `showDay`, or `null` */
  highlightedDate: Date | null;
  /** Month name for the header (e.g. "October") */
  monthName: string;
  /** Four-digit year for the header (e.g. "2026") */
  year: string;
  /** Week number of the displayed week */
  weekNumber: number;
  /** Goes to the period that contains today */
  goToToday: () => void;
  /** Goes back one period (day, week, month or agenda range, by view) */
  goToPrev: () => void;
  /** Goes forward one period (day, week, month or agenda range, by view) */
  goToNext: () => void;
  /** Sets the first displayed day as given (no snapping to a week start) */
  goToDate: (date: Date) => void;
  /** Switches the view, snapping the date to the new view's period */
  switchView: (view: ViewType) => void;
  /** Sets how many days the week view shows */
  setNumberOfDays: (numberOfDays: number) => void;
  /** Selects an event */
  selectEvent: (eventId: string) => void;
  /** Clears the selection (closes the event popover) */
  clearSelection: () => void;
  /**
   * Creates an event for a clicked slot via `createEvent`, selects it and
   * focuses its title
   */
  addEventFromRange: (range: NewEventRange) => void;
  /** Replaces the event with the same id */
  updateEvent: (event: TEvent) => void;
  /** Toggles weekend columns */
  toggleWeekends: () => void;
  /** Toggles declined events */
  toggleDeclinedEvents: () => void;
  /** Toggles week numbers */
  toggleWeekNumbers: () => void;
  /** Opens the week containing `date` and briefly highlights that day */
  showDay: (date: Date) => void;
}
