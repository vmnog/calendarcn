import type React from "react";
import type { Locale } from "date-fns";

/**
 * Calendar view mode — "day" shows a single column, "week" shows 7 columns,
 * "month" a month grid, "agenda" a list of the coming days' events and
 * "year" twelve month grids
 */
export type ViewType = "day" | "week" | "month" | "agenda" | "year";

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
  /**
   * Whether the views draw Saturday and Sunday. Off, day and week view show
   * weekdays only and step over the weekend, a full week shows Monday to
   * Friday, and month and year view drop their weekend columns
   */
  showWeekends: boolean;
  /**
   * Whether the views draw events the viewer declined (see
   * `EventParticipant.self`), struck through on a dashed outline
   */
  showDeclinedEvents: boolean;
  /**
   * Whether week numbers show: beside the title in day and week view, at
   * each week's start in the agenda, and beside the weeks of month and year
   * view
   */
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
  /** How long before the event it fires; 0 fires at the start */
  amount: number;
  unit: "minutes" | "hours" | "days" | "weeks";
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
 * The previous or next occurrence of a repeating event
 */
export interface SeriesOccurrence<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  /**
   * Id of the occurrence: its stored event's, or
   * `<series id>-<yyyy-MM-dd>` for one generated from the rule
   */
  id: string;
  /** When the occurrence starts */
  start: Date;
  /**
   * The occurrence: the event stored for that date, or the one generated
   * for it (`expandRecurringEvents`)
   */
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
 * The time zones a calendar shows beside its time axis, as Notion
 * Calendar's time zone settings hold them
 */
export interface CalendarTimeZones {
  /**
   * IANA zone the calendar draws in, closest to the days. `undefined` is
   * the viewer's own zone
   */
  primary: string | undefined;
  /** Additional zones, each in a column left of the primary's, left to right */
  secondary: string[];
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
  /**
   * Whether this participant is the viewer, the person whose calendar shows
   * the event (Google Calendar's `self`). Their `response` is the viewer's:
   * a "declined" one marks the event declined (see `showDeclinedEvents`).
   * Without it, the participant whose email is the event's `calendarEmail`
   * is the viewer.
   */
  self?: boolean;
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
  /**
   * Label of the `conferenceProviders` option that created it, which tells
   * apart two options of the same `provider` (e.g. two Zoom accounts)
   */
  label?: string;
  /** Link that joins the call */
  url: string;
  /** Meeting code or ID shown beside the link (e.g. "abc-defg-hij") */
  meetingId?: string;
}

/**
 * A person the participants field suggests while typing (an address book
 * entry, a coworker)
 */
export interface EventContact {
  /** Email address, the participant's identity once added */
  email: string;
  /** Display name. Defaults to the email */
  name?: string;
  /**
   * Whether they were invited recently. Recent contacts are listed before
   * typing, with a history icon
   */
  recent?: boolean;
  /**
   * Color their events are drawn in while their calendar shows ("Meet
   * with...", "Show teammate calendar..."). Defaults to one picked from
   * their place in `contacts`
   */
  color?: EventColor;
}

/**
 * A person whose calendar shows beside yours, as `useCalendarPeople()`
 * lists them: their contact, with the color their events are drawn in
 */
export interface CalendarPerson extends EventContact {
  /** Color of their events: the contact's own `color`, or one picked for them */
  color: EventColor;
}

/**
 * What picking someone in the people picker does: meet with them ("Meet
 * with...", F) or show their calendar ("Show teammate calendar...", P)
 */
export type PeoplePickerMode = "meet-with" | "teammate";

/**
 * Someone else's event as the time grid draws it beside yours: their event,
 * with an id of its own (`person:<email>:<event id>`) and the person it
 * belongs to. Never editable.
 */
export interface PersonCalendarEvent extends DetailedCalendarEvent {
  /** The person whose calendar it comes from */
  calendarPerson: CalendarPerson;
}

/**
 * The people whose calendars show beside yours, returned by
 * `useCalendarPeople()`: the ones you meet with ("Meet with...") and your
 * teammates ("Show teammate calendar..."). Both lists hold emails, kept in
 * the order they were added; an email is never in a list twice.
 */
export interface CalendarPeopleValue {
  /** People "Meet with..." and "Show teammate calendar..." offer: the provider's `contacts` */
  contacts: EventContact[];
  /** Emails of the people you're meeting with */
  meetWith: string[];
  /** Emails of the teammates whose calendars show */
  teammates: string[];
  /** The people you're meeting with, then the teammates not among them */
  shownPeople: CalendarPerson[];
  /** Adds someone to the meeting. Does nothing when they are in it already */
  addMeetWith: (email: string) => void;
  /** Takes someone out of the meeting */
  removeMeetWith: (email: string) => void;
  /** Ends the meeting: nobody is met with anymore */
  clearMeetWith: () => void;
  /** Shows a teammate's calendar. Does nothing when it shows already */
  addTeammate: (email: string) => void;
  /** Hides a teammate's calendar again */
  removeTeammate: (email: string) => void;
  /**
   * A person's events, from the provider's `contactEvents` (an empty list
   * when it has none for them)
   */
  getPersonEvents: (email: string) => DetailedCalendarEvent[];
  /** Days and hours the free times everyone shares are looked in */
  workingHours: WorkingHours;
}

/**
 * A video conferencing service the details panel offers. Picking it calls
 * `createConference`, whose result is set as the event's `conference`.
 */
export interface ConferenceProviderOption {
  /** Service the call is hosted on */
  provider: ConferenceProvider;
  /**
   * Name shown in the menu and on the event (e.g. "Video call"), unique
   * among the options
   */
  label: string;
  /** 16px icon shown in the menu and on the event. Defaults to a camera */
  icon?: React.ReactNode;
  /** Muted text at the end of the menu item, e.g. "Connect" */
  hint?: string;
  /**
   * Creates the call for the event, e.g. by asking the service for a
   * meeting link. The panel shows the option as pending until a returned
   * promise settles; a rejected one adds no call.
   */
  createConference: (
    event: DetailedCalendarEvent,
  ) => EventConference | Promise<EventConference>;
}

/**
 * A place the location field suggests while typing
 */
export interface LocationSuggestion {
  /** Name of the place (e.g. "Central Park") */
  name: string;
  /** Address shown under the name and kept after it (e.g. "New York, NY, USA") */
  address?: string;
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
  /**
   * Address the file opens from: a web address, or the object URL the
   * details panel makes for a file attached there. Removing the file in the
   * panel revokes its object URL; otherwise it's yours to revoke
   * (`URL.revokeObjectURL`), e.g. when you delete the event or drop the
   * change. Other schemes, like `javascript:` or `data:`, never open.
   */
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
  /**
   * The event's own color. Without one it takes its calendar's color (the
   * `CalendarInfo` its `calendarId` names), else blue.
   */
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
  /**
   * Account email of the event's calendar, shown when the calendar isn't
   * listed. Moving the event to a listed calendar sets it to that calendar's
   * `email`.
   */
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
  /**
   * Dates a repeating event skips (RFC 5545 EXDATE). Each is the start of
   * an occurrence; the occurrence on that day, in the event's `timeZone`,
   * is left out. `.ics` import fills it from EXDATE and from cancelled
   * occurrences; export writes it as EXDATE
   */
  excludedDates?: Date[];
  /**
   * On an occurrence of a repeating event: the id of the series' event.
   * The views generate occurrences with it, and an edited occurrence is
   * stored with it (in `.ics`, the series' UID)
   */
  seriesId?: string;
  /**
   * On an occurrence of a repeating event: its start in the series, before
   * any edit (RFC 5545 RECURRENCE-ID). It says which date an edited
   * occurrence stands for
   */
  originalStart?: Date;
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
 * Start and end of a new event: the slot that was double-clicked, the range
 * that was dragged over, or the days picked in the all-day row or month view
 */
export interface NewEventRange {
  /**
   * Start, snapped to `snapMinutes`. For whole days, midnight that starts
   * the first day
   */
  start: Date;
  /**
   * End: start + `defaultEventDuration` for a double-clicked slot (kept
   * inside the visible hours and that day), the other end of a dragged
   * range, or, for whole days, midnight that starts the last day
   */
  end: Date;
  /**
   * Whether the range covers whole days: it comes from the all-day row or
   * the month view, and the new event is all-day
   */
  isAllDay?: boolean;
}

/**
 * Where a press-and-drag that draws a new event is: its first report
 * ("start"), a later one ("move"), or the release ("end")
 */
export type EventDrawPhase = "start" | "move" | "end";

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
 * A stretch of time, `end` exclusive: a busy time, or free time everyone
 * shares while meeting with people
 */
export interface TimeSpan {
  start: Date;
  end: Date;
}

/**
 * Days and hours, on the calendar's clock (its `timeZone`, else the
 * viewer's), the free times everyone shares are looked for in while meeting
 * with people
 */
export interface WorkingHours {
  /** Days of the week they apply to, 0 (Sunday) to 6 (Saturday) */
  days: RecurrenceWeekday[];
  /** Hour (0-23) they start at */
  startHour: number;
  /** Hour (1-24) they end at, after `startHour` */
  endHour: number;
}

/**
 * Where `pasteEvent()` puts the next paste: the time slot (day and week
 * view) or the day (month view) a view last had the mouse over
 */
export interface EventPasteTarget {
  /** The slot's start, or any time on the day */
  date: Date;
  /**
   * Whether `date` is a time slot to start at. False for a day: the copy
   * keeps its own time of day
   */
  hasTime: boolean;
}

/** What one undo step did, named in its undo and redo announcements */
export type EventHistoryAction =
  | "create"
  | "edit"
  | "delete"
  | "cut"
  | "duplicate"
  | "paste";

/**
 * One event's part of an undo step: the event before and after it. A `null`
 * `before` means the step added the event; a `null` `after` that it removed it.
 */
export interface EventHistoryChange<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  before: TEvent | null;
  after: TEvent | null;
  /**
   * The event's place in the events list: where an added event went, or
   * where a removed one was (undoing the removal puts it back there)
   */
  index: number;
}

/** One undo step: the changes one action made, each to a different event */
export interface EventHistoryEntry<
  TEvent extends CalendarEvent = CalendarEvent,
> {
  action: EventHistoryAction;
  changes: EventHistoryChange<TEvent>[];
  /** When it was recorded, in milliseconds since the epoch, to merge quick edits */
  time: number;
}

/** The steps `undo` and `redo` walk through */
export interface EventHistory<TEvent extends CalendarEvent = CalendarEvent> {
  /** Steps `undo` takes back, the latest last */
  past: EventHistoryEntry<TEvent>[];
  /** Steps `redo` does again, the latest undone last */
  future: EventHistoryEntry<TEvent>[];
}

/**
 * Which events of a repeating series a change to one of its dates applies
 * to: "this" date, the "following" ones (it and every one after it, which
 * splits the series) or "all" of them
 */
export type SeriesEditScope = "this" | "following" | "all";

/**
 * Options of `getSeriesEditChanges`
 */
export interface SeriesEditOptions<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> {
  /** The stored events: series, their exceptions and one-off events */
  events: TEvent[];
  /** The date as the views drew it, before the change */
  before: TEvent;
  /** The date with the change applied */
  after: TEvent;
  /** Which events of the series the change applies to */
  scope: SeriesEditScope;
  /** Id of the series "following" starts */
  newSeriesId: string;
}

/**
 * What `getSeriesEditChanges` returns
 */
export interface SeriesEditResult<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> {
  /** The changes to apply and record as one undo step, in report order */
  changes: EventHistoryChange<TEvent>[];
  /**
   * Id the views draw the changed date under afterwards, so it stays
   * selected, or `null` when the change leaves no date on its day
   */
  occurrenceId: string | null;
}

/**
 * Options of `getSeriesDeleteChanges`
 */
export interface SeriesDeleteOptions<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
> {
  /** The stored events: series, their exceptions and one-off events */
  events: TEvent[];
  /** The date to delete, as the views drew it */
  event: TEvent;
  /** Which events of the series to delete */
  scope: SeriesEditScope;
}

/**
 * One line of the edit question's summary: a field, its new value and its
 * old one. A field the summary can't show as text (participants, links,
 * ...) has `null` values and shows its label alone.
 */
export interface EventChangeSummaryRow {
  /** "Time", "Title", "Repeat", ... */
  label: string;
  /** The new value, or `null` */
  after: string | null;
  /** The old value, struck through, or `null` */
  before: string | null;
}

/**
 * The question `EventSeriesScopeDialog` asks while a change to a repeating
 * event's date waits for its answer
 */
export interface SeriesScopeQuestion {
  /** Whether a change ("update") or a delete waits */
  action: "update" | "delete";
  /** The event's title before the change, quoted in the question */
  title: string;
  /** The options, in order, the first selected. See `getSeriesEditScopes` */
  scopes: SeriesEditScope[];
  /** What changed, for the edit question. Empty for a delete */
  summary: EventChangeSummaryRow[];
}

/**
 * An answer to the series scope question: save or delete with the chosen
 * option, or one of the other buttons
 */
export type SeriesScopeAnswer =
  | { action: "save" | "delete"; scope: SeriesEditScope }
  | { action: "discard" | "continue" | "cancel" };

/**
 * A short message the calendar shows after an action, as Notion Calendar's
 * toasts do: "Event deleted", "Event cut", "Event copied to clipboard".
 * `CalendarToaster` draws it; `useCalendarNotice()` returns it.
 */
export interface CalendarNotice {
  /** Counts up with every notice shown, so a repeated message is a new toast */
  id: number;
  /** The first line, e.g. "Event deleted" */
  message: string;
  /**
   * The second line: an event's title, which `CalendarToaster` shows in
   * curly quotes. No second line without it
   */
  title?: string;
  /** Takes the action back. `CalendarToaster` shows an Undo button only with it */
  onUndo?: () => void;
}

/** What `showNotice` takes: a notice without its `id` */
export type CalendarNoticeInput = Omit<CalendarNotice, "id">;

/** What `useCalendarNotice()` returns */
export interface CalendarNoticeValue {
  /** The notice to show now, or `null`. One at a time: a new one replaces it */
  notice: CalendarNotice | null;
  /**
   * Shows a notice of your own in place of the one on screen, and reads it
   * out in the provider's live region
   */
  showNotice: (notice: CalendarNoticeInput) => void;
  /** Closes the notice with this id. Does nothing once a newer one replaced it */
  dismissNotice: (id: number) => void;
}

/**
 * A stretch of time marked as open while scheduling: one block on the time
 * grid and one time in the text that gets copied. It starts and ends on the
 * same day (an end at midnight is the end of that day).
 */
export interface AvailabilityRange {
  /** Stays the same while the range is moved or resized */
  id: string;
  start: Date;
  end: Date;
}

/** Notion Calendar's two kinds of scheduling link */
export type SchedulingLinkKind = "recurring" | "one-off";

/**
 * What a scheduling link is asked for with: the app creates the booking page
 * (CalendarCN has no backend for it) from these.
 */
export interface SchedulingLinkRequest {
  kind: SchedulingLinkKind;
  /** Length of the meeting people book, in minutes: the scheduling panel's duration */
  durationMinutes: number;
  /**
   * The open times marked on the calendar, merged and in order, for a
   * one-off link. Empty for a recurring link, whose weekly hours your app
   * asks for
   */
  ranges: AvailabilityRange[];
  /** IANA zone the times were picked in: the viewer's */
  timeZone: string;
}

/** What scheduling is picking open times for */
export type SchedulingPurpose = "share" | "one-off-link";

/** Options of `formatAvailabilityText()` */
export interface AvailabilityTextOptions {
  /** Length of the meeting asked for, in minutes ("Would 30 min ...") */
  durationMinutes: number;
  hourCycle: HourCycle;
  /** Day, month and AM/PM names */
  locale: Locale;
  /** Now: times on its day and the next read "today" and "tomorrow". Defaults to the current time */
  now?: Date;
  /** A booking page, added after the times ("You can just let me know or confirm here: ...") */
  link?: string;
}

/** What `useScheduling()` returns inside a `SchedulingProvider` */
export interface SchedulingContextValue {
  /** Whether open times are being marked on the day and week views */
  isPicking: boolean;
  /** What the times are for: copying them as text, or a one-off scheduling link */
  purpose: SchedulingPurpose;
  /** The marked times, merged and in order */
  ranges: AvailabilityRange[];
  /** Id of the marked time selected on the grid (Delete removes it), or `null` */
  selectedRangeId: string | null;
  /** Length of the meeting asked for, in minutes. 30 at first */
  durationMinutes: number;
  /** The text "Copy" puts on the clipboard; empty while no time is marked */
  text: string;
  /** Whether the app creates scheduling links (it passed `onCreateSchedulingLink`) */
  canCreateLinks: boolean;
  /**
   * Starts marking open times, from none, in the week view when the
   * calendar is in month, year or agenda view. Clears the event selection
   */
  startPicking: (purpose?: SchedulingPurpose) => void;
  /**
   * Stops marking and drops the marked times, changing no event. No event
   * is left selected, as when marking starts
   */
  cancelPicking: () => void;
  /** Marks a time, merged with the marked times it overlaps or touches */
  addRange: (range: Omit<AvailabilityRange, "id">) => void;
  /** Moves or resizes a marked time */
  updateRange: (range: AvailabilityRange) => void;
  /** Removes a marked time, with an Undo toast */
  removeRange: (id: string) => void;
  /** Selects a marked time, or none with `null` */
  selectRange: (id: string | null) => void;
  setDurationMinutes: (minutes: number) => void;
  /** Copies `text` to the clipboard and confirms it with a toast. Resolves to whether it was copied */
  copyText: () => Promise<boolean>;
  /** "Copy" in the panel: copies `text`, then stops marking once it's copied */
  copyAndFinish: () => Promise<void>;
  /**
   * Starts a scheduling link: a recurring one goes straight to the app's
   * `onCreateSchedulingLink`, a one-off one marks times first. Does nothing
   * without `onCreateSchedulingLink`
   */
  createSchedulingLink: (kind: SchedulingLinkKind) => void;
  /** "Create" of a one-off link: hands the marked times to the app and stops marking */
  finishSchedulingLink: () => void;
}

/**
 * A calendar events can belong to (e.g. "Work"), listed by the details
 * panel's calendar picker and the event context menu's "Block on calendar"
 * submenu
 */
export interface CalendarInfo {
  /** Stored in the event's `calendarId` when picked */
  id: string;
  /** Display name */
  name: string;
  /**
   * The calendar's color. Its events take it until they are given their own
   * `color`.
   */
  color: EventColor;
  /** Account the calendar belongs to; calendars are grouped under it */
  email?: string;
  /**
   * A calendar followed rather than owned, like a holidays feed. The calendar
   * list marks it with a feed icon.
   */
  isSubscribed?: boolean;
  /**
   * Reminders an event gets on this calendar. Only moving an event applies
   * them: one moved here that still has its previous calendar's defaults
   * takes these instead, and reminders edited by hand are kept. Creating an
   * event never adds them; give new events reminders in `createEvent`.
   */
  defaultReminders?: EventReminder[];
}

/**
 * Calendars that share an account, listed under its email by the calendar
 * pickers (`groupCalendarsByEmail()`)
 */
export interface CalendarGroup {
  /** Account email shown above the group; absent for calendars without one */
  email?: string;
  calendars: CalendarInfo[];
}

/**
 * Display and interaction settings set on CalendarProvider, read with
 * `useCalendarConfig()`. Every field has a default, listed on the matching
 * provider prop.
 */
export interface CalendarConfig {
  /** Minute step that timed-event drag, resize and new events snap to */
  snapMinutes: number;
  /** Length in minutes of an event created by double-clicking an empty slot */
  defaultEventDuration: number;
  /** First hour (0-23) the time grid shows */
  dayStartHour: number;
  /** Hour (1-24) the time grid ends at; the last row is `dayEndHour - 1` */
  dayEndHour: number;
  /** Clock style for every time label */
  hourCycle: HourCycle;
  /** date-fns locale for day names, month names and dates */
  locale: Locale;
  /**
   * IANA zone whose hours the day and week views show in a second column
   * beside the time axis. Unset when there is none, or when the provider's
   * `secondaryTimeZone` is a zone the runtime doesn't know.
   */
  secondaryTimeZone?: string;
  /**
   * IANA zone the views draw in: the provider's `timeZone` when the runtime
   * knows it, else `undefined` (the viewer's zone). Event times from
   * `useCalendar()` read on its clock; `fromZonedWallClock(date, timeZone)`
   * turns one back into an instant. While travelling, the zone travelled to.
   */
  timeZone?: string;
  /**
   * Additional zones the day and week views show left of the time axis,
   * left to right: the provider's `secondaryTimeZones` (or
   * `secondaryTimeZone`) that the runtime knows. While travelling, the
   * home zone follows them. `secondaryTimeZone` is the first one
   */
  secondaryTimeZones: string[];
  /**
   * Day the week starts on, for date pickers. Unset outside a
   * CalendarProvider, where the locale's first day applies.
   */
  weekStartsOn?: WeekStartsOn;
  /** Calendars offered by the details panel's calendar picker and the event context menu */
  calendars: CalendarInfo[];
  /** People the details' participants field suggests */
  contacts: EventContact[];
  /** Meeting rooms the details' participants field offers */
  rooms: EventRoom[];
  /** Conferencing services the details offer; none hides the row */
  conferenceProviders: ConferenceProviderOption[];
  /** Places the details' location field suggests */
  locationSuggestions: LocationSuggestion[];
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
   * Whether the event was just created on the calendar, so its title
   * should be focused. True on the first render after creation only.
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
         * Builds a new event for a range: the draft drawn on the calendar,
         * or the event `addEventFromRange` adds. Return `null` to create
         * nothing. Defaults to an untitled event with a random UUID.
         */
        createEvent?: (range: NewEventRange) => TEvent | null;
      }
    : {
        /**
         * Builds a new event for a range: the draft drawn on the calendar,
         * or the event `addEventFromRange` adds. Return `null` to create
         * nothing. Required because `TEvent` has required fields the
         * default untitled event can't fill.
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
   * create, edit, delete, duplicate, cut, paste, undo, redo, or the events
   * an answer to the series scope question changes). A repeating event
   * stays one event in it; an edited occurrence is added as an event of its
   * own
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
   * today's period (today in day and agenda views, January 1 in year view,
   * the start of this week otherwise).
   * Today is unknown during server rendering and hydration, so without
   * `date` or `defaultDate` the provider renders nothing until hydration ends.
   */
  defaultDate?: Date;
  /** Called when the displayed date changes (navigation or scroll) */
  onDateChange?: (date: Date) => void;
  /**
   * Day the week starts on, 0 (Sunday) to 6 (controlled). Every view and the
   * mini calendar follow it
   */
  weekStartsOn?: WeekStartsOn;
  /** Initial week start when `weekStartsOn` is not controlled. Defaults to 0 (Sunday) */
  defaultWeekStartsOn?: WeekStartsOn;
  /** Called when the week start changes ("Start week on..." in the command menu) */
  onWeekStartsOnChange?: (weekStartsOn: WeekStartsOn) => void;
  /**
   * Height of an hour in the day and week views, in pixels (controlled).
   * `null` fills the screen with the visible hours, at least 48px an hour.
   * Zooming steps through `HOUR_HEIGHT_STEPS`
   */
  hourHeight?: number | null;
  /** Initial hour height when `hourHeight` is not controlled. Defaults to `null` (fill the screen) */
  defaultHourHeight?: number | null;
  /** Called when the hour height changes (zooming in or out, or back to the default) */
  onHourHeightChange?: (hourHeight: number | null) => void;
  /**
   * Number of days the week view shows (controlled). Below 7, the columns
   * start on the current day and prev/next move by that many days; from 7
   * up they start on the week's first day and prev/next move by a week.
   * With weekends hidden they count weekdays, and 7 shows the week's five.
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
  /** Minute step that timed-event drag, resize and new events snap to. Defaults to 15 */
  snapMinutes?: number;
  /**
   * Length in minutes of an event created by double-clicking an empty time
   * slot. Defaults to 30, as in Notion Calendar
   */
  defaultEventDuration?: number;
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
   * IANA time zone (e.g. "Asia/Kolkata") whose hours the day and week views
   * show in a second column, left of the time axis, as Notion Calendar's
   * additional time zone. Each column gets its zone's short label at the
   * top, and the current-time line keeps its one badge, in the viewer's column. A zone the runtime
   * doesn't know is ignored. Defaults to none
   */
  secondaryTimeZone?: string;
  /**
   * IANA time zone the views draw in (e.g. "Asia/Tokyo"), as Notion
   * Calendar's primary time zone: events, today, the current-time line, the
   * first day of each week, a new event and the details' times
   * follow its clock, and the time axis is labeled with it. What you pass in
   * and get back stays instants (`events`, `onEventsChange`, `onEventCreate`,
   * `onEventUpdate`, `createEvent`'s range, `onVisibleRangeChange`'s range);
   * inside the provider (`useCalendar()`, the render slots) event times are
   * Dates whose local time reads this zone's clock. Days stay calendar
   * dates. A zone the runtime doesn't know is ignored. Defaults to the
   * viewer's zone
   */
  timeZone?: string;
  /** Initial `timeZone` when it isn't controlled. Defaults to the viewer's zone */
  defaultTimeZone?: string;
  /**
   * Called when the primary zone changes from the time zone labels or
   * commands ("Make time zone primary", "Add as primary time zone")
   */
  onTimeZoneChange?: (timeZone: string) => void;
  /**
   * Additional IANA zones whose hours the day and week views show in
   * columns left of the time axis, left to right, as Notion Calendar's
   * additional time zones. Takes over from `secondaryTimeZone`. Zones the
   * runtime doesn't know are left out
   */
  secondaryTimeZones?: string[];
  /** Initial `secondaryTimeZones` when they aren't controlled. Defaults to none */
  defaultSecondaryTimeZones?: string[];
  /**
   * Called when the additional zones change from the time zone labels or
   * commands (added, changed, removed or made primary)
   */
  onSecondaryTimeZonesChange?: (timeZones: string[]) => void;
  /**
   * Calendars the details panel's calendar picker offers, grouped by `email`,
   * and the event context menu under "Block on calendar" (hidden when
   * empty). Both move the event with `moveEventToCalendar()`. An event
   * without its own `color` is drawn in its calendar's. Defaults to none
   */
  calendars?: CalendarInfo[];
  /**
   * People the details' participants field suggests: recent ones before
   * typing, the matches while typing. Defaults to none (a typed email can
   * still be invited)
   */
  contacts?: EventContact[];
  /**
   * Meeting rooms the details' participants field lists under "Rooms and
   * resources". Defaults to none, which hides that list
   */
  rooms?: EventRoom[];
  /**
   * Conferencing services the details' "Conferencing" menu offers, each
   * creating its calls with its own `createConference`. Defaults to none,
   * which hides the row (an event's existing call still shows)
   */
  conferenceProviders?: ConferenceProviderOption[];
  /**
   * Places the details' location field suggests while typing. Defaults to
   * none (the typed text is kept as the location)
   */
  locationSuggestions?: LocationSuggestion[];
  /**
   * Emails of the people you're meeting with (controlled): "Meet with..."
   * draws their events beside yours in day and week view, highlights the
   * times you're all free, and an event created meanwhile invites them
   */
  meetWith?: string[];
  /** People met with at first when `meetWith` is not controlled. Defaults to none */
  defaultMeetWith?: string[];
  /** Called with the new emails when someone is added to or taken out of the meeting */
  onMeetWithChange?: (meetWith: string[]) => void;
  /**
   * Emails of the teammates whose calendars show beside yours in day and
   * week view (controlled), as "Show teammate calendar..." adds them
   */
  teammates?: string[];
  /** Teammates shown at first when `teammates` is not controlled. Defaults to none */
  defaultTeammates?: string[];
  /** Called with the new emails when a teammate's calendar is shown or hidden */
  onTeammatesChange?: (teammates: string[]) => void;
  /**
   * Other people's events by email, drawn while you meet with them or show
   * their calendar. Load them when `onMeetWithChange`, `onTeammatesChange`
   * or `onVisibleRangeChange` fires, from Google Calendar's free/busy for
   * example (an event titled "Busy" per busy time). Defaults to none
   */
  contactEvents?: Record<string, DetailedCalendarEvent[]>;
  /**
   * Days and hours, on the calendar's clock (`timeZone`, else the
   * viewer's), the free times you and the people you meet with share are
   * looked for in. Defaults to 9 AM to 5 PM, Monday to Friday
   */
  workingHours?: WorkingHours;
  /**
   * Called after an event is added: a draft saved by its first edit, one
   * `addEventFromRange` adds, a duplicate or a paste, an occurrence of a
   * repeating event stored on its first edit (with `seriesId` and
   * `originalStart`), a new series that "This and following events" starts
   * and the dates it takes over, or one `undo` or `redo` brings back. A
   * draft that is thrown away is never reported
   */
  onEventCreate?: (event: TEvent) => void;
  /**
   * Called after an event is changed (drag, resize, an edit in the details,
   * a series an answer to the scope question changes, or `undo` or `redo`
   * changing it back)
   */
  onEventUpdate?: (event: TEvent) => void;
  /**
   * Called after an event is removed: deleted, cut, or taken away again by
   * `undo` or `redo` (an undone create, duplicate or paste)
   */
  onEventDelete?: (event: TEvent) => void;
  /**
   * Called whenever an event is selected: clicked, just added, or a draft
   * that was just drawn (with the id it keeps once it is saved)
   */
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
  /**
   * The stored events. A repeating event is one event here; the views
   * draw its occurrences with `expandRecurringEvents`
   */
  events: TEvent[];
  /** Active view */
  view: ViewType;
  /** First day of the displayed period */
  currentDate: Date;
  /** Day the week starts on */
  weekStartsOn: WeekStartsOn;
  /** Number of days the week view shows */
  numberOfDays: number;
  /**
   * Height of an hour in the day and week views, in pixels, or `null` while
   * the hours fill the screen (the default size)
   */
  hourHeight: number | null;
  /** Display preferences toggled from the view menu */
  viewSettings: ViewSettings;
  /**
   * Days the day/week view currently shows, updated live while it scrolls
   * horizontally, or the days the agenda covers. Empty in month and year
   * view.
   */
  visibleDays: Date[];
  /**
   * First day of the month the month view shows (follows its vertical
   * scroll), or `null` before month view has rendered
   */
  displayMonth: Date | null;
  /**
   * Dates the view draws (end exclusive): the visible days in day and week
   * view (from the first weekday to the last while weekends are hidden), the
   * whole six-week grid in month view, trimmed to the first and last weekday
   * when it hides weekends. Follows settled
   * navigation, so a horizontal scroll moves it once it snaps. Year view
   * spans its year, January 1 to the next January 1.
   */
  visibleRange: VisibleRange;
  /** Whether the provider's `loading` prop is set */
  loading: boolean;
  /**
   * ID of the selected event, or `null`. Also `null` while several events
   * are selected: then `selectedEventIds` lists them, and no event shows
   * its details
   */
  selectedEventId: string | null;
  /**
   * IDs of every selected event, in the order they were selected: the one
   * `selectedEventId` names, or the several picked with Shift- or Cmd-click
   * and "Select all visible". Empty when nothing is selected
   */
  selectedEventIds: string[];
  /**
   * The selected event: a stored one, or the generated occurrence its id
   * names. `null` when nothing (or a missing event) is selected
   */
  selectedEvent: TEvent | null;
  /**
   * The selected event's previous occurrence in its repeating series (see
   * `findSeriesOccurrence`): the event stored for that date or the one
   * generated for it. `null`: nothing selected, the event doesn't repeat,
   * or it is the series' first
   */
  previousInSeries: SeriesOccurrence<TEvent> | null;
  /**
   * The selected event's next occurrence in its repeating series, or `null`:
   * nothing selected, the event doesn't repeat, or the series ends with it
   */
  nextInSeries: SeriesOccurrence<TEvent> | null;
  /**
   * Selects an occurrence of the selected event's series
   * (`previousInSeries` or `nextInSeries`) and shows it, moving to its
   * period when it is off screen. Nothing is added: a generated occurrence
   * is selected as it is.
   */
  showSeriesOccurrence: (occurrence: SeriesOccurrence<TEvent>) => void;
  /**
   * The zones beside the time axis: the primary one (`timeZone`, the
   * viewer's when unset) and the additional ones
   */
  timeZones: CalendarTimeZones;
  /**
   * Changes the zones: gets them with the primary zone resolved (the
   * viewer's when unset) and returns the new ones. The helpers in
   * `@/lib/time-zones` (`addTimeZone`, `removeTimeZone`,
   * `makeTimeZonePrimary`, ...) build the change
   */
  changeTimeZones: (
    change: (timeZones: CalendarTimeZones) => CalendarTimeZones,
  ) => void;
  /**
   * The zone the calendar travelled to, drawn as the primary one until
   * `travelToTimeZone(null)`, or `null` at home
   */
  travelTimeZone: string | null;
  /**
   * Travels to a zone, as Notion Calendar's "Travel to time zone": the
   * calendar draws in it for now, with the home zones beside it. `null`
   * travels back home
   */
  travelToTimeZone: (timeZone: string | null) => void;
  /** Day briefly highlighted after `showDay`, or `null` */
  highlightedDate: Date | null;
  /** Month name for the header (e.g. "October"). Empty in year view, where the header names the year alone */
  monthName: string;
  /** Four-digit year for the header (e.g. "2026") */
  year: string;
  /** Week number of the displayed week */
  weekNumber: number;
  /** Goes to the period that contains today */
  goToToday: () => void;
  /** Goes back one period (day, week, month, year or agenda range, by view) */
  goToPrev: () => void;
  /** Goes forward one period (day, week, month, year or agenda range, by view) */
  goToNext: () => void;
  /** Sets the first displayed day as given (no snapping to a week start) */
  goToDate: (date: Date) => void;
  /** Switches the view, snapping the date to the new view's period. Year view opens on the year the header shows */
  switchView: (view: ViewType) => void;
  /** Sets how many days the week view shows */
  setNumberOfDays: (numberOfDays: number) => void;
  /** Selects an event, alone */
  selectEvent: (eventId: string) => void;
  /**
   * Clears the selection (closes the event popover). Throws an unsaved
   * `eventDraft` away
   */
  clearSelection: () => void;
  /**
   * The event being created, drawn and selected but not stored yet, or
   * `null`. It isn't in `events`. `updateEvent` with it saves it, and
   * selecting anything else (or nothing) throws it away
   */
  eventDraft: TEvent | null;
  /**
   * Starts a draft for a range via `createEvent`, selects it and focuses its
   * title. Nothing is stored and `onEventCreate` doesn't run until the
   * draft is saved: by naming it (Enter, or leaving the title) or by
   * changing any other field. A draft that is open already is replaced
   */
  startEventDraft: (range: NewEventRange) => void;
  /**
   * Changes the draft without saving it, to preview what is being typed or
   * dragged. Ignored unless `event` has the draft's id
   */
  updateEventDraft: (event: TEvent) => void;
  /**
   * Selects these events: none clears the selection, one selects it as
   * `selectEvent` does, several select them together
   */
  setSelectedEventIds: (eventIds: string[]) => void;
  /**
   * Adds an event to the selection, or takes it out when it is in it: what
   * Shift- and Cmd-click on an event do
   */
  toggleEventSelection: (eventId: string) => void;
  /**
   * Selects every event on the dates on screen (Notion Calendar's "Select
   * all visible", Cmd+A). Does nothing in year view, which draws no events
   */
  selectAllVisible: () => void;
  /**
   * Adds an event for a range via `createEvent` at once, selects it and
   * focuses its title. `startEventDraft` waits for a first edit instead
   */
  addEventFromRange: (range: NewEventRange) => void;
  /**
   * Replaces the event with the same id. For a date of a repeating event, a
   * mounted view first asks which events the change applies to ("This
   * event", "This and following events" or "All events"); pass `scope` to
   * apply it without asking. A scope the change doesn't allow (like "this"
   * for a repeat rule change) applies as the first one it does. Moving one
   * of several selected events moves them all by as much, as one undo step,
   * without asking. The `eventDraft` is saved instead: added, reported once
   * through `onEventCreate` and undoable
   */
  updateEvent: (event: TEvent, scope?: SeriesEditScope) => void;
  /**
   * Changes the event the way a field of the event details does. A date of
   * a repeating event, while selected, keeps the change pending: drawn with
   * a dot before its title, and asked about once the event is left. Any
   * other event changes at once, as with `updateEvent`.
   */
  editEvent: (event: TEvent) => void;
  /**
   * Deletes the event through `onEventsChange` and `onEventDelete`, and
   * clears the selection when it was selected. Undoable. For a date of a
   * repeating event, a mounted view first asks which events to delete;
   * pass `scope` to delete without asking. On one of several selected
   * events, deleting, duplicating, copying and cutting act on all of them,
   * as one undo step, and a repeating event's date among them goes alone,
   * without asking
   */
  deleteEvent: (eventId: string, scope?: SeriesEditScope) => void;
  /**
   * Adds a copy of the event at the same time, with a new id from
   * `crypto.randomUUID()`, through `onEventsChange` and `onEventCreate`, and
   * selects it. Undoable
   */
  duplicateEvent: (eventId: string) => void;
  /** Keeps a copy of the event for `pasteEvent`. Changes no event */
  copyEvent: (eventId: string) => void;
  /** Keeps a copy of the event for `pasteEvent`, then deletes it. Undoable */
  cutEvent: (eventId: string) => void;
  /**
   * Adds a copy of the cut or copied event, with a new id, and selects it:
   * at the time slot under the mouse in day and week view, on the day under
   * it in month view at the event's own time of day, else today or the
   * first day on screen. All-day events stay all-day. Does nothing when
   * nothing was cut or copied. Undoable
   */
  pasteEvent: () => void;
  /**
   * Undoes the latest create, move, resize, edit, delete, duplicate, cut or
   * paste: reports it through `onEventsChange` and `onEventCreate`,
   * `onEventUpdate` or `onEventDelete`, and selects the event it brings
   * back or changes
   */
  undo: () => void;
  /** Does again the latest step `undo` took back */
  redo: () => void;
  /**
   * Whether `undo` has a step to take back: false with none, or once the
   * app replaced or removed one of that step's events itself
   */
  canUndo: boolean;
  /** Whether `redo` has a step to do again. Any new change clears them */
  canRedo: boolean;
  /**
   * Starts the week on another day. A full week or month on screen moves to
   * the week that starts on it, around the same dates
   */
  setWeekStartsOn: (weekStartsOn: WeekStartsOn) => void;
  /** Makes the hours taller by one step of `HOUR_HEIGHT_STEPS`, up to the largest */
  zoomHoursIn: () => void;
  /** Makes the hours shorter by one step of `HOUR_HEIGHT_STEPS`, down to the smallest */
  zoomHoursOut: () => void;
  /** Goes back to the default hour height, which fills the screen */
  resetHourHeight: () => void;
  /**
   * Shows or hides the weekend. Hiding it in day view, or in a week view
   * shorter than a week, moves a Saturday or Sunday on screen to Monday
   */
  toggleWeekends: () => void;
  /**
   * Shows or hides the events the viewer declined. Hiding them clears the
   * selection when the selected event is one
   */
  toggleDeclinedEvents: () => void;
  /** Shows or hides week numbers */
  toggleWeekNumbers: () => void;
  /** Opens the week containing `date` and briefly highlights that day */
  showDay: (date: Date) => void;
  /**
   * Shows the period that contains `date` in the current view, as Go to
   * date does, and briefly highlights that day in the day and week views
   */
  navigateToDate: (date: Date) => void;
  /**
   * Starts a draft at the next half hour, as Notion Calendar's C key and
   * "Create event..." do: today when it's on screen, else the day last
   * highlighted, else the first day shown. `defaultEventDuration` long (kept
   * inside the visible hours), or all-day in month view, through
   * `startEventDraft`: drawn as an event with its title focused, and stored
   * by its first edit
   */
  addEventAtNextSlot: () => void;
}

/**
 * A keyboard shortcut in a list of them, as the details sidebar's full
 * shortcut list shows it
 */
export interface KeyboardShortcut {
  /** What the keys do, e.g. "Go to today" */
  label: string;
  /** Keys pressed together, each shown as a key cap: ["⌘", "K"] */
  keys: string[];
  /** Other keys that do the same, each listed after "or": [["1"]] beside D */
  alternativeKeys?: string[][];
  /** More words the list's find field matches, besides the label and keys */
  keywords?: string[];
}

/**
 * A titled group of keyboard shortcuts. `sections` hold the ones that act on
 * something, under a heading of their own ("With a selected event...")
 */
export interface KeyboardShortcutGroup {
  heading: string;
  shortcuts: KeyboardShortcut[];
  sections?: KeyboardShortcutGroup[];
}

/** A color theme: the system's, or light or dark */
export type CalendarTheme = "system" | "light" | "dark";
