"use client";

import * as React from "react";
import {
  addDays,
  addMonths,
  addYears,
  getYear,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { enUS } from "date-fns/locale";

import { useControllableState } from "@/hooks/use-controllable-state";
import { useToday } from "@/hooks/use-now";
import { EventTitleFocusProvider } from "./event-title-focus-context";
import {
  CalendarPeopleProvider,
  useCalendarPeopleState,
} from "./calendar-people";
import {
  AGENDA_DAYS,
  DEFAULT_EVENT_DURATION_MINUTES,
  EVENT_COLORS,
  addShownDays,
  describeEventChange,
  describeEventCreated,
  describeEventDraft,
  describeEventTime,
  getAllDayEventRange,
  getCalendarHeaderInfo,
  getEventChangeSummary,
  getFirstShownDay,
  getNextSlotDay,
  getNextSlotEventRange,
  getSpokenTitle,
  getPeriodStart,
  getVisibleDays,
  getVisibleRange,
  getWeekViewStepDays,
  getZoomedHourHeight,
  isDeclinedByViewer,
  stepsByDay,
} from "@/lib/event-utils";
import {
  EMPTY_EVENT_HISTORY,
  EVENT_HISTORY_MERGE_MS,
  applyEventChanges,
  canApplyEventChanges,
  describeEventAction,
  describeEventNotice,
  describeHistoryStep,
  getChangedEventId,
  getPastedEventTimes,
  invertEventChanges,
  recordEventHistory,
  resolvePasteTarget,
} from "@/lib/event-history";
import {
  applyRecurringEdit,
  createStandaloneCopy,
  findEventOrOccurrence,
  findEventSeries,
  findSeriesOccurrence,
  getSeriesDeleteChanges,
  getSeriesDeleteScopes,
  getSeriesEditChanges,
  getSeriesEditScopes,
} from "@/lib/recurrence";
import {
  fromDisplayEvent,
  fromDisplayRange,
  getViewerTimeZone,
  getZonedNow,
  isKnownTimeZone,
  toDisplayEvent,
  toZonedWallClock,
} from "@/lib/time-zones";
import { addMeetingParticipants, findContact } from "@/lib/people";
import {
  describeGroupAction,
  describeGroupNotice,
  getEventRemovalChanges,
  getGroupMoveTimes,
  getPastedGroupTimes,
  getVisibleEventIds,
  isEventMove,
  mergeEventChanges,
  toggleSelectedEventId,
} from "@/lib/event-selection";
import type {
  CalendarConfig,
  CalendarContextValue,
  CalendarEvent,
  CalendarInfo,
  CalendarNotice,
  CalendarNoticeInput,
  CalendarNoticeValue,
  CalendarProviderProps,
  CalendarRenderSlots,
  CalendarTimeZones,
  ConferenceProviderOption,
  DetailedCalendarEvent,
  EventContact,
  EventContentProps,
  EventDrawPhase,
  EventHistory,
  EventHistoryAction,
  EventHistoryChange,
  EventHistoryEntry,
  EventPasteTarget,
  EventRoom,
  HourCycle,
  LocationSuggestion,
  NewEventRange,
  SeriesEditScope,
  SeriesOccurrence,
  SeriesScopeAnswer,
  SeriesScopeQuestion,
  ViewSettings,
  ViewType,
  VisibleRange,
  WeekStartsOn,
} from "./calendar-types";

/**
 * `process.env.NODE_ENV` gates the development-only warnings. Bundlers
 * replace it at build time (Next.js, Vite, webpack), so it works without
 * Node's types; declaring it here keeps type-checking and `no-undef`
 * linting passing in projects that don't have them.
 */
declare const process: { env: { NODE_ENV?: string } };

/** Title of a new event when no `createEvent` factory is given */
const DEFAULT_NEW_EVENT_TITLE = "";

/** How long the day opened by `showDay` stays highlighted, in milliseconds */
const HIGHLIGHT_DURATION_MS = 2000;

/** Days the week view shows when `numberOfDays` is not set */
const DEFAULT_NUMBER_OF_DAYS = 7;

/** Minute step drag, resize and new events snap to when `snapMinutes` is not set */
const DEFAULT_SNAP_MINUTES = 15;

/** First hour the time grid shows when `dayStartHour` is not set (midnight) */
const DEFAULT_DAY_START_HOUR = 0;

/** Hour the time grid ends at when `dayEndHour` is not set (next midnight) */
const DEFAULT_DAY_END_HOUR = 24;

/** Clock style when `hourCycle` is not set */
const DEFAULT_HOUR_CYCLE: HourCycle = 12;

/** Week start when neither `weekStartsOn` nor `defaultWeekStartsOn` is set (Sunday) */
const DEFAULT_WEEK_STARTS_ON: WeekStartsOn = 0;

/** Days from a week's first day to its middle, which a new week start keeps on screen */
const WEEK_MIDDLE_OFFSET = 3;

/**
 * Hour height zooming starts from when no time grid has reported its own
 * yet: the smallest height the default size fills the screen with
 */
const FALLBACK_HOUR_HEIGHT = 48;

/** Calendars offered by the context menu when `calendars` is not set (stable identity) */
const NO_CALENDARS: CalendarInfo[] = [];

/** Contacts suggested when `contacts` is not set (stable identity) */
const NO_CONTACTS: EventContact[] = [];

/** Rooms offered when `rooms` is not set (stable identity) */
const NO_ROOMS: EventRoom[] = [];

/** Conferencing offered when `conferenceProviders` is not set (stable identity) */
const NO_CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [];

/** Places suggested when `locationSuggestions` is not set (stable identity) */
const NO_LOCATION_SUGGESTIONS: LocationSuggestion[] = [];

/** No additional time zones (stable identity) */
const NO_TIME_ZONES: string[] = [];

/** Config used outside a provider, and for every provider prop left unset */
const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  snapMinutes: DEFAULT_SNAP_MINUTES,
  defaultEventDuration: DEFAULT_EVENT_DURATION_MINUTES,
  dayStartHour: DEFAULT_DAY_START_HOUR,
  dayEndHour: DEFAULT_DAY_END_HOUR,
  hourCycle: DEFAULT_HOUR_CYCLE,
  locale: enUS,
  secondaryTimeZones: NO_TIME_ZONES,
  calendars: NO_CALENDARS,
  eventColors: EVENT_COLORS,
  contacts: NO_CONTACTS,
  rooms: NO_ROOMS,
  conferenceProviders: NO_CONFERENCE_PROVIDERS,
  locationSuggestions: NO_LOCATION_SUGGESTIONS,
};

/** View settings used for every field `defaultViewSettings` leaves unset */
const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  showWeekends: true,
  showDeclinedEvents: true,
  showWeekNumbers: false,
};

/** Initial events when uncontrolled without `defaultEvents` (stable identity) */
const NO_EVENTS: CalendarEvent[] = [];

/** What a mounted view draws, as reported through `reportView` */
interface ReportedView {
  /** The view's type */
  view: ViewType;
  /**
   * Day columns the view is fixed to, or `undefined` when it follows the
   * provider's `numberOfDays`
   */
  numberOfDays?: number;
}

/**
 * Provider state just before a view switch, restored when the mounted view
 * keeps its own type instead of following the switch
 */
interface ViewSwitchSnapshot {
  view: ViewType;
  numberOfDays: number;
  date: Date;
}

/** Inputs of `getAdoptedViewDate` */
interface AdoptedViewDateOptions {
  /** Date the provider shows now */
  currentDate: Date;
  /** View type being adopted */
  view: ViewType;
  /** Day count being adopted */
  numberOfDays: number;
  weekStartsOn: WeekStartsOn;
  /** State before the latest switch, if one is waiting for the view's report */
  pendingSwitch: ViewSwitchSnapshot | null;
  /** Whether the provider still shows its untouched starting date (today's period) */
  isOnStartingToday: boolean;
  /** Whether weekends are shown: day views land on a weekday while they're not */
  showWeekends: boolean;
  /** Now, on the calendar's clock */
  now: Date;
}

/** Days the header's month, year and week number are read from */
interface HeaderDates {
  /** Names the week number, and the month and year unless `headerRangeEnd` is set */
  headerDate: Date;
  /** Last day on screen in day and week view, which names the month and year */
  headerRangeEnd?: Date;
}

/**
 * Setters the views use to report what they currently show. Kept out of
 * `useCalendar()` because only the views write these values.
 */
interface CalendarViewSyncValue {
  /**
   * Any view: which view is mounted. Reported after every commit that
   * changes the view's props or the provider's state, so the provider can
   * adopt it (see CalendarProvider).
   */
  reportView: (reported: ReportedView) => void;
  /** Day/week view: the days on screen, updated live while scrolling */
  reportVisibleDays: (days: Date[]) => void;
  /** Month view: the month on screen, updated while scrolling */
  reportDisplayMonth: (month: Date) => void;
  /**
   * Closes an event's details popover: clears the selection only while
   * that event is still selected. A press on another event selects it
   * before the popover's outside-press dismissal runs, and that new
   * selection must survive it.
   */
  closeEventPopover: (eventId: string) => void;
  /**
   * Time grid and month view: the slot or day under the mouse, where
   * `pasteEvent` puts the next paste
   */
  reportPasteTarget: (target: EventPasteTarget) => void;
  /**
   * Time grid, all-day row and month view: the range a press-and-drag on
   * empty space covers so far. "start" opens a new draft, "move" changes its
   * range and "end" also focuses its title. Cancelling is `clearSelection()`.
   */
  drawEventDraft: (range: NewEventRange, phase: EventDrawPhase) => void;
  /**
   * What the views draw: `events`, plus the draft once it is drawn as an
   * event (see `CalendarEventDraftValue.isTinted`)
   */
  drawnEvents: CalendarEvent[];
  /**
   * Time grid: the hour height it draws, which zooming steps from while
   * the hours fill the screen (`hourHeight` is `null`)
   */
  reportHourHeight: (hourHeight: number) => void;
}

/**
 * The event being created, for the views' draft layers (`event-draft.tsx`):
 * what they tint, and the details popover they keep open across its save.
 * Kept apart from `useCalendar()` so the views' parts, which also render
 * outside a provider, can read it.
 */
interface CalendarEventDraftValue {
  /**
   * The selected event while it is being created: the draft, or the event
   * it was saved as, for as long as it stays selected. `null` otherwise
   */
  event: CalendarEvent | null;
  /** Whether `event` is still an unsaved draft */
  isDraft: boolean;
  /**
   * Whether the draft is drawn as a tinted range rather than as an event:
   * one drawn on the calendar that nothing was typed into yet. As in Notion
   * Calendar, its first title keystroke turns it into a selected event, and
   * a draft from `startEventDraft` is one from the start.
   */
  isTinted: boolean;
  /** Whether a drag is still drawing the draft: its details popover waits for the release */
  isDrawing: boolean;
  /** Saves the draft, or changes the event it was saved as: `editEvent` */
  updateEvent: (event: CalendarEvent) => void;
  /** Previews a change to the draft without saving it: `updateEventDraft` */
  updateEventDraft: (event: CalendarEvent) => void;
  /** Closes the event's details popover: `closeEventPopover` */
  closePopover: (eventId: string) => void;
}

/**
 * The selected event's series neighbors and the action that shows one, for
 * the details' series arrows. Kept apart from `useCalendar()` so the
 * popover, which also renders outside a provider, can read them.
 */
interface CalendarSeriesValue {
  /** The event the neighbors are for: the selected one */
  eventId: string | null;
  previousInSeries: SeriesOccurrence | null;
  nextInSeries: SeriesOccurrence | null;
  showSeriesOccurrence: (occurrence: SeriesOccurrence) => void;
}

/**
 * The event menus' actions, and whether a cut or copied event waits to be
 * pasted. Kept apart from `useCalendar()` so the right-click menu and the
 * details popover, which also render outside a provider, can read them.
 */
interface CalendarEventActionsValue {
  cutEvent: (eventId: string) => void;
  copyEvent: (eventId: string) => void;
  duplicateEvent: (eventId: string) => void;
  deleteEvent: (eventId: string) => void;
  /** Whether `pasteEvent` has an event to paste */
  hasCopiedEvent: boolean;
}

/** Props for the internal EventContentSlot */
interface EventContentSlotProps extends EventContentProps {
  /**
   * Classes for the box around custom content: positions it above the event's
   * background layers and insets it like the default text
   */
  className: string;
  /** Default content, drawn as-is when no `renderEventContent` is set */
  fallback: React.ReactNode;
}

/** The event being created, and how it got here */
interface EventDraftState {
  /** The draft as it stands: what the details show, and what a save stores */
  event: CalendarEvent;
  /** The draft as it was last drawn, before anything was typed into it */
  base: CalendarEvent;
  /**
   * Whether the views draw it as an event from the start (started by
   * `startEventDraft`) rather than as a tinted range until its first edit
   * (drawn on the calendar)
   */
  isEvent: boolean;
  /** Whether a drag is still drawing it */
  isDrawing: boolean;
}

/** A message for the live region; `id` changes so a repeated text is read again */
interface Announcement {
  id: number;
  text: string;
}

/** The notice on screen, and the undo step its Undo takes back */
interface ShownNotice {
  notice: CalendarNotice;
  /**
   * The step the notice's Undo takes back, or `null` for a notice without
   * one. The notice closes as soon as another step is the latest.
   */
  step: EventHistoryEntry | null;
}

/**
 * The latest press on an event that doesn't simply select it: with Shift or
 * Cmd (Ctrl elsewhere) held it adds the event to the selected ones, or
 * takes it out, once (the views select on the press and again on its
 * click). On one of several selected events it keeps them selected, so
 * they drag together, and its click selects that event alone
 */
interface SelectionPress {
  eventId: string;
  /** Shift or Cmd (Ctrl elsewhere) was held */
  modifier: boolean;
  /** The event was one of several selected */
  inGroup: boolean;
  /** The modifier's toggle already ran */
  handled: boolean;
  /** Where the press started, in viewport pixels */
  startX: number;
  startY: number;
  /** The pointer moved past `SELECTION_DRAG_THRESHOLD_PX`: a drag, not a click */
  dragged: boolean;
}

/** Props of the stateful provider, once the starting date is known */
type CalendarStateProviderProps = CalendarProviderProps & {
  /** Starting date when `date` is not controlled */
  initialDate: Date;
};

const CalendarContext = React.createContext<CalendarContextValue | null>(null);

const CalendarViewSyncContext =
  React.createContext<CalendarViewSyncValue | null>(null);

/** No custom renderers: every slot uses its default (stable identity) */
const NO_RENDER_SLOTS: CalendarRenderSlots = {};

const CalendarRenderSlotsContext =
  React.createContext<CalendarRenderSlots>(NO_RENDER_SLOTS);

const CalendarConfigContext = React.createContext<CalendarConfig>(
  DEFAULT_CALENDAR_CONFIG,
);

/** Outside a provider: no series to step through */
const NO_SERIES: CalendarSeriesValue = {
  eventId: null,
  previousInSeries: null,
  nextInSeries: null,
  showSeriesOccurrence: () => {},
};

const CalendarSeriesContext =
  React.createContext<CalendarSeriesValue>(NO_SERIES);

/** A change to a repeating event's date that waits for its answer */
interface PendingSeriesChange {
  action: "update" | "delete";
  /** The date as drawn before the change (for a delete, the date) */
  before: DetailedCalendarEvent;
  /** The date with every change so far (for a delete, the date) */
  after: DetailedCalendarEvent;
  /** Whether the question is on screen. A details change waits without it */
  isAsking: boolean;
  /** What leaving the event was about to do, run after Save or Discard */
  onLeave: (() => void) | null;
}

/**
 * A waiting change to a repeating event's date, for the views (its preview
 * and dot) and `EventSeriesScopeDialog` (its question). Kept out of
 * `useCalendar()`: only those read it.
 */
interface CalendarSeriesScopeValue {
  /** The question to show, or `null` while none is asked */
  question: SeriesScopeQuestion | null;
  /** Takes the answer to the open question */
  answer: (answer: SeriesScopeAnswer) => void;
  /** Called by a mounted dialog; returns its cleanup. Without one, changes don't wait */
  registerDialog: () => () => void;
  /** Id of the date a change waits for (it shows a dot), or `null` */
  pendingEventId: string | null;
  /** The views' drawn events with the waiting change shown on its date */
  previewEvents: <TEvent extends CalendarEvent>(drawn: TEvent[]) => TEvent[];
  /**
   * The details' way to change an event: holds a selected repeating date's
   * change back until the event is left, else calls `apply`
   */
  editEvent: (
    event: CalendarEvent,
    apply: (event: CalendarEvent) => void,
  ) => void;
}

/** Outside a provider: nothing waits, details changes apply at once */
const NO_SERIES_SCOPE: CalendarSeriesScopeValue = {
  question: null,
  answer: () => {},
  registerDialog: () => () => {},
  pendingEventId: null,
  previewEvents: (drawn) => drawn,
  editEvent: (event, apply) => apply(event),
};

const CalendarSeriesScopeContext =
  React.createContext<CalendarSeriesScopeValue>(NO_SERIES_SCOPE);

const CalendarEventActionsContext =
  React.createContext<CalendarEventActionsValue | null>(null);

/** Outside a provider: nothing is being created */
const NO_EVENT_DRAFT: CalendarEventDraftValue = {
  event: null,
  isDraft: false,
  isTinted: false,
  isDrawing: false,
  updateEvent: () => {},
  updateEventDraft: () => {},
  closePopover: () => {},
};

const CalendarEventDraftContext =
  React.createContext<CalendarEventDraftValue>(NO_EVENT_DRAFT);

/** No event selected */
const NO_SELECTED_IDS: string[] = [];

/**
 * Pointer travel (px) after which a press on a selected event is a drag, as
 * in the drag hooks: its click no longer selects the event alone
 */
const SELECTION_DRAG_THRESHOLD_PX = 4;

/** The selected events' ids, for the event items that draw several selected */
const CalendarSelectionContext = React.createContext<string[]>(NO_SELECTED_IDS);

/** Whether a press with Shift, Cmd, or Ctrl outside a Mac, adds to the selection */
function isSelectionModifierPress(e: PointerEvent): boolean {
  if (e.shiftKey || e.metaKey) return true;
  // Ctrl+click on a Mac is a right-click
  return e.ctrlKey && !/Mac|iPhone|iPad/.test(navigator.userAgent);
}

/** Outside a provider: no notice, and nothing to show or close */
const NO_NOTICE: CalendarNoticeValue = {
  notice: null,
  showNotice: () => {},
  dismissNotice: () => {},
};

const CalendarNoticeContext =
  React.createContext<CalendarNoticeValue>(NO_NOTICE);

/** Default `createEvent`: an untitled event covering the range */
function createDefaultEvent(range: NewEventRange): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_NEW_EVENT_TITLE,
    start: range.start,
    end: range.end,
    ...(range.isAllDay ? { isAllDay: true } : null),
  };
}

/** Whether two values of an event field are the same (dates by their time) */
function isSameFieldValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a === "string" && typeof b === "string") {
    return a.trim() === b.trim();
  }
  return Object.is(a, b);
}

/**
 * Whether a draft was edited since it was drawn: a field differs from
 * `base`, the draft as it was last drawn. Typing a title and taking it back
 * (Escape) leaves it unchanged.
 */
function isEventDraftEdited(
  draft: CalendarEvent,
  base: CalendarEvent,
): boolean {
  const draftFields: Record<string, unknown> = { ...draft };
  const baseFields: Record<string, unknown> = { ...base };
  const keys = new Set([
    ...Object.keys(draftFields),
    ...Object.keys(baseFields),
  ]);
  for (const key of keys) {
    if (!isSameFieldValue(draftFields[key], baseFields[key])) return true;
  }
  return false;
}

/**
 * A new event, or the draft of one, with the people met with ("Meet
 * with...") invited: as the details' participants field adds them, the
 * calendar's account organizing. Returned as it is when nobody is met with.
 */
function withMeetingParticipants(
  event: CalendarEvent,
  meetWith: string[],
  contacts: EventContact[],
): CalendarEvent {
  if (meetWith.length === 0) return event;
  const detailed: DetailedCalendarEvent = event;
  const invited: DetailedCalendarEvent = {
    ...detailed,
    participants: addMeetingParticipants(
      detailed.participants ?? [],
      meetWith.map((email) => findContact(contacts, email)),
      detailed.calendarEmail,
    ),
  };
  return invited;
}

/**
 * The option a series change applies with right away: the caller's (one
 * the change doesn't offer falls back to the first it does), the first
 * offered when no dialog can ask, or `null` to ask
 */
function resolveSeriesScope(
  scope: SeriesEditScope | undefined,
  scopes: SeriesEditScope[],
  canAsk: boolean,
): SeriesEditScope | null {
  if (scope) return scopes.includes(scope) ? scope : scopes[0];
  if (!canAsk) return scopes[0];
  return null;
}

/**
 * Moves `date` by `amount` periods of the given view: days, months, years, the
 * agenda's `AGENDA_DAYS`, or the week view's step (`numberOfDays` below a
 * week, a week otherwise). With weekends hidden, the day steps count
 * weekdays: the day after Friday is Monday.
 */
function shiftPeriod(
  date: Date,
  view: ViewType,
  amount: number,
  numberOfDays: number,
  showWeekends: boolean,
): Date {
  if (view === "day") return addShownDays(date, amount, showWeekends);
  if (view === "month") return addMonths(date, amount);
  if (view === "year") return addYears(date, amount);
  if (view === "agenda") return addDays(date, amount * AGENDA_DAYS);
  const step = getWeekViewStepDays(numberOfDays);
  if (stepsByDay(view, numberOfDays)) {
    return addShownDays(date, amount * step, showWeekends);
  }
  return addDays(date, amount * step);
}

/**
 * First day of the agenda when switching to it from `view`: today when the
 * period on screen contains it, since an agenda lists what's coming up, and
 * the period's first day otherwise
 */
function getAgendaStartFrom(
  date: Date,
  view: ViewType,
  numberOfDays: number,
  now: Date,
  showWeekends: boolean,
): Date {
  const periodEnd = shiftPeriod(date, view, 1, numberOfDays, showWeekends);
  if (now >= date && now < periodEnd) return startOfDay(now);
  return startOfDay(date);
}

/**
 * Day a switch out of year view lands on: today when the year on screen
 * contains it, the year's first day otherwise
 */
function getYearViewExitDate(yearStart: Date, now: Date): Date {
  if (isSameYear(yearStart, now)) return startOfDay(now);
  return yearStart;
}

/**
 * Whether a view shows no day range in `visibleDays`: month view reports
 * its month instead, and year view shows a whole year
 */
function hasNoVisibleDays(view: ViewType): boolean {
  return view === "month" || view === "year";
}

/**
 * Days the header is labelled from. Week and day views name the month
 * after the LAST visible day, so a week crossing into the next month is
 * labelled with the later month (Notion Calendar's behavior). Month view
 * labels its own month, the agenda the month it starts in, and year view
 * its year.
 */
function getHeaderDates(
  view: ViewType,
  currentDate: Date,
  visibleDays: Date[],
  displayMonth: Date | null,
): HeaderDates {
  if (view === "month") return { headerDate: displayMonth ?? currentDate };
  if (view === "year") return { headerDate: currentDate };
  const headerDate = visibleDays[0] ?? currentDate;
  if (view === "agenda") return { headerDate };
  return { headerDate, headerRangeEnd: visibleDays[visibleDays.length - 1] };
}

/** Year the header names: the year of the last day on screen, else of its date */
function getHeaderYear(
  view: ViewType,
  currentDate: Date,
  visibleDays: Date[],
  displayMonth: Date | null,
): number {
  const { headerDate, headerRangeEnd } = getHeaderDates(
    view,
    currentDate,
    visibleDays,
    displayMonth,
  );
  return getYear(headerRangeEnd ?? headerDate);
}

/**
 * Date the provider moves to when it adopts a mounted view's type or day
 * count
 */
function getAdoptedViewDate({
  currentDate,
  view,
  numberOfDays,
  weekStartsOn,
  pendingSwitch,
  isOnStartingToday,
  showWeekends,
  now,
}: AdoptedViewDateOptions): Date {
  // The mounted view didn't follow the latest switch: undo it, date included
  if (
    pendingSwitch?.view === view &&
    pendingSwitch.numberOfDays === numberOfDays
  ) {
    return pendingSwitch.date;
  }
  // Still on the starting date picked before any view mounted: today's
  // period of the mounted view instead (today for a day view)
  if (isOnStartingToday) {
    return getPeriodStart(now, view, weekStartsOn, numberOfDays, showWeekends);
  }
  // The app swapped in a view of another type: land like switchView
  if (view === "day") return getFirstShownDay(startOfDay(now), showWeekends);
  return getPeriodStart(
    currentDate,
    view,
    weekStartsOn,
    numberOfDays,
    showWeekends,
  );
}

/**
 * Keeps the visible hours a valid range of whole hours: the start within
 * 0-23, the end after it and at most 24
 */
function resolveDayHours(
  dayStartHour: number,
  dayEndHour: number,
): Pick<CalendarConfig, "dayStartHour" | "dayEndHour"> {
  const start = Math.min(Math.max(Math.floor(dayStartHour), 0), 23);
  const end = Math.min(Math.max(Math.ceil(dayEndHour), start + 1), 24);
  return { dayStartHour: start, dayEndHour: end };
}

/**
 * The zone the views draw in: `timeZone` when the runtime knows it, else
 * `undefined`, the viewer's own zone, where nothing is mapped
 */
function resolveTimeZone(timeZone: string | undefined): string | undefined {
  if (!timeZone || !isKnownTimeZone(timeZone)) return undefined;
  return timeZone;
}

/**
 * A series occurrence as `useCalendar()` hands it out: its start, and its
 * event when it has one, on the calendar's clock
 */
function toDisplayOccurrence(
  occurrence: SeriesOccurrence | null,
  isAllDay: boolean,
  timeZone: string | undefined,
): SeriesOccurrence | null {
  if (!occurrence || !timeZone) return occurrence;
  return {
    ...occurrence,
    start: isAllDay
      ? occurrence.start
      : toZonedWallClock(occurrence.start, timeZone),
    event: occurrence.event && toDisplayEvent(occurrence.event, timeZone),
  };
}

/**
 * Owns calendar state (events, view, date, selection, view settings) and
 * navigation, and shares them with the views through `useCalendar()`.
 *
 * Without `date` or `defaultDate` the calendar starts on today's period.
 * Today is unknown during server rendering and hydration, so in that case
 * nothing is rendered until hydration finishes; server and client markup
 * always match.
 *
 * `TEvent` is the app's event type. It is usually inferred from `events` or
 * `defaultEvents`; read it back with `useCalendar<TEvent>()`.
 *
 * Navigation (`goToPrev`, `goToNext`, `goToToday`, the shortcuts), header
 * info (`monthName`, `weekNumber`) and `visibleDays` follow the provider's
 * `view` and `numberOfDays`. Render one view per provider: it reports what
 * it draws, and the provider lines up with it as follows.
 *
 * - Uncontrolled `view`: the provider adopts the mounted view's type
 *   (DayView, WeekView, MonthView, AgendaView, YearView, or TimeGrid's `view`), so a
 *   lone view just works. `defaultView` only applies until a view mounts.
 * - Controlled `view` always wins: the provider never changes it to match
 *   the mounted view (development builds warn about a mismatch). Render the
 *   view it names, e.g. `<TimeGrid view={view} />`.
 * - A view's `numberOfDays` prop (WeekView, TimeGrid) works the same way
 *   against the provider's `numberOfDays`. Without it the view follows the
 *   provider.
 * - Switches the mounted view doesn't follow (`switchView`, `showDay`,
 *   `setNumberOfDays`, the D/W/M/A/Y and 2-9 shortcuts while a lone WeekView
 *   stays mounted) are undone, date included. To make switching work,
 *   render the view from `view`, as the demo does with `TimeGrid`.
 * - Without `date` or `defaultDate`, the calendar starts on today's period
 *   of the adopted view: today for DayView and AgendaView, this week for
 *   WeekView, this year for YearView.
 */
export function CalendarProvider<TEvent extends CalendarEvent = CalendarEvent>(
  props: CalendarProviderProps<TEvent>,
) {
  // `null` on the server and during hydration. Today on the calendar's clock
  const today = useToday(
    resolveTimeZone(props.timeZone ?? props.defaultTimeZone),
  );
  const todayPeriodStart = today
    ? getPeriodStart(
        today,
        props.view ?? props.defaultView ?? "week",
        props.weekStartsOn ??
          props.defaultWeekStartsOn ??
          DEFAULT_WEEK_STARTS_ON,
        props.numberOfDays ??
          props.defaultNumberOfDays ??
          DEFAULT_NUMBER_OF_DAYS,
        props.defaultViewSettings?.showWeekends ??
          DEFAULT_VIEW_SETTINGS.showWeekends,
      )
    : null;
  const initialDate = props.defaultDate ?? todayPeriodStart ?? props.date;

  if (!initialDate) return null;

  // The state below works with base `CalendarEvent`s, because the context
  // holding it can't be generic. It only stores, moves and hands back the
  // app's own event objects, so every event it passes to these callbacks is
  // a `TEvent`; `useCalendar<TEvent>()` restores the type on the way out.
  const baseProps = props as CalendarProviderProps;

  return <CalendarStateProvider {...baseProps} initialDate={initialDate} />;
}

function CalendarStateProvider({
  initialDate,
  events: eventsProp,
  defaultEvents,
  onEventsChange,
  view: viewProp,
  defaultView = "week",
  onViewChange,
  date: dateProp,
  defaultDate,
  onDateChange,
  weekStartsOn: weekStartsOnProp,
  defaultWeekStartsOn = DEFAULT_WEEK_STARTS_ON,
  onWeekStartsOnChange,
  numberOfDays: numberOfDaysProp,
  defaultNumberOfDays = DEFAULT_NUMBER_OF_DAYS,
  onNumberOfDaysChange,
  hourHeight: hourHeightProp,
  defaultHourHeight = null,
  onHourHeightChange,
  defaultViewSettings,
  snapMinutes = DEFAULT_SNAP_MINUTES,
  defaultEventDuration = DEFAULT_EVENT_DURATION_MINUTES,
  dayStartHour = DEFAULT_DAY_START_HOUR,
  dayEndHour = DEFAULT_DAY_END_HOUR,
  hourCycle = DEFAULT_HOUR_CYCLE,
  locale = enUS,
  secondaryTimeZone,
  timeZone: timeZoneProp,
  defaultTimeZone,
  onTimeZoneChange,
  secondaryTimeZones: secondaryTimeZonesProp,
  defaultSecondaryTimeZones = NO_TIME_ZONES,
  onSecondaryTimeZonesChange,
  calendars = NO_CALENDARS,
  eventColors = EVENT_COLORS,
  contacts = NO_CONTACTS,
  rooms = NO_ROOMS,
  conferenceProviders = NO_CONFERENCE_PROVIDERS,
  locationSuggestions = NO_LOCATION_SUGGESTIONS,
  meetWith,
  defaultMeetWith,
  onMeetWithChange,
  teammates,
  defaultTeammates,
  onTeammatesChange,
  contactEvents,
  workingHours,
  createEvent,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  onEventSelect,
  onVisibleRangeChange,
  loading = false,
  renderEventContent,
  renderEventDetails,
  children,
}: CalendarStateProviderProps) {
  const [events, setEvents] = useControllableState({
    prop: eventsProp,
    defaultProp: defaultEvents ?? NO_EVENTS,
    onChange: onEventsChange,
  });
  const [view, setView] = useControllableState({
    prop: viewProp,
    defaultProp: defaultView,
    onChange: onViewChange,
  });
  const [currentDate, setCurrentDate] = useControllableState({
    prop: dateProp,
    defaultProp: initialDate,
    onChange: onDateChange,
  });
  const [numberOfDays, setNumberOfDays] = useControllableState({
    prop: numberOfDaysProp,
    defaultProp: defaultNumberOfDays,
    onChange: onNumberOfDaysChange,
  });
  const [weekStartsOn, setWeekStartsOnState] = useControllableState({
    prop: weekStartsOnProp,
    defaultProp: defaultWeekStartsOn,
    onChange: onWeekStartsOnChange,
  });
  const [hourHeight, setHourHeight] = useControllableState<number | null>({
    prop: hourHeightProp,
    defaultProp: defaultHourHeight,
    onChange: onHourHeightChange,
  });
  /** The primary zone, `undefined` for the viewer's */
  const [primaryTimeZone, setPrimaryTimeZone] = useControllableState<
    string | undefined
  >({
    prop: timeZoneProp,
    defaultProp: defaultTimeZone,
    onChange: (zone) => {
      if (zone) onTimeZoneChange?.(zone);
    },
  });
  // `secondaryTimeZone` is the one-zone form of `secondaryTimeZones`
  const legacySecondaryTimeZones = React.useMemo(
    () => (secondaryTimeZone ? [secondaryTimeZone] : undefined),
    [secondaryTimeZone],
  );
  const [secondaryTimeZoneList, setSecondaryTimeZoneList] =
    useControllableState({
      prop: secondaryTimeZonesProp ?? legacySecondaryTimeZones,
      defaultProp: defaultSecondaryTimeZones,
      onChange: onSecondaryTimeZonesChange,
    });
  /** The zone travelled to ("Travel to time zone"), or `null` at home */
  const [travelTimeZone, setTravelTimeZone] = React.useState<string | null>(
    null,
  );
  /** Zone the views draw in, or `undefined` for the viewer's (nothing mapped) */
  const displayTimeZone = resolveTimeZone(travelTimeZone ?? primaryTimeZone);
  // An unknown zone would make its labels throw: leave it out
  const knownSecondaryTimeZones = React.useMemo(
    () =>
      secondaryTimeZoneList.filter(
        (zone, index) =>
          isKnownTimeZone(zone) &&
          secondaryTimeZoneList.indexOf(zone) === index,
      ),
    [secondaryTimeZoneList],
  );
  const timeZones = React.useMemo<CalendarTimeZones>(
    () => ({ primary: primaryTimeZone, secondary: knownSecondaryTimeZones }),
    [primaryTimeZone, knownSecondaryTimeZones],
  );
  /** Who you meet with and which teammates show, for `useCalendarPeople()` */
  const people = useCalendarPeopleState({
    contacts,
    meetWith,
    defaultMeetWith,
    onMeetWithChange,
    teammates,
    defaultTeammates,
    onTeammatesChange,
    contactEvents,
    workingHours,
  });
  const [viewSettings, setViewSettings] = React.useState<ViewSettings>(() => ({
    ...DEFAULT_VIEW_SETTINGS,
    ...defaultViewSettings,
  }));
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );
  /**
   * Events selected together, two or more, with Shift- or Cmd-click or
   * "Select all visible". `null` while one or none is selected, which
   * `selectedEventId` holds
   */
  const [groupSelection, setGroupSelection] = React.useState<string[] | null>(
    null,
  );
  const [highlightedDate, setHighlightedDate] = React.useState<Date | null>(
    null,
  );
  /** Month the month view shows; kept after leaving it until it reports again */
  const [displayMonth, setDisplayMonth] = React.useState<Date | null>(null);
  const [visibleDays, setVisibleDays] = React.useState<Date[]>(() =>
    hasNoVisibleDays(view)
      ? []
      : getVisibleDays(
          currentDate,
          view,
          numberOfDays,
          viewSettings.showWeekends,
        ),
  );
  /** ID of a just-created event whose title input should be focused once */
  const [titleFocusEventId, setTitleFocusEventId] = React.useState<
    string | null
  >(null);
  /**
   * The event being created, not stored yet. It only counts while it is the
   * selected event (`activeDraftState`): selecting anything else leaves it
   * behind.
   */
  const [draftState, setDraftState] = React.useState<EventDraftState | null>(
    null,
  );
  /**
   * ID of the latest draft, kept after it is saved. While that event stays
   * selected the views' draft layer keeps hosting its details popover, so
   * saving it (its first edit) doesn't close and reopen them mid-typing.
   */
  const [draftOriginId, setDraftOriginId] = React.useState<string | null>(null);
  // Adjusted while rendering, like the notice below: once the selection
  // leaves that event it is an event like any other
  if (draftOriginId !== null && draftOriginId !== selectedEventId) {
    setDraftOriginId(null);
  }
  /** Latest change or action, read out by the live region */
  const [announcement, setAnnouncement] = React.useState<Announcement | null>(
    null,
  );
  /** Steps `undo` and `redo` walk through: the calendar's own changes */
  const [history, setHistory] =
    React.useState<EventHistory>(EMPTY_EVENT_HISTORY);
  /** The event cut or copied last; `pasteEvent` adds copies of it */
  const [copiedEvent, setCopiedEvent] = React.useState<CalendarEvent | null>(
    null,
  );
  /** Events cut or copied together, which `pasteEvent` adds as a group; `null` after one alone */
  const [copiedGroup, setCopiedGroup] = React.useState<CalendarEvent[] | null>(
    null,
  );
  /** The notice `CalendarToaster` shows, one at a time */
  const [shownNotice, setShownNotice] = React.useState<ShownNotice | null>(
    null,
  );
  // A notice's Undo takes back its own step and nothing else, so the notice
  // closes once that step stops being the latest: a newer change, or undo
  // or redo moving it. Adjusted while rendering, like CalendarApp's layout
  // state, so a stale Undo never reaches the screen and never comes back.
  const latestStep = history.past[history.past.length - 1];
  if (shownNotice?.step && shownNotice.step !== latestStep) {
    setShownNotice(null);
  }
  /** The draft while it is the selected event: the one being created */
  const activeDraftState =
    draftState !== null && draftState.event.id === selectedEventId
      ? draftState
      : null;
  /** The draft as it is kept: instants, like the stored events */
  const storedDraft = activeDraftState?.event ?? null;
  /** Whether the views draw the draft as an event rather than a tinted range */
  const isDraftAnEvent =
    activeDraftState !== null &&
    (activeDraftState.isEvent ||
      isEventDraftEdited(activeDraftState.event, activeDraftState.base));
  /** Latest events, so `updateEvent` can compare without depending on them */
  const eventsRef = React.useRef(events);
  /**
   * Latest active draft, so `updateEvent` can tell a draft's first edit
   * from an edit to a stored event. The draft actions also set it
   * themselves, so two calls in one handler see each other.
   */
  const draftStateRef = React.useRef<EventDraftState | null>(activeDraftState);
  /** The latest press on an event with a selection modifier, see `SelectionPress` */
  const selectionPressRef = React.useRef<SelectionPress | null>(null);
  /**
   * The events each undo step on several events acted on: undo and redo
   * select them again, as Notion Calendar's Undo of "3 events deleted" does
   */
  const groupStepsRef = React.useRef(
    new WeakMap<EventHistoryEntry, string[]>(),
  );
  /** The slot or day a view last had the mouse over: where a paste goes */
  const pasteTargetRef = React.useRef<EventPasteTarget | null>(null);
  /** Hour height the time grid last drew, which zooming steps from */
  const renderedHourHeightRef = React.useRef<number | null>(null);
  /** Id of the latest notice; each new one counts up */
  const noticeIdRef = React.useRef(0);
  /**
   * State before the latest switch of view or day count, so a mounted view
   * that keeps its own type can undo it. Read and cleared by the next report.
   */
  const pendingSwitchRef = React.useRef<ViewSwitchSnapshot | null>(null);
  /** Whether the controlled-view mismatch warning was already logged */
  const hasWarnedViewConflictRef = React.useRef(false);
  /** The mounted view's latest report, or `null` while no view has reported */
  const mountedViewRef = React.useRef<ReportedView | null>(null);
  /** Latest `onVisibleRangeChange`, so a new callback alone doesn't report */
  const onVisibleRangeChangeRef = React.useRef(onVisibleRangeChange);
  /** Start and end times last passed to `onVisibleRangeChange` */
  const reportedRangeKeyRef = React.useRef<string | null>(null);
  /** Whether the starting date is today's period (no `date` or `defaultDate`) */
  const startsOnToday = dateProp === undefined && defaultDate === undefined;
  const initialTime = initialDate.getTime();

  React.useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  React.useEffect(() => {
    draftStateRef.current = activeDraftState;
  }, [activeDraftState]);

  /** A change to a repeating event's date that waits for its answer */
  const [pendingSeriesChange, setPendingSeriesChange] =
    React.useState<PendingSeriesChange | null>(null);
  /** Latest waiting change, read by the callbacks right away */
  const pendingSeriesChangeRef = React.useRef<PendingSeriesChange | null>(null);
  /** How many series questions are mounted. Without one, nothing waits */
  const seriesDialogCountRef = React.useRef(0);

  /** Sets the waiting change, and its ref at once for the next callback */
  const setPending = React.useCallback((next: PendingSeriesChange | null) => {
    pendingSeriesChangeRef.current = next;
    setPendingSeriesChange(next);
  }, []);

  const registerSeriesDialog = React.useCallback(() => {
    seriesDialogCountRef.current += 1;
    return () => {
      seriesDialogCountRef.current -= 1;
    };
  }, []);

  /** A date as the views draw it: stored, or generated from its series */
  const resolveDrawn = React.useCallback(
    (eventId: string): DetailedCalendarEvent | null =>
      findEventOrOccurrence(eventsRef.current, eventId),
    [],
  );

  /**
   * Holds a change to a repeating event's date: drawn on that date, asked
   * about now (`isAsking`) or once the event is left. A change that came
   * back to where it began waits no more
   */
  const holdSeriesChange = React.useCallback(
    (after: DetailedCalendarEvent, isAsking: boolean) => {
      const pending = pendingSeriesChangeRef.current;
      const before =
        pending?.action === "update" && pending.before.id === after.id
          ? pending.before
          : resolveDrawn(after.id);
      if (!before) return;
      if (getSeriesEditScopes(eventsRef.current, before, after).length === 0) {
        setPending(null);
        return;
      }
      setPending({ action: "update", before, after, isAsking, onLeave: null });
    },
    [resolveDrawn, setPending],
  );

  /**
   * Runs `action`, which leaves the selected event, unless a change waits:
   * then it asks first and runs it after Save or Discard. While the
   * question is on screen it does nothing: the dialog is modal
   */
  const afterSeriesChange = React.useCallback(
    (action: () => void) => {
      const pending = pendingSeriesChangeRef.current;
      if (!pending) {
        action();
        return;
      }
      if (pending.isAsking) return;
      setPending({ ...pending, isAsking: true, onLeave: action });
    },
    [setPending],
  );

  /** Whether `eventId` names the date a change waits for */
  const isWaitingDate = React.useCallback(
    (eventId: string) => pendingSeriesChangeRef.current?.before.id === eventId,
    [],
  );

  React.useEffect(() => {
    onVisibleRangeChangeRef.current = onVisibleRangeChange;
  }, [onVisibleRangeChange]);

  // The highlight from `showDay` is a brief flash, not a lasting state
  React.useEffect(() => {
    if (!highlightedDate) return;
    const timer = setTimeout(
      () => setHighlightedDate(null),
      HIGHLIGHT_DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [highlightedDate]);

  // Month and year view show no day range; consumers sync to
  // `displayMonth` or `currentDate` instead
  React.useEffect(() => {
    if (!hasNoVisibleDays(view)) return;
    setVisibleDays([]);
  }, [view]);

  // The views draw on the calendar's clock: each timed event as a Date whose
  // local time reads `timeZone`. What's stored stays instants.
  const displayEvents = React.useMemo(
    () =>
      displayTimeZone
        ? events.map((event) => toDisplayEvent(event, displayTimeZone))
        : events,
    [events, displayTimeZone],
  );

  // The draft on the calendar's clock, as the views and the details get it
  const activeDraft = React.useMemo(
    () => storedDraft && toDisplayEvent(storedDraft, displayTimeZone),
    [storedDraft, displayTimeZone],
  );

  // A generated occurrence of a repeating event is selected by its id too,
  // and so is the draft, which isn't stored. A date whose change waits shows
  // the change. As stored, for the series math
  const storedSelectedEvent = React.useMemo(() => {
    if (selectedEventId === null) return null;
    if (storedDraft) return storedDraft;
    if (
      pendingSeriesChange?.action === "update" &&
      pendingSeriesChange.before.id === selectedEventId
    ) {
      return pendingSeriesChange.after;
    }
    return findEventOrOccurrence(events, selectedEventId);
  }, [events, selectedEventId, pendingSeriesChange, storedDraft]);

  const selectedEvent = React.useMemo(
    () =>
      storedSelectedEvent &&
      toDisplayEvent(storedSelectedEvent, displayTimeZone),
    [storedSelectedEvent, displayTimeZone],
  );

  // Only honor the focus request while that event is still the selected one
  const pendingTitleFocusId =
    titleFocusEventId === selectedEventId ? titleFocusEventId : null;

  const clearTitleFocus = React.useCallback(() => {
    setTitleFocusEventId(null);
  }, []);

  const announce = React.useCallback((text: string) => {
    setAnnouncement((prev) => ({ id: (prev?.id ?? 0) + 1, text }));
  }, []);

  /**
   * Shows a notice in place of the one on screen. With a `step`, its Undo
   * takes that step back, and it closes once another step is the latest
   */
  const openNotice = React.useCallback(
    (content: CalendarNoticeInput, step: EventHistoryEntry | null) => {
      noticeIdRef.current += 1;
      setShownNotice({ notice: { ...content, id: noticeIdRef.current }, step });
    },
    [],
  );

  const showNotice = React.useCallback(
    (content: CalendarNoticeInput) => {
      openNotice(content, null);
      // The toaster isn't a live region: the provider's reads every notice
      announce(
        content.title
          ? `${content.message}, ${content.title}`
          : content.message,
      );
    },
    [openNotice, announce],
  );

  const dismissNotice = React.useCallback((id: number) => {
    setShownNotice((prev) => (prev?.notice.id === id ? null : prev));
  }, []);

  /** Adds a step for `undo`: what one action just changed. Returns the step */
  const recordHistory = React.useCallback(
    (action: EventHistoryAction, changes: EventHistoryChange[]) => {
      const entry: EventHistoryEntry = { action, changes, time: Date.now() };
      setHistory((prev) => recordEventHistory(prev, entry));
      return entry;
    },
    [],
  );

  /**
   * Applies changes the calendar makes itself (delete, cut, duplicate,
   * paste, undo, redo) and reports each one: `onEventCreate` for an added
   * event, `onEventUpdate` for a changed one, `onEventDelete` for a removed one
   */
  const commitChanges = React.useCallback(
    (changes: EventHistoryChange[]) => {
      setEvents((prev) => applyEventChanges(prev, changes));
      for (const { before, after } of changes) {
        if (!after) {
          if (before) onEventDelete?.(before);
          continue;
        }
        if (before) {
          onEventUpdate?.(after);
          continue;
        }
        onEventCreate?.(after);
      }
    },
    [setEvents, onEventCreate, onEventUpdate, onEventDelete],
  );

  /** Leaves the draft behind without storing it */
  const closeEventDraft = React.useCallback(() => {
    draftStateRef.current = null;
    setDraftState(null);
  }, []);

  /**
   * Stores the draft as `event`: its first edit. Reported once through
   * `onEventCreate` and undoable as one "create" step; it stays selected.
   */
  const saveEventDraft = React.useCallback(
    (event: CalendarEvent) => {
      closeEventDraft();
      setEvents((prev) => [...prev, event]);
      onEventCreate?.(event);
      recordHistory("create", [
        { before: null, after: event, index: eventsRef.current.length },
      ]);
      announce(
        describeEventCreated(
          toDisplayEvent(event, displayTimeZone),
          hourCycle,
          locale,
        ),
      );
    },
    [
      closeEventDraft,
      setEvents,
      onEventCreate,
      recordHistory,
      announce,
      hourCycle,
      locale,
      displayTimeZone,
    ],
  );

  /**
   * Run before the selection leaves the draft. One that was edited (a title
   * typed into it) is saved, as in Notion Calendar; an untouched one is
   * thrown away. Returns whether it was saved.
   */
  const settleEventDraft = React.useCallback((): boolean => {
    const draft = draftStateRef.current;
    if (!draft) return false;
    if (isEventDraftEdited(draft.event, draft.base)) {
      saveEventDraft({ ...draft.event, title: draft.event.title.trim() });
      return true;
    }
    closeEventDraft();
    return false;
  }, [saveEventDraft, closeEventDraft]);

  const selectedEventIds = React.useMemo(() => {
    if (groupSelection) return groupSelection;
    return selectedEventId === null ? NO_SELECTED_IDS : [selectedEventId];
  }, [groupSelection, selectedEventId]);

  /** Latest selection, so a modifier press can toggle without depending on it */
  const selectedEventIdsRef = React.useRef(selectedEventIds);

  React.useEffect(() => {
    selectedEventIdsRef.current = selectedEventIds;
  }, [selectedEventIds]);

  const setSelectedEventIds = React.useCallback(
    (eventIds: string[]) => {
      const unique = [...new Set(eventIds)];
      const [only] = unique;
      const apply = () => {
        let eventIds = unique;
        // The selection leaves the draft, unless it is what gets selected.
        // One that is thrown away can't stay selected among other events
        const draft = draftStateRef.current;
        const isDraftSelectedAlone =
          eventIds.length === 1 && eventIds[0] === draft?.event.id;
        if (draft && !isDraftSelectedAlone && !settleEventDraft()) {
          eventIds = eventIds.filter((id) => id !== draft.event.id);
        }
        const [selected] = eventIds;
        if (eventIds.length > 1) {
          setGroupSelection(eventIds);
          setSelectedEventId(null);
          return;
        }
        setGroupSelection(null);
        setSelectedEventId(selected ?? null);
        if (selected !== undefined) onEventSelect?.(selected);
      };
      // Selecting anything but the date a change waits for leaves that
      // date: the change is asked about first, and the selection follows
      // its answer
      if (unique.length === 1 && isWaitingDate(only)) {
        apply();
        return;
      }
      afterSeriesChange(apply);
    },
    [onEventSelect, isWaitingDate, afterSeriesChange, settleEventDraft],
  );

  const toggleEventSelection = React.useCallback(
    (eventId: string) => {
      setSelectedEventIds(
        toggleSelectedEventId(selectedEventIdsRef.current, eventId),
      );
    },
    [setSelectedEventIds],
  );

  // Remember presses on events that don't simply select them (see
  // `SelectionPress`): the views select the pressed event through
  // `selectEvent`, which reads it. A key press forgets it, so Enter selects
  // alone. The click of a press on one of several selected events selects
  // it alone; after a drag the click is swallowed, and the group stays
  React.useEffect(() => {
    const getEventId = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest("[data-event-id]")?.getAttribute("data-event-id")
        : undefined;
    const handlePointerDown = (e: PointerEvent) => {
      const eventId = getEventId(e.target);
      const modifier = isSelectionModifierPress(e);
      const inGroup =
        selectedEventIdsRef.current.length > 1 &&
        eventId !== undefined &&
        eventId !== null &&
        selectedEventIdsRef.current.includes(eventId);
      selectionPressRef.current =
        eventId && (modifier || inGroup)
          ? {
              eventId,
              modifier,
              inGroup,
              handled: false,
              startX: e.clientX,
              startY: e.clientY,
              dragged: false,
            }
          : null;
    };
    const handlePointerMove = (e: PointerEvent) => {
      const press = selectionPressRef.current;
      if (!press || press.dragged || e.buttons === 0) return;
      const distance = Math.hypot(
        e.clientX - press.startX,
        e.clientY - press.startY,
      );
      if (distance > SELECTION_DRAG_THRESHOLD_PX) press.dragged = true;
    };
    // Capture: the event items stop their clicks from bubbling
    const handleClick = (e: MouseEvent) => {
      const press = selectionPressRef.current;
      if (!press || press.modifier || !press.inGroup || press.dragged) return;
      if (getEventId(e.target) !== press.eventId) return;
      selectionPressRef.current = null;
      setSelectedEventIds([press.eventId]);
    };
    const forgetPress = () => {
      selectionPressRef.current = null;
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", forgetPress, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("click", handleClick, true);
      window.removeEventListener("keydown", forgetPress, true);
    };
  }, [setSelectedEventIds]);

  const selectEvent = React.useCallback(
    (eventId: string) => {
      const press = selectionPressRef.current;
      if (press?.eventId === eventId) {
        // A press on one of several selected events keeps them all
        if (!press.modifier || press.handled) return;
        press.handled = true;
        toggleEventSelection(eventId);
        return;
      }
      // Selecting another event leaves the one a change waits for
      setSelectedEventIds([eventId]);
    },
    [toggleEventSelection, setSelectedEventIds],
  );

  const clearSelection = React.useCallback(() => {
    afterSeriesChange(() => {
      settleEventDraft();
      setGroupSelection(null);
      setSelectedEventId(null);
    });
  }, [afterSeriesChange, settleEventDraft]);

  /**
   * The selected events an action on `eventId` acts on: all of them when it
   * is one of several selected, else `null` (it acts on that event alone)
   */
  const getActionGroup = React.useCallback(
    (eventId: string) =>
      groupSelection?.includes(eventId) ? groupSelection : null,
    [groupSelection],
  );

  /**
   * A changed event the views or the details hand over, on the calendar's
   * clock, as stored: instants. A time the change kept keeps its instant,
   * read from the change that waits for that date or the event as stored
   */
  const toStoredEvent = React.useCallback(
    (shownEvent: CalendarEvent): CalendarEvent => {
      const pending = pendingSeriesChangeRef.current;
      const previous =
        pending?.action === "update" && pending.before.id === shownEvent.id
          ? pending.after
          : (eventsRef.current.find((e) => e.id === shownEvent.id) ??
            findEventOrOccurrence(eventsRef.current, shownEvent.id) ??
            undefined);
      return fromDisplayEvent(shownEvent, displayTimeZone, previous);
    },
    [displayTimeZone],
  );

  /**
   * Moves every selected event by as much as `shownMoved` moved from
   * `previous`, as one undo step: what dragging one of several selected
   * events, or moving it with the keyboard, does.
   *
   * The views hand the moved event over on the calendar's clock: it is
   * stored through `toStoredEvent`, and the others move by the same
   * duration on their stored instants, so a group dragged while `timeZone`
   * is another zone lands on the right instants. A move by whole days (an
   * all-day event among them) counts the days on the calendar's clock.
   *
   * A group action never asks the series question (ADR-009 asks about one
   * date at a time): a repeating event's generated date moves alone, as an
   * event of its own stored by its first edit (ADR-007), and the series
   * keeps its other dates. The series' own event still takes the series
   * along (`applyRecurringEdit`).
   */
  const moveEventGroup = React.useCallback(
    (
      eventIds: string[],
      previous: CalendarEvent,
      shownMoved: CalendarEvent,
    ) => {
      const moved = toStoredEvent(shownMoved);
      const shownPrevious = toDisplayEvent(previous, displayTimeZone);
      const moveWithGroup = (event: CalendarEvent): CalendarEvent => {
        if (!event.isAllDay && !previous.isAllDay) {
          return { ...event, ...getGroupMoveTimes(event, previous, moved) };
        }
        const shown = toDisplayEvent(event, displayTimeZone);
        return fromDisplayEvent(
          { ...shown, ...getGroupMoveTimes(shown, shownPrevious, shownMoved) },
          displayTimeZone,
          event,
        );
      };
      let working = eventsRef.current;
      const changes: EventHistoryChange[] = [];
      for (const eventId of eventIds) {
        const event =
          eventId === moved.id
            ? previous
            : findEventOrOccurrence(working, eventId);
        if (!event) continue;
        const edited = eventId === moved.id ? moved : moveWithGroup(event);
        const index = working.findIndex((e) => e.id === eventId);
        const next = applyRecurringEdit(working, event, edited);
        // A generated date is stored by its first edit (ADR-007)
        const change: EventHistoryChange =
          index === -1
            ? { before: null, after: next, index: working.length }
            : { before: working[index], after: next, index };
        working = applyEventChanges(working, [change]);
        changes.push(change);
      }
      const merged = mergeEventChanges(changes);
      commitChanges(merged);
      const step = recordHistory("edit", merged);
      groupStepsRef.current.set(step, eventIds);
      announce(describeGroupAction("move", merged.length));
    },
    [toStoredEvent, displayTimeZone, commitChanges, recordHistory, announce],
  );

  /**
   * Applies a change to a repeating event's date to the option picked, as
   * one undo step, and shows Notion's "Event updated" notice
   */
  const applySeriesEdit = React.useCallback(
    (
      before: DetailedCalendarEvent,
      after: DetailedCalendarEvent,
      scope: SeriesEditScope,
    ) => {
      const { changes, occurrenceId } = getSeriesEditChanges({
        events: eventsRef.current,
        before,
        after,
        scope,
        newSeriesId: crypto.randomUUID(),
      });
      if (changes.length === 0) return;
      commitChanges(changes);
      // An action that waited for this answer runs next: it reads the result
      eventsRef.current = applyEventChanges(eventsRef.current, changes);
      // One answer is one undo step: dated so it never merges with a quick
      // edit just before it, as edits to one event less than a second
      // apart otherwise do
      setHistory((prev) => {
        const top = prev.past[prev.past.length - 1];
        const time = Math.max(
          Date.now(),
          (top?.time ?? 0) + EVENT_HISTORY_MERGE_MS,
        );
        return recordEventHistory(prev, { action: "edit", changes, time });
      });
      // The date stays selected under the id it is drawn with now
      setSelectedEventId((prev) => (prev === before.id ? occurrenceId : prev));
      const message = describeEventChange(
        toDisplayEvent(before, displayTimeZone),
        toDisplayEvent(after, displayTimeZone),
        hourCycle,
        locale,
      );
      if (message) announce(message);
      openNotice({ message: "Event updated" }, null);
    },
    [commitChanges, hourCycle, locale, announce, openNotice, displayTimeZone],
  );

  /**
   * Deletes a repeating event's date, the following ones or all of them, as
   * one undo step, with Notion's notice and its Undo
   */
  const applySeriesDelete = React.useCallback(
    (event: DetailedCalendarEvent, scope: SeriesEditScope) => {
      const changes = getSeriesDeleteChanges({
        events: eventsRef.current,
        event,
        scope,
      });
      if (changes.length === 0) return;
      commitChanges(changes);
      eventsRef.current = applyEventChanges(eventsRef.current, changes);
      const step = recordHistory("delete", changes);
      setSelectedEventId((prev) => (prev === event.id ? null : prev));
      announce(describeEventAction("delete", event));
      openNotice(
        {
          message: scope === "all" ? "All events deleted" : "Event deleted",
          title: getSpokenTitle(event),
        },
        step,
      );
    },
    [commitChanges, recordHistory, announce, openNotice],
  );

  /**
   * Applies a change to an event, handed over on the calendar's clock. A
   * date of a repeating event goes to the option `scope` names, or the
   * question asks for one
   */
  const applyEventUpdate = React.useCallback(
    (shownEvent: CalendarEvent, scope?: SeriesEditScope) => {
      // Moving one of several selected events moves them all, with no
      // series question: see `moveEventGroup`
      const group = getActionGroup(shownEvent.id);
      const grouped = group ? resolveDrawn(shownEvent.id) : null;
      if (
        group &&
        grouped &&
        isEventMove(toDisplayEvent(grouped, displayTimeZone), shownEvent)
      ) {
        moveEventGroup(group, grouped, shownEvent);
        return;
      }
      // The views hand it over on the calendar's clock: back to instants
      const updatedEvent = toStoredEvent(shownEvent);
      const pending = pendingSeriesChangeRef.current;
      const drawn =
        pending?.action === "update" && pending.before.id === updatedEvent.id
          ? pending.before
          : resolveDrawn(updatedEvent.id);
      if (drawn && findEventSeries(eventsRef.current, drawn)) {
        const edited = updatedEvent as DetailedCalendarEvent;
        const scopes = getSeriesEditScopes(eventsRef.current, drawn, edited);
        if (scopes.length === 0) {
          if (pending?.before.id === edited.id) setPending(null);
          return;
        }
        const chosen = resolveSeriesScope(
          scope,
          scopes,
          seriesDialogCountRef.current > 0,
        );
        if (chosen) {
          setPending(null);
          applySeriesEdit(drawn, edited, chosen);
          return;
        }
        // A drag, resize, keyboard move or menu change asks at once
        holdSeriesChange(edited, true);
        return;
      }

      const current = eventsRef.current;
      const index = current.findIndex((e) => e.id === updatedEvent.id);
      const stored = index === -1 ? undefined : current[index];
      // Not stored: an occurrence the views generated from a repeating
      // event's rule (or an id nothing has)
      const generated = stored
        ? null
        : findEventOrOccurrence(current, updatedEvent.id);
      const previous = stored ?? generated ?? undefined;
      const next = previous
        ? applyRecurringEdit(current, previous, updatedEvent)
        : updatedEvent;

      if (generated) {
        // Its first edit stores it as an event of its own, standing for its
        // date in the series (ADR-007). It is one "create" step: undoing it
        // removes the stored event and the generated date comes back
        const changes: EventHistoryChange[] = [
          { before: null, after: next, index: current.length },
        ];
        commitChanges(changes);
        recordHistory("create", changes);
      } else {
        setEvents((prev) => prev.map((e) => (e.id === next.id ? next : e)));
        onEventUpdate?.(next);
        if (previous) {
          recordHistory("edit", [{ before: previous, after: next, index }]);
        }
      }

      // Moves and resizes (drag, keyboard, or the details) are announced,
      // on the calendar's clock; edits that keep the time, like the title,
      // are not
      if (!previous) return;
      const message = describeEventChange(
        toDisplayEvent(previous, displayTimeZone),
        toDisplayEvent(next, displayTimeZone),
        hourCycle,
        locale,
      );
      if (message) announce(message);
    },
    [
      setEvents,
      commitChanges,
      onEventUpdate,
      hourCycle,
      locale,
      announce,
      recordHistory,
      displayTimeZone,
      toStoredEvent,
      resolveDrawn,
      setPending,
      applySeriesEdit,
      holdSeriesChange,
      getActionGroup,
      moveEventGroup,
    ],
  );

  const updateEvent = React.useCallback(
    (updatedEvent: CalendarEvent, scope?: SeriesEditScope) => {
      // The draft's first edit saves it, back on instants like any event
      const draft = draftStateRef.current;
      if (draft?.event.id === updatedEvent.id) {
        saveEventDraft(
          fromDisplayEvent(updatedEvent, displayTimeZone, draft.event),
        );
        return;
      }
      // A change to another event leaves the one a change waits for
      if (pendingSeriesChangeRef.current && !isWaitingDate(updatedEvent.id)) {
        afterSeriesChange(() => applyEventUpdate(updatedEvent, scope));
        return;
      }
      applyEventUpdate(updatedEvent, scope);
    },
    [
      isWaitingDate,
      afterSeriesChange,
      applyEventUpdate,
      saveEventDraft,
      displayTimeZone,
    ],
  );

  /**
   * The details' way to change an event: the selected date of a repeating
   * event (or the one a change waits for) keeps the change waiting until
   * the event is left, as Notion Calendar does; other events change through
   * `apply`
   */
  const editSeriesEvent = React.useCallback(
    (event: CalendarEvent, apply: (event: CalendarEvent) => void) => {
      const isWaiting = isWaitingDate(event.id);
      const drawn = isWaiting
        ? (pendingSeriesChangeRef.current?.before ?? null)
        : resolveDrawn(event.id);
      const repeats =
        drawn !== null && findEventSeries(eventsRef.current, drawn) !== null;
      if (
        repeats &&
        (isWaiting || selectedEventId === event.id) &&
        seriesDialogCountRef.current > 0
      ) {
        // Held as stored, like the events the question answers for
        holdSeriesChange(toStoredEvent(event) as DetailedCalendarEvent, false);
        return;
      }
      apply(event);
    },
    [
      isWaitingDate,
      resolveDrawn,
      selectedEventId,
      holdSeriesChange,
      toStoredEvent,
    ],
  );

  const editEvent = React.useCallback(
    (event: CalendarEvent) => editSeriesEvent(event, updateEvent),
    [editSeriesEvent, updateEvent],
  );

  /**
   * A range the views give, on the calendar's clock, as instants: what
   * `createEvent` and the app get, like the events they store. Whole days
   * are calendar dates already.
   */
  const toStoredRange = React.useCallback(
    (range: NewEventRange): NewEventRange =>
      range.isAllDay ? range : fromDisplayRange(range, displayTimeZone),
    [displayTimeZone],
  );

  /** Builds a draft for a range with the app's factory, or `null` when it declines */
  const buildEventDraft = React.useCallback(
    (range: NewEventRange): CalendarEvent | null => {
      const created = (createEvent ?? createDefaultEvent)(toStoredRange(range));
      if (!created) return null;
      // The people met with are invited from the start: not an edit, so an
      // untouched draft is still thrown away
      const draft = withMeetingParticipants(
        created,
        people.meetWith,
        people.contacts,
      );
      // A factory written for timed slots still gets a whole-day event
      if (range.isAllDay && !draft.isAllDay) {
        return { ...draft, isAllDay: true };
      }
      return draft;
    },
    [createEvent, toStoredRange, people.meetWith, people.contacts],
  );

  /**
   * Makes `draft` the event being created: drawn and selected, not stored.
   * A draft that was open is settled first. `isEvent`: drawn as an event
   * from the start instead of as a tinted range.
   */
  const openEventDraft = React.useCallback(
    (draft: CalendarEvent | null, isEvent: boolean, isDrawing: boolean) => {
      settleEventDraft();
      const next = draft
        ? { event: draft, base: draft, isEvent, isDrawing }
        : null;
      draftStateRef.current = next;
      setDraftState(next);
      setDraftOriginId(draft ? draft.id : null);
      setGroupSelection(null);
      setSelectedEventId(draft ? draft.id : null);
    },
    [settleEventDraft],
  );

  /** Asks for the draft's title to be focused, and reports it as selected */
  const presentEventDraft = React.useCallback(
    (draft: CalendarEvent) => {
      setTitleFocusEventId(draft.id);
      onEventSelect?.(draft.id);
      announce(
        describeEventDraft(
          toDisplayEvent(draft, displayTimeZone),
          hourCycle,
          locale,
        ),
      );
    },
    [onEventSelect, announce, hourCycle, locale, displayTimeZone],
  );

  const startEventDraft = React.useCallback(
    (range: NewEventRange) => {
      // Starting a draft leaves the event a change waits for
      afterSeriesChange(() => {
        const draft = buildEventDraft(range);
        openEventDraft(draft, true, false);
        if (draft) presentEventDraft(draft);
      });
    },
    [afterSeriesChange, buildEventDraft, openEventDraft, presentEventDraft],
  );

  const updateEventDraft = React.useCallback(
    (shownDraft: CalendarEvent) => {
      const current = draftStateRef.current;
      if (current?.event.id !== shownDraft.id) return;
      // The details hand it over on the calendar's clock: back to instants
      const draft = fromDisplayEvent(
        shownDraft,
        displayTimeZone,
        current.event,
      );
      const next = { ...current, event: draft };
      draftStateRef.current = next;
      setDraftState(next);
    },
    [displayTimeZone],
  );

  const drawEventDraft = React.useCallback(
    (range: NewEventRange, phase: EventDrawPhase) => {
      if (phase === "start") {
        // A change that waits for its answer is asked about first: the
        // gesture draws nothing
        if (pendingSeriesChangeRef.current) {
          afterSeriesChange(() => {});
          return;
        }
        openEventDraft(buildEventDraft(range), false, true);
        return;
      }
      const current = draftStateRef.current;
      if (!current) return;
      const { start, end } = toStoredRange(range);
      const draft = { ...current.event, start, end };
      // Drawing isn't an edit: the draft is still untouched
      const next = {
        ...current,
        event: draft,
        base: draft,
        isDrawing: phase !== "end",
      };
      draftStateRef.current = next;
      setDraftState(next);
      if (phase === "end") presentEventDraft(draft);
    },
    [
      afterSeriesChange,
      buildEventDraft,
      openEventDraft,
      presentEventDraft,
      toStoredRange,
    ],
  );

  const addEventFromRange = React.useCallback(
    (range: NewEventRange) => {
      // Creating an event leaves the one a change waits for
      afterSeriesChange(() => {
        // `createEvent` and the app get instants, like the events they store
        const created = (createEvent ?? createDefaultEvent)(
          toStoredRange(range),
        );
        if (!created) return;
        const newEvent = withMeetingParticipants(
          created,
          people.meetWith,
          people.contacts,
        );
        setEvents((prev) => [...prev, newEvent]);
        onEventCreate?.(newEvent);
        recordHistory("create", [
          { before: null, after: newEvent, index: eventsRef.current.length },
        ]);
        selectEvent(newEvent.id);
        setTitleFocusEventId(newEvent.id);
        announce(
          describeEventCreated(
            toDisplayEvent(newEvent, displayTimeZone),
            hourCycle,
            locale,
          ),
        );
      });
    },
    [
      afterSeriesChange,
      displayTimeZone,
      toStoredRange,
      createEvent,
      people.meetWith,
      people.contacts,
      setEvents,
      onEventCreate,
      selectEvent,
      hourCycle,
      locale,
      announce,
      recordHistory,
    ],
  );

  /**
   * Deletes an event for `deleteEvent` and `cutEvent`; returns it with its
   * undo step, or `null` when there is none
   */
  const removeEvent = React.useCallback(
    (eventId: string, action: "delete" | "cut") => {
      // The draft isn't stored: deleting or cutting it throws it away
      if (draftStateRef.current?.event.id === eventId) {
        closeEventDraft();
        setSelectedEventId(null);
        return null;
      }
      const current = eventsRef.current;
      const index = current.findIndex((e) => e.id === eventId);
      // A generated date of a repeating event isn't stored
      const event = current[index] ?? findEventOrOccurrence(current, eventId);
      if (!event) return null;
      // One date of a series goes by being excluded from it (ADR-007)
      const changes = getEventRemovalChanges(current, event);
      commitChanges(changes);
      const step = recordHistory(action, changes);
      setSelectedEventId((prev) => (prev === eventId ? null : prev));
      return { event, step };
    },
    [commitChanges, recordHistory, closeEventDraft],
  );

  /**
   * Deletes or cuts several events as one undo step, and clears the
   * selection. Returns them with the step, or `null` when none was found.
   * Like every group action it asks no series question: a repeating
   * event's date goes alone, excluded from its series (ADR-007)
   */
  const removeEvents = React.useCallback(
    (eventIds: string[], action: "delete" | "cut") => {
      let working = eventsRef.current;
      const changes: EventHistoryChange[] = [];
      const removed: CalendarEvent[] = [];
      for (const eventId of eventIds) {
        const event =
          working.find((e) => e.id === eventId) ??
          findEventOrOccurrence(working, eventId);
        if (!event) continue;
        const eventChanges = getEventRemovalChanges(working, event);
        working = applyEventChanges(working, eventChanges);
        changes.push(...eventChanges);
        removed.push(event);
      }
      if (removed.length === 0) return null;
      const merged = mergeEventChanges(changes);
      commitChanges(merged);
      const step = recordHistory(action, merged);
      groupStepsRef.current.set(
        step,
        removed.map((event) => event.id),
      );
      setGroupSelection(null);
      setSelectedEventId(null);
      return { events: removed, step };
    },
    [commitChanges, recordHistory],
  );

  /** The events the ids name, stored or generated, in order; missing ones are left out */
  const findEvents = React.useCallback(
    (eventIds: string[]) =>
      eventIds.flatMap((eventId) => {
        const event = findEventOrOccurrence(eventsRef.current, eventId);
        return event ? [event] : [];
      }),
    [],
  );

  /**
   * Adds duplicated or pasted copies of several events as one undo step,
   * and selects them together
   */
  const addEventCopies = React.useCallback(
    (copies: CalendarEvent[], action: "duplicate" | "paste") => {
      const start = eventsRef.current.length;
      const changes: EventHistoryChange[] = copies.map((copy, offset) => ({
        before: null,
        after: copy,
        index: start + offset,
      }));
      commitChanges(changes);
      const step = recordHistory(action, changes);
      const copyIds = copies.map((copy) => copy.id);
      groupStepsRef.current.set(step, copyIds);
      setSelectedEventIds(copyIds);
      announce(describeGroupAction(action, copies.length));
    },
    [commitChanges, recordHistory, setSelectedEventIds, announce],
  );

  /**
   * Deletes an event. A date of a repeating event goes with the option
   * `scope` names, or the question asks for one
   */
  const applyEventDelete = React.useCallback(
    (eventId: string, scope?: SeriesEditScope) => {
      const event = resolveDrawn(eventId);
      const scopes = event
        ? getSeriesDeleteScopes(eventsRef.current, event)
        : [];
      if (event && scopes.length > 0) {
        const chosen = resolveSeriesScope(
          scope,
          scopes,
          seriesDialogCountRef.current > 0,
        );
        // A delete of the date a change waits for drops that change
        if (chosen) {
          setPending(null);
          applySeriesDelete(event, chosen);
          return;
        }
        setPending({
          action: "delete",
          before: event,
          after: event,
          isAsking: true,
          onLeave: null,
        });
        return;
      }
      const removed = removeEvent(eventId, "delete");
      if (!removed) return;
      announce(describeEventAction("delete", removed.event));
      openNotice(describeEventNotice("delete", removed.event), removed.step);
    },
    [
      resolveDrawn,
      setPending,
      applySeriesDelete,
      removeEvent,
      announce,
      openNotice,
    ],
  );

  const deleteEvent = React.useCallback(
    (eventId: string, scope?: SeriesEditScope) => {
      // One of several selected events: they all go, as one undo step and
      // with no series question (see `removeEvents`)
      const group = getActionGroup(eventId);
      if (group) {
        afterSeriesChange(() => {
          const removedGroup = removeEvents(group, "delete");
          if (!removedGroup) return;
          const count = removedGroup.events.length;
          announce(describeGroupAction("delete", count));
          openNotice(describeGroupNotice("delete", count), removedGroup.step);
        });
        return;
      }
      // Deleting another event leaves the one a change waits for
      if (pendingSeriesChangeRef.current && !isWaitingDate(eventId)) {
        afterSeriesChange(() => applyEventDelete(eventId, scope));
        return;
      }
      applyEventDelete(eventId, scope);
    },
    [
      getActionGroup,
      removeEvents,
      announce,
      openNotice,
      isWaitingDate,
      afterSeriesChange,
      applyEventDelete,
    ],
  );

  const cutEvent = React.useCallback(
    (eventId: string) => {
      afterSeriesChange(() => {
        const group = getActionGroup(eventId);
        if (group) {
          const removedGroup = removeEvents(group, "cut");
          if (!removedGroup) return;
          const count = removedGroup.events.length;
          setCopiedEvent(removedGroup.events[0]);
          setCopiedGroup(removedGroup.events);
          announce(describeGroupAction("cut", count));
          openNotice(describeGroupNotice("cut", count), removedGroup.step);
          return;
        }
        const removed = removeEvent(eventId, "cut");
        if (!removed) return;
        setCopiedEvent(removed.event);
        setCopiedGroup(null);
        announce(describeEventAction("cut", removed.event));
        openNotice(describeEventNotice("cut", removed.event), removed.step);
      });
    },
    [
      afterSeriesChange,
      getActionGroup,
      removeEvents,
      removeEvent,
      announce,
      openNotice,
    ],
  );

  const copyEvent = React.useCallback(
    (eventId: string) => {
      const group = getActionGroup(eventId);
      if (group) {
        const copied = findEvents(group);
        if (copied.length === 0) return;
        setCopiedEvent(copied[0]);
        setCopiedGroup(copied);
        announce(describeGroupAction("copy", copied.length));
        openNotice(describeGroupNotice("copy", copied.length), null);
        return;
      }
      const event = findEventOrOccurrence(eventsRef.current, eventId);
      if (!event) return;
      setCopiedEvent(event);
      setCopiedGroup(null);
      announce(describeEventAction("copy", event));
      openNotice(describeEventNotice("copy", event), null);
    },
    [getActionGroup, findEvents, announce, openNotice],
  );

  /** Adds a duplicated or pasted copy, selects it and announces where it is */
  const addEventCopy = React.useCallback(
    (copy: CalendarEvent, action: "duplicate" | "paste") => {
      const changes: EventHistoryChange[] = [
        { before: null, after: copy, index: eventsRef.current.length },
      ];
      commitChanges(changes);
      recordHistory(action, changes);
      selectEvent(copy.id);
      announce(
        `${describeEventAction(action, copy)}, ${describeEventTime(toDisplayEvent(copy, displayTimeZone), hourCycle, locale)}`,
      );
    },
    [
      commitChanges,
      recordHistory,
      selectEvent,
      announce,
      hourCycle,
      locale,
      displayTimeZone,
    ],
  );

  const duplicateEvent = React.useCallback(
    (eventId: string) => {
      const group = getActionGroup(eventId);
      if (group) {
        const sources = findEvents(group);
        if (sources.length === 0) return;
        addEventCopies(
          sources.map((source) =>
            createStandaloneCopy(source, crypto.randomUUID()),
          ),
          "duplicate",
        );
        return;
      }
      const source = findEventOrOccurrence(eventsRef.current, eventId);
      if (!source) return;
      // A copy never claims to be an occurrence of the series it came from
      addEventCopy(
        createStandaloneCopy(source, crypto.randomUUID()),
        "duplicate",
      );
    },
    [getActionGroup, findEvents, addEventCopies, addEventCopy],
  );

  /**
   * After undo or redo of a step on several events: selects them, unless
   * the step just took them away. Returns whether it was such a step
   */
  const selectGroupStep = React.useCallback(
    (entry: EventHistoryEntry, direction: "undo" | "redo") => {
      const eventIds = groupStepsRef.current.get(entry);
      if (!eventIds) return false;
      const removesOnUndo =
        entry.action === "paste" || entry.action === "duplicate";
      const removesOnRedo = entry.action === "delete" || entry.action === "cut";
      const removes = direction === "undo" ? removesOnUndo : removesOnRedo;
      setSelectedEventIds(removes ? NO_SELECTED_IDS : eventIds);
      return true;
    },
    [setSelectedEventIds],
  );

  /** After undo or redo: selects the event the step leaves, or clears the selection when it removed the selected one */
  const selectChangedEvent = React.useCallback(
    (changes: EventHistoryChange[]) => {
      const last = changes[changes.length - 1];
      if (!last) return;
      if (last.after) {
        selectEvent(last.after.id);
        return;
      }
      const removedId = getChangedEventId(last);
      setSelectedEventId((prev) => (prev === removedId ? null : prev));
    },
    [selectEvent],
  );

  const undo = React.useCallback(() => {
    // A change waits: ask about it first; undo again once it is answered
    if (pendingSeriesChangeRef.current) {
      afterSeriesChange(() => {});
      return;
    }
    const entry = history.past[history.past.length - 1];
    if (!entry) return;
    const changes = invertEventChanges(entry.changes);
    if (!canApplyEventChanges(eventsRef.current, changes)) return;
    commitChanges(changes);
    setHistory({
      past: history.past.slice(0, -1),
      future: [...history.future, entry],
    });
    if (!selectGroupStep(entry, "undo")) selectChangedEvent(changes);
    announce(describeHistoryStep(entry, "undo"));
  }, [
    history,
    commitChanges,
    selectGroupStep,
    selectChangedEvent,
    announce,
    afterSeriesChange,
  ]);

  const redo = React.useCallback(() => {
    if (pendingSeriesChangeRef.current) {
      afterSeriesChange(() => {});
      return;
    }
    const entry = history.future[history.future.length - 1];
    if (!entry) return;
    if (!canApplyEventChanges(eventsRef.current, entry.changes)) return;
    commitChanges(entry.changes);
    setHistory({
      past: [...history.past, entry],
      future: history.future.slice(0, -1),
    });
    if (!selectGroupStep(entry, "redo")) selectChangedEvent(entry.changes);
    announce(describeHistoryStep(entry, "redo"));
  }, [
    history,
    commitChanges,
    selectGroupStep,
    selectChangedEvent,
    announce,
    afterSeriesChange,
  ]);

  // A step applies only while its events are still the objects it left
  // (see canApplyEventChanges): an app that replaced them turns these off
  const canUndo = React.useMemo(() => {
    const entry = history.past[history.past.length - 1];
    if (!entry) return false;
    return canApplyEventChanges(events, invertEventChanges(entry.changes));
  }, [history, events]);

  const canRedo = React.useMemo(() => {
    const entry = history.future[history.future.length - 1];
    if (!entry) return false;
    return canApplyEventChanges(events, entry.changes);
  }, [history, events]);

  // Undo shows exactly while Cmd+Z would take the notice's step back: the
  // step is the latest (closed above otherwise) and still applies
  const notice = React.useMemo<CalendarNotice | null>(() => {
    if (!shownNotice) return null;
    if (!shownNotice.step || !canUndo) return shownNotice.notice;
    return { ...shownNotice.notice, onUndo: undo };
  }, [shownNotice, canUndo, undo]);

  const { showWeekends, showDeclinedEvents } = viewSettings;
  const changeTimeZones = React.useCallback(
    (change: (zones: CalendarTimeZones) => CalendarTimeZones) => {
      // The change works on real zones: the viewer's stands in for unset
      const current: CalendarTimeZones = {
        primary: primaryTimeZone ?? getViewerTimeZone(),
        secondary: knownSecondaryTimeZones,
      };
      const next = change(current);
      if (next.primary && next.primary !== current.primary) {
        setPrimaryTimeZone(next.primary);
      }
      const secondaryChanged =
        next.secondary.length !== current.secondary.length ||
        next.secondary.some((zone, index) => zone !== current.secondary[index]);
      if (secondaryChanged) setSecondaryTimeZoneList(next.secondary);
    },
    [
      primaryTimeZone,
      knownSecondaryTimeZones,
      setPrimaryTimeZone,
      setSecondaryTimeZoneList,
    ],
  );

  const travelToTimeZone = React.useCallback(
    (zone: string | null) => {
      // Travelling to the primary zone is being home
      const isHome =
        !zone ||
        !isKnownTimeZone(zone) ||
        zone === (primaryTimeZone ?? getViewerTimeZone());
      setTravelTimeZone(isHome ? null : zone);
    },
    [primaryTimeZone],
  );

  const goToToday = React.useCallback(() => {
    setCurrentDate(
      getPeriodStart(
        getZonedNow(displayTimeZone),
        view,
        weekStartsOn,
        numberOfDays,
        showWeekends,
      ),
    );
  }, [
    view,
    weekStartsOn,
    numberOfDays,
    showWeekends,
    setCurrentDate,
    displayTimeZone,
  ]);

  const goToPrev = React.useCallback(() => {
    setCurrentDate((prev) =>
      shiftPeriod(prev, view, -1, numberOfDays, showWeekends),
    );
  }, [view, numberOfDays, showWeekends, setCurrentDate]);

  const goToNext = React.useCallback(() => {
    setCurrentDate((prev) =>
      shiftPeriod(prev, view, 1, numberOfDays, showWeekends),
    );
  }, [view, numberOfDays, showWeekends, setCurrentDate]);

  // A day view never lands on a hidden weekend: a Saturday shows Monday
  const goToDate = React.useCallback(
    (date: Date) =>
      setCurrentDate(
        stepsByDay(view, numberOfDays)
          ? getFirstShownDay(date, showWeekends)
          : date,
      ),
    [view, numberOfDays, showWeekends, setCurrentDate],
  );

  // Series math runs on the stored instants; the arrows get the
  // occurrences on the calendar's clock
  const isSelectedAllDay = Boolean(storedSelectedEvent?.isAllDay);
  const previousInSeries = React.useMemo(
    () =>
      storedSelectedEvent
        ? toDisplayOccurrence(
            findSeriesOccurrence(events, storedSelectedEvent, "previous"),
            isSelectedAllDay,
            displayTimeZone,
          )
        : null,
    [events, storedSelectedEvent, isSelectedAllDay, displayTimeZone],
  );
  const nextInSeries = React.useMemo(
    () =>
      storedSelectedEvent
        ? toDisplayOccurrence(
            findSeriesOccurrence(events, storedSelectedEvent, "next"),
            isSelectedAllDay,
            displayTimeZone,
          )
        : null,
    [events, storedSelectedEvent, isSelectedAllDay, displayTimeZone],
  );

  const showSeriesOccurrence = React.useCallback(
    (occurrence: SeriesOccurrence) => {
      // A generated occurrence is selected as it is: nothing is added
      selectEvent(occurrence.id);

      // Stay put while the occurrence is on screen
      const start = occurrence.start;
      // Year view shows the whole year of the occurrence
      if (view === "year" && isSameYear(start, currentDate)) return;
      const isOnScreen =
        view === "month"
          ? isSameMonth(start, displayMonth ?? currentDate)
          : visibleDays.some((day) => isSameDay(day, start));
      if (isOnScreen) return;
      // Month view starts on the week of the 1st, so the month is the one shown
      const periodDate = view === "month" ? startOfMonth(start) : start;
      setCurrentDate(
        getPeriodStart(
          periodDate,
          view,
          weekStartsOn,
          numberOfDays,
          showWeekends,
        ),
      );
    },
    [
      selectEvent,
      view,
      displayMonth,
      currentDate,
      visibleDays,
      weekStartsOn,
      numberOfDays,
      showWeekends,
      setCurrentDate,
    ],
  );

  const { headerDate, headerRangeEnd } = getHeaderDates(
    view,
    currentDate,
    visibleDays,
    displayMonth,
  );
  /** Year the header names, which `switchView("year")` opens */
  const headerYear = getHeaderYear(
    view,
    currentDate,
    visibleDays,
    displayMonth,
  );

  const switchView = React.useCallback(
    (newView: ViewType) => {
      if (newView === view) return;
      pendingSwitchRef.current = { view, numberOfDays, date: currentDate };
      setView(newView);
      if (newView === "day") {
        setCurrentDate(
          getFirstShownDay(
            startOfDay(getZonedNow(displayTimeZone)),
            showWeekends,
          ),
        );
        return;
      }
      if (newView === "agenda") {
        setCurrentDate((prev) =>
          getAgendaStartFrom(
            prev,
            view,
            numberOfDays,
            getZonedNow(displayTimeZone),
            showWeekends,
          ),
        );
        return;
      }
      // The title keeps its year: January's month view opens the new year
      if (newView === "year") {
        // Year view draws no events, so none stays selected for the keys
        setSelectedEventId(null);
        setCurrentDate(new Date(headerYear, 0, 1));
        return;
      }
      setCurrentDate((prev) =>
        getPeriodStart(
          view === "year"
            ? getYearViewExitDate(prev, getZonedNow(displayTimeZone))
            : prev,
          newView,
          weekStartsOn,
          numberOfDays,
          showWeekends,
        ),
      );
    },
    [
      view,
      currentDate,
      weekStartsOn,
      numberOfDays,
      showWeekends,
      headerYear,
      setView,
      setCurrentDate,
      displayTimeZone,
    ],
  );

  const changeNumberOfDays = React.useCallback(
    (count: number) => {
      if (count !== numberOfDays) {
        pendingSwitchRef.current = { view, numberOfDays, date: currentDate };
      }
      setNumberOfDays(count);
      if (view !== "week") return;
      // Going back to a full week starts on the week's first day again
      setCurrentDate((prev) => {
        const next = getPeriodStart(
          prev,
          "week",
          weekStartsOn,
          count,
          showWeekends,
        );
        return next.getTime() === prev.getTime() ? prev : next;
      });
    },
    [
      view,
      numberOfDays,
      currentDate,
      weekStartsOn,
      showWeekends,
      setNumberOfDays,
      setCurrentDate,
    ],
  );

  const showDay = React.useCallback(
    (date: Date) => {
      if (view !== "week") {
        pendingSwitchRef.current = { view, numberOfDays, date: currentDate };
      }
      setView("week");
      setCurrentDate(
        getPeriodStart(date, "week", weekStartsOn, numberOfDays, showWeekends),
      );
      setHighlightedDate(date);
    },
    [
      view,
      currentDate,
      weekStartsOn,
      numberOfDays,
      showWeekends,
      setView,
      setCurrentDate,
    ],
  );

  const reportView = React.useCallback(
    (reported: ReportedView) => {
      mountedViewRef.current = reported;
      const pendingSwitch = pendingSwitchRef.current;
      pendingSwitchRef.current = null;
      // Controlled values always win over the mounted view
      const nextView = viewProp ?? reported.view;
      const nextNumberOfDays =
        numberOfDaysProp ?? reported.numberOfDays ?? numberOfDays;
      const conflictsWithControlled =
        reported.view !== nextView ||
        (reported.numberOfDays !== undefined &&
          reported.numberOfDays !== nextNumberOfDays);
      if (
        conflictsWithControlled &&
        process.env.NODE_ENV !== "production" &&
        !hasWarnedViewConflictRef.current
      ) {
        hasWarnedViewConflictRef.current = true;
        console.warn(
          `CalendarProvider: the mounted ${reported.view} view doesn't match the controlled \`view\` / \`numberOfDays\` props, which navigation follows. Render the view they name, e.g. <TimeGrid view={view} />.`,
        );
      }
      if (nextView === view && nextNumberOfDays === numberOfDays) return;

      const nextDate = getAdoptedViewDate({
        currentDate,
        view: nextView,
        numberOfDays: nextNumberOfDays,
        weekStartsOn,
        pendingSwitch,
        isOnStartingToday:
          startsOnToday && currentDate.getTime() === initialTime,
        showWeekends,
        now: getZonedNow(displayTimeZone),
      });
      setView(nextView);
      setNumberOfDays(nextNumberOfDays);
      setCurrentDate(nextDate);
      // Header info reads the visible days: match them to the new date before
      // the first paint (the view reports its own after it). A controlled date
      // may not change, so it waits for the view's report.
      if (dateProp !== undefined) return;
      setVisibleDays(
        hasNoVisibleDays(nextView)
          ? []
          : getVisibleDays(nextDate, nextView, nextNumberOfDays, showWeekends),
      );
    },
    [
      viewProp,
      numberOfDaysProp,
      dateProp,
      view,
      numberOfDays,
      currentDate,
      startsOnToday,
      initialTime,
      weekStartsOn,
      showWeekends,
      setView,
      setNumberOfDays,
      setCurrentDate,
      displayTimeZone,
    ],
  );

  const changeWeekStartsOn = React.useCallback(
    (day: WeekStartsOn) => {
      if (day === weekStartsOn) return;
      setWeekStartsOnState(day);
      // A full week or a month grid starts on the new day: keep the week
      // around the middle of the first one on screen (from Sunday May 31,
      // Monday weeks show June 1-7, not May 25-31). Day steps start on any
      // day anyway.
      if (view !== "week" && view !== "month") return;
      setCurrentDate((prev) => {
        const middle = addDays(prev, WEEK_MIDDLE_OFFSET);
        const next = getPeriodStart(
          middle,
          view,
          day,
          numberOfDays,
          showWeekends,
        );
        return next.getTime() === prev.getTime() ? prev : next;
      });
    },
    [
      weekStartsOn,
      view,
      numberOfDays,
      showWeekends,
      setWeekStartsOnState,
      setCurrentDate,
    ],
  );

  /** One zoom step from the set height, else from the one on screen */
  const zoomHours = React.useCallback(
    (direction: "in" | "out") => {
      setHourHeight((prev) =>
        getZoomedHourHeight(
          prev ?? renderedHourHeightRef.current ?? FALLBACK_HOUR_HEIGHT,
          direction,
        ),
      );
    },
    [setHourHeight],
  );

  const zoomHoursIn = React.useCallback(() => zoomHours("in"), [zoomHours]);

  const zoomHoursOut = React.useCallback(() => zoomHours("out"), [zoomHours]);

  const resetHourHeight = React.useCallback(
    () => setHourHeight(null),
    [setHourHeight],
  );

  const toggleWeekends = React.useCallback(() => {
    setViewSettings((prev) => ({ ...prev, showWeekends: !prev.showWeekends }));
    // Hiding them: a day view on a Saturday or Sunday moves to Monday
    if (!showWeekends || !stepsByDay(view, numberOfDays)) return;
    setCurrentDate((prev) => {
      const next = getFirstShownDay(prev, false);
      return next.getTime() === prev.getTime() ? prev : next;
    });
  }, [showWeekends, view, numberOfDays, setCurrentDate]);

  const toggleDeclinedEvents = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showDeclinedEvents: !prev.showDeclinedEvents,
    }));
    // Hiding them: a declined event that is selected leaves the screen
    if (
      showDeclinedEvents &&
      selectedEvent &&
      isDeclinedByViewer(selectedEvent)
    ) {
      setSelectedEventId(null);
    }
  }, [showDeclinedEvents, selectedEvent]);

  const toggleWeekNumbers = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showWeekNumbers: !prev.showWeekNumbers,
    }));
  }, []);

  const {
    monthName: headerMonthName,
    year,
    weekNumber,
  } = getCalendarHeaderInfo(headerDate, weekStartsOn, locale, headerRangeEnd);
  // Year view's header names the year alone
  const monthName = view === "year" ? "" : headerMonthName;

  // Derived from the provider's own period, not the live `visibleDays`, so a
  // horizontal scroll moves it once it snaps instead of at every day it passes
  const range = getVisibleRange(
    currentDate,
    view,
    numberOfDays,
    weekStartsOn,
    viewSettings.showWeekends,
  );
  const rangeStartTime = range.start.getTime();
  const rangeEndTime = range.end.getTime();
  const visibleRange = React.useMemo<VisibleRange>(
    () => ({ start: new Date(rangeStartTime), end: new Date(rangeEndTime) }),
    [rangeStartTime, rangeEndTime],
  );

  const pasteEvent = React.useCallback(() => {
    // Year view has no slot or day to paste onto, and a paste would land
    // out of sight on a spot a view left behind
    if (!copiedEvent || view === "year") return;
    // The target and the visible days are on the calendar's clock: place
    // the copy there, then store its instants
    const target = resolvePasteTarget(
      pasteTargetRef.current,
      visibleRange,
      getZonedNow(displayTimeZone),
      currentDate,
    );
    // Events cut or copied together land together: the earliest at the
    // target, the others as far from it as they were on the calendar's clock
    if (copiedGroup && copiedGroup.length > 1) {
      const shownSources = copiedGroup.map((source) =>
        toDisplayEvent(source, displayTimeZone),
      );
      const times = getPastedGroupTimes(shownSources, target);
      addEventCopies(
        copiedGroup.map((source, index) =>
          fromDisplayEvent(
            {
              ...createStandaloneCopy(source, crypto.randomUUID()),
              ...times[index],
            },
            displayTimeZone,
          ),
        ),
        "paste",
      );
      return;
    }
    const copy = {
      ...createStandaloneCopy(copiedEvent, crypto.randomUUID()),
      ...getPastedEventTimes(
        toDisplayEvent(copiedEvent, displayTimeZone),
        target,
      ),
    };
    addEventCopy(fromDisplayEvent(copy, displayTimeZone), "paste");
  }, [
    copiedEvent,
    copiedGroup,
    view,
    visibleRange,
    currentDate,
    addEventCopies,
    addEventCopy,
    displayTimeZone,
  ]);

  const selectAllVisible = React.useCallback(() => {
    // Year view draws no events to select
    if (view === "year") return;
    // The visible range is on the calendar's clock: so are the events
    // compared with it
    const shownEvents = eventsRef.current.map((event) =>
      toDisplayEvent(event, displayTimeZone),
    );
    setSelectedEventIds(
      getVisibleEventIds(shownEvents, visibleRange, displayTimeZone),
    );
  }, [view, visibleRange, displayTimeZone, setSelectedEventIds]);

  // Go to date: the date's period in the current view, the day flashing as
  // after `showDay`
  const navigateToDate = React.useCallback(
    (date: Date) => {
      // A hidden weekend day lands on the Monday after, as goToDate does
      setCurrentDate(
        getPeriodStart(date, view, weekStartsOn, numberOfDays, showWeekends),
      );
      setHighlightedDate(startOfDay(date));
    },
    [view, weekStartsOn, numberOfDays, showWeekends, setCurrentDate],
  );

  // Notion Calendar's C: the day just gone to, else today, else the first
  // day shown (month view: of the month it shows)
  const addEventAtNextSlot = React.useCallback(() => {
    // The slot and the visible days are on the calendar's clock
    const now = getZonedNow(displayTimeZone);
    const day = getNextSlotDay({
      range: visibleRange,
      today: startOfDay(now),
      highlightedDate,
      firstDay:
        view === "month" && displayMonth ? displayMonth : visibleRange.start,
    });
    // A draft drawn as an event from the start, as Notion Calendar's C
    // draws it. All-day in month view, which has no hours
    if (view === "month") {
      startEventDraft(getAllDayEventRange(day));
      return;
    }
    startEventDraft(
      getNextSlotEventRange(day, now, {
        snapMinutes: Math.max(1, Math.round(snapMinutes)),
        defaultEventDuration: Math.max(1, Math.round(defaultEventDuration)),
        ...resolveDayHours(dayStartHour, dayEndHour),
      }),
    );
  }, [
    visibleRange,
    view,
    displayMonth,
    highlightedDate,
    startEventDraft,
    snapMinutes,
    defaultEventDuration,
    dayStartHour,
    dayEndHour,
    displayTimeZone,
  ]);

  // Report each new range once. While the provider is still adopting the
  // mounted view (its first commit, or a switch the view is undoing), the
  // range belongs to a view that isn't on screen, so wait for the next one.
  // Same resolution as `reportView`: controlled values win.
  React.useEffect(() => {
    const mounted = mountedViewRef.current;
    if (mounted) {
      const adoptedView = viewProp ?? mounted.view;
      const adoptedNumberOfDays =
        numberOfDaysProp ?? mounted.numberOfDays ?? numberOfDays;
      if (adoptedView !== view || adoptedNumberOfDays !== numberOfDays) return;
    }
    const key = `${visibleRange.start.getTime()}-${visibleRange.end.getTime()}-${displayTimeZone ?? ""}`;
    if (reportedRangeKeyRef.current === key) return;
    reportedRangeKeyRef.current = key;
    // The app fetches stored events: hand it the instants the days start
    onVisibleRangeChangeRef.current?.(
      fromDisplayRange(visibleRange, displayTimeZone),
    );
  }, [
    visibleRange,
    view,
    numberOfDays,
    viewProp,
    numberOfDaysProp,
    displayTimeZone,
  ]);

  const value = React.useMemo<CalendarContextValue>(
    () => ({
      events: displayEvents,
      view,
      currentDate,
      weekStartsOn,
      numberOfDays,
      hourHeight,
      viewSettings,
      visibleDays,
      displayMonth,
      visibleRange,
      loading,
      selectedEventId,
      selectedEventIds,
      selectedEvent,
      previousInSeries,
      nextInSeries,
      showSeriesOccurrence,
      timeZones,
      changeTimeZones,
      travelTimeZone,
      travelToTimeZone,
      highlightedDate,
      monthName,
      year,
      weekNumber,
      goToToday,
      goToPrev,
      goToNext,
      goToDate,
      switchView,
      setNumberOfDays: changeNumberOfDays,
      selectEvent,
      clearSelection,
      eventDraft: activeDraft,
      startEventDraft,
      updateEventDraft,
      setSelectedEventIds,
      toggleEventSelection,
      selectAllVisible,
      addEventFromRange,
      updateEvent,
      setWeekStartsOn: changeWeekStartsOn,
      zoomHoursIn,
      zoomHoursOut,
      resetHourHeight,
      editEvent,
      toggleWeekends,
      toggleDeclinedEvents,
      toggleWeekNumbers,
      showDay,
      deleteEvent,
      duplicateEvent,
      copyEvent,
      cutEvent,
      pasteEvent,
      undo,
      redo,
      canUndo,
      canRedo,
      navigateToDate,
      addEventAtNextSlot,
    }),
    [
      displayEvents,
      view,
      currentDate,
      weekStartsOn,
      numberOfDays,
      hourHeight,
      viewSettings,
      visibleDays,
      displayMonth,
      visibleRange,
      loading,
      selectedEventId,
      selectedEventIds,
      selectedEvent,
      previousInSeries,
      nextInSeries,
      showSeriesOccurrence,
      timeZones,
      changeTimeZones,
      travelTimeZone,
      travelToTimeZone,
      highlightedDate,
      monthName,
      year,
      weekNumber,
      goToToday,
      goToPrev,
      goToNext,
      goToDate,
      switchView,
      changeNumberOfDays,
      selectEvent,
      clearSelection,
      activeDraft,
      startEventDraft,
      updateEventDraft,
      setSelectedEventIds,
      toggleEventSelection,
      selectAllVisible,
      addEventFromRange,
      updateEvent,
      changeWeekStartsOn,
      zoomHoursIn,
      zoomHoursOut,
      resetHourHeight,
      editEvent,
      toggleWeekends,
      toggleDeclinedEvents,
      toggleWeekNumbers,
      showDay,
      deleteEvent,
      duplicateEvent,
      copyEvent,
      cutEvent,
      pasteEvent,
      undo,
      redo,
      canUndo,
      canRedo,
      navigateToDate,
      addEventAtNextSlot,
    ],
  );

  // The draft joins the events the views draw once it is one itself
  const drawnEvents = React.useMemo(
    () =>
      activeDraft && isDraftAnEvent
        ? [...displayEvents, activeDraft]
        : displayEvents,
    [displayEvents, activeDraft, isDraftAnEvent],
  );

  const closeEventPopover = React.useCallback(
    (eventId: string) => {
      const close = () => {
        // Closing a draft's details settles it: saved if it was named
        if (draftStateRef.current?.event.id === eventId) settleEventDraft();
        setSelectedEventId((prev) => (prev === eventId ? null : prev));
      };
      // Closing the details of the date a change waits for leaves it
      if (isWaitingDate(eventId)) {
        afterSeriesChange(close);
        return;
      }
      close();
    },
    [isWaitingDate, afterSeriesChange, settleEventDraft],
  );

  /** Takes the answer to the series question */
  const answerSeriesScope = React.useCallback(
    (answer: SeriesScopeAnswer) => {
      const pending = pendingSeriesChangeRef.current;
      if (!pending) return;
      if (answer.action === "continue") {
        // Back to the change: the date selected alone, its details open
        setPending({ ...pending, isAsking: false, onLeave: null });
        setGroupSelection(null);
        setSelectedEventId(pending.before.id);
        onEventSelect?.(pending.before.id);
        return;
      }
      setPending(null);
      if (answer.action === "delete") {
        applySeriesDelete(pending.before, answer.scope);
        return;
      }
      if (answer.action === "cancel") return;
      if (answer.action === "save") {
        applySeriesEdit(pending.before, pending.after, answer.scope);
      }
      // Save or Discard: what leaving the event was about to do goes on
      pending.onLeave?.();
    },
    [setPending, onEventSelect, applySeriesEdit, applySeriesDelete],
  );

  // While a change to a repeating event's date waits, the views draw that
  // date with the change; Discard drops it, so a dragged date goes back
  const previewSeriesChange = React.useCallback(
    <TEvent extends CalendarEvent>(drawn: TEvent[]): TEvent[] => {
      const pending = pendingSeriesChange;
      if (pending?.action !== "update") return drawn;
      // Held as stored: drawn on the calendar's clock, like the rest
      const shown = toDisplayEvent(pending.after, displayTimeZone);
      return drawn.map((event) =>
        event.id === pending.before.id ? (shown as TEvent) : event,
      );
    },
    [pendingSeriesChange, displayTimeZone],
  );

  const seriesQuestion = React.useMemo<SeriesScopeQuestion | null>(() => {
    const pending = pendingSeriesChange;
    if (!pending?.isAsking) return null;
    if (pending.action === "delete") {
      return {
        action: "delete",
        title: pending.before.title,
        scopes: getSeriesDeleteScopes(events, pending.before),
        summary: [],
      };
    }
    return {
      action: "update",
      title: pending.before.title,
      scopes: getSeriesEditScopes(events, pending.before, pending.after),
      // Times read on the calendar's clock
      summary: getEventChangeSummary(
        toDisplayEvent(pending.before, displayTimeZone),
        toDisplayEvent(pending.after, displayTimeZone),
        { hourCycle, locale, calendars },
      ),
    };
  }, [
    pendingSeriesChange,
    events,
    hourCycle,
    locale,
    calendars,
    displayTimeZone,
  ]);

  const seriesScope = React.useMemo<CalendarSeriesScopeValue>(
    () => ({
      question: seriesQuestion,
      answer: answerSeriesScope,
      registerDialog: registerSeriesDialog,
      pendingEventId:
        pendingSeriesChange?.action === "update"
          ? pendingSeriesChange.before.id
          : null,
      previewEvents: previewSeriesChange,
      editEvent: editSeriesEvent,
    }),
    [
      seriesQuestion,
      answerSeriesScope,
      registerSeriesDialog,
      pendingSeriesChange,
      previewSeriesChange,
      editSeriesEvent,
    ],
  );

  const reportPasteTarget = React.useCallback((target: EventPasteTarget) => {
    pasteTargetRef.current = target;
  }, []);

  const reportHourHeight = React.useCallback((height: number) => {
    renderedHourHeightRef.current = height;
  }, []);

  const viewSync = React.useMemo<CalendarViewSyncValue>(
    () => ({
      reportView,
      reportVisibleDays: setVisibleDays,
      reportDisplayMonth: setDisplayMonth,
      closeEventPopover,
      reportPasteTarget,
      drawEventDraft,
      drawnEvents,
      reportHourHeight,
    }),
    [
      reportView,
      closeEventPopover,
      reportPasteTarget,
      drawEventDraft,
      drawnEvents,
      reportHourHeight,
    ],
  );

  // The event the draft layers stand for: the draft, then the event it was
  // saved as until the selection moves on
  const createdEvent =
    draftOriginId !== null && draftOriginId === selectedEventId
      ? selectedEvent
      : null;
  const isDrawingDraft = activeDraftState?.isDrawing ?? false;
  const eventDraftValue = React.useMemo<CalendarEventDraftValue>(
    () => ({
      event: createdEvent,
      isDraft: activeDraft !== null,
      isTinted: activeDraft !== null && !isDraftAnEvent,
      isDrawing: isDrawingDraft,
      updateEvent: editEvent,
      updateEventDraft,
      closePopover: closeEventPopover,
    }),
    [
      createdEvent,
      activeDraft,
      isDraftAnEvent,
      isDrawingDraft,
      editEvent,
      updateEventDraft,
      closeEventPopover,
    ],
  );

  const series = React.useMemo<CalendarSeriesValue>(
    () => ({
      eventId: selectedEvent?.id ?? null,
      previousInSeries,
      nextInSeries,
      showSeriesOccurrence,
    }),
    [selectedEvent, previousInSeries, nextInSeries, showSeriesOccurrence],
  );

  const eventActions = React.useMemo<CalendarEventActionsValue>(
    () => ({
      cutEvent,
      copyEvent,
      duplicateEvent,
      deleteEvent,
      hasCopiedEvent: copiedEvent !== null,
    }),
    [cutEvent, copyEvent, duplicateEvent, deleteEvent, copiedEvent],
  );

  const noticeValue = React.useMemo<CalendarNoticeValue>(
    () => ({ notice, showNotice, dismissNotice }),
    [notice, showNotice, dismissNotice],
  );

  const renderSlots = React.useMemo<CalendarRenderSlots>(
    () => ({ renderEventContent, renderEventDetails }),
    [renderEventContent, renderEventDetails],
  );

  const config = React.useMemo<CalendarConfig>(
    () => ({
      snapMinutes: Math.max(1, Math.round(snapMinutes)),
      defaultEventDuration: Math.max(1, Math.round(defaultEventDuration)),
      ...resolveDayHours(dayStartHour, dayEndHour),
      hourCycle,
      locale,
      // Unknown zones would make their labels throw: left out
      secondaryTimeZone: knownSecondaryTimeZones[0],
      secondaryTimeZones: knownSecondaryTimeZones,
      timeZone: displayTimeZone,
      weekStartsOn,
      calendars,
      eventColors,
      contacts,
      rooms,
      conferenceProviders,
      locationSuggestions,
    }),
    [
      snapMinutes,
      defaultEventDuration,
      dayStartHour,
      dayEndHour,
      hourCycle,
      locale,
      knownSecondaryTimeZones,
      displayTimeZone,
      weekStartsOn,
      calendars,
      eventColors,
      contacts,
      rooms,
      conferenceProviders,
      locationSuggestions,
    ],
  );

  return (
    <CalendarContext.Provider value={value}>
      <CalendarViewSyncContext.Provider value={viewSync}>
        <CalendarRenderSlotsContext.Provider value={renderSlots}>
          <CalendarConfigContext.Provider value={config}>
            <CalendarSeriesContext.Provider value={series}>
              <CalendarSeriesScopeContext.Provider value={seriesScope}>
                <CalendarEventActionsContext.Provider value={eventActions}>
                  <CalendarEventDraftContext.Provider value={eventDraftValue}>
                    <CalendarNoticeContext.Provider value={noticeValue}>
                      <EventTitleFocusProvider
                        pendingEventId={pendingTitleFocusId}
                        clearPending={clearTitleFocus}
                      >
                        <CalendarPeopleProvider value={people}>
                          <CalendarSelectionContext.Provider
                            value={selectedEventIds}
                          >
                            {children}
                          </CalendarSelectionContext.Provider>
                        </CalendarPeopleProvider>
                        {/* Announces changes, the event actions, undo and redo to screen readers */}
                        <div
                          role="status"
                          aria-live="polite"
                          className="sr-only"
                        >
                          {announcement && (
                            <span key={announcement.id}>
                              {announcement.text}
                            </span>
                          )}
                        </div>
                      </EventTitleFocusProvider>
                    </CalendarNoticeContext.Provider>
                  </CalendarEventDraftContext.Provider>
                </CalendarEventActionsContext.Provider>
              </CalendarSeriesScopeContext.Provider>
            </CalendarSeriesContext.Provider>
          </CalendarConfigContext.Provider>
        </CalendarRenderSlotsContext.Provider>
      </CalendarViewSyncContext.Provider>
    </CalendarContext.Provider>
  );
}

/**
 * Returns calendar state and actions from the nearest CalendarProvider.
 * Pass the event type given to the provider to get events and callbacks
 * typed with it. Throws when used outside a provider.
 */
export function useCalendar<
  TEvent extends CalendarEvent = CalendarEvent,
>(): CalendarContextValue<TEvent> {
  const context = React.useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within a CalendarProvider.");
  }
  // React context can't be generic, so the provider stores its value with
  // base `CalendarEvent` types. The events in it are the app's own objects,
  // so this restores the `TEvent` the caller gave the provider. `TEvent` is
  // both read (events) and written (updateEvent), so TypeScript sees the two
  // types as unrelated and the cast goes through `unknown`.
  return context as unknown as CalendarContextValue<TEvent>;
}

/**
 * Returns the display and interaction settings of the nearest
 * CalendarProvider (`snapMinutes`, `dayStartHour`, `dayEndHour`,
 * `hourCycle`, `locale`, `calendars`), e.g. to format times in a custom
 * `renderEventContent` the way the calendar does. Outside a provider it
 * returns the defaults.
 */
export function useCalendarConfig(): CalendarConfig {
  return React.useContext(CalendarConfigContext);
}

/**
 * Internal: the custom renderers set on the nearest CalendarProvider, for
 * the event items and popovers that draw them. Empty (all defaults) outside
 * a provider.
 */
export function useCalendarRenderSlots(): CalendarRenderSlots {
  return React.useContext(CalendarRenderSlotsContext);
}

/**
 * Internal: the selected event's series neighbors and `showSeriesOccurrence`,
 * for the details popover's series arrows. No series outside a provider.
 */
export function useCalendarSeries(): CalendarSeriesValue {
  return React.useContext(CalendarSeriesContext);
}

/**
 * Internal: the waiting change to a repeating event's date, for the views
 * and `EventSeriesScopeDialog`. Nothing waits outside a provider.
 */
export function useCalendarSeriesScope(): CalendarSeriesScopeValue {
  return React.useContext(CalendarSeriesScopeContext);
}

/**
 * Internal: the event menus' cut, copy, duplicate and delete, and whether a
 * cut or copied event waits to be pasted, for the right-click menu, the
 * details popover and the shortcuts. `null` outside a provider, where the
 * menus show the actions disabled.
 */
export function useCalendarEventActions(): CalendarEventActionsValue | null {
  return React.useContext(CalendarEventActionsContext);
}

/**
 * The event being created, for the views' draft layers (`event-draft.tsx`):
 * the draft, or the event it was saved as while it stays selected. Outside
 * a provider nothing is being created.
 */
export function useCalendarEventDraft(): CalendarEventDraftValue {
  return React.useContext(CalendarEventDraftContext);
}

/**
 * Whether the event is one of the selected events. Event items read it to
 * draw several selected events at once; outside a provider, false.
 */
export function useIsEventInSelection(eventId: string): boolean {
  return React.useContext(CalendarSelectionContext).includes(eventId);
}

/**
 * Returns the notice the calendar shows after an action ("Event deleted",
 * "Event cut", "Event copied to clipboard"), for `CalendarToaster` or a
 * toast library of your own, with `showNotice` to show a notice of yours
 * and `dismissNotice` to close one. A notice with an undo closes by itself
 * once another change is the latest. Outside a provider: no notice, and
 * both functions do nothing.
 */
export function useCalendarNotice(): CalendarNoticeValue {
  return React.useContext(CalendarNoticeContext);
}

/**
 * Internal: lets the views report what they show (visible days, displayed
 * month) back to the provider. Throws when used outside a CalendarProvider.
 */
export function useCalendarViewSync(): CalendarViewSyncValue {
  const context = React.useContext(CalendarViewSyncContext);
  if (!context) {
    throw new Error(
      "useCalendarViewSync must be used within a CalendarProvider.",
    );
  }
  return context;
}

/**
 * Internal: draws an event item's content area. Renders `renderEventContent`
 * inside a positioned box when the provider has one, otherwise the item's
 * default content unchanged. As its own component, hooks called by the
 * custom renderer stay isolated from the event item's.
 */
export function EventContentSlot({
  className,
  fallback,
  ...contentProps
}: EventContentSlotProps) {
  const { renderEventContent } = useCalendarRenderSlots();
  if (!renderEventContent) return fallback;
  return <div className={className}>{renderEventContent(contentProps)}</div>;
}
