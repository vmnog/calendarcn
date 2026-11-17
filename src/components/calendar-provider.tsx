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
  AGENDA_DAYS,
  addShownDays,
  describeEventChange,
  describeEventCreated,
  describeEventTime,
  getCalendarHeaderInfo,
  getFirstShownDay,
  getPeriodStart,
  getVisibleDays,
  getVisibleRange,
  getWeekViewStepDays,
  isDeclinedByViewer,
  stepsByDay,
} from "@/lib/event-utils";
import {
  EMPTY_EVENT_HISTORY,
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
  findSeriesOccurrence,
  getOccurrenceRemoval,
} from "@/lib/recurrence";
import { isKnownTimeZone } from "@/lib/time-zones";
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
  ConferenceProviderOption,
  EventContact,
  EventContentProps,
  EventHistory,
  EventHistoryAction,
  EventHistoryChange,
  EventHistoryEntry,
  EventPasteTarget,
  EventRoom,
  HourCycle,
  LocationSuggestion,
  NewEventRange,
  SeriesOccurrence,
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

/** Title of a click-created event when no `createEvent` factory is given */
const DEFAULT_NEW_EVENT_TITLE = "New event";

/** How long the day opened by `showDay` stays highlighted, in milliseconds */
const HIGHLIGHT_DURATION_MS = 2000;

/** Days the week view shows when `numberOfDays` is not set */
const DEFAULT_NUMBER_OF_DAYS = 7;

/** Minute step drag, resize and click-to-create snap to when `snapMinutes` is not set */
const DEFAULT_SNAP_MINUTES = 15;

/** First hour the time grid shows when `dayStartHour` is not set (midnight) */
const DEFAULT_DAY_START_HOUR = 0;

/** Hour the time grid ends at when `dayEndHour` is not set (next midnight) */
const DEFAULT_DAY_END_HOUR = 24;

/** Clock style when `hourCycle` is not set */
const DEFAULT_HOUR_CYCLE: HourCycle = 12;

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

/** Config used outside a provider, and for every provider prop left unset */
const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  snapMinutes: DEFAULT_SNAP_MINUTES,
  dayStartHour: DEFAULT_DAY_START_HOUR,
  dayEndHour: DEFAULT_DAY_END_HOUR,
  hourCycle: DEFAULT_HOUR_CYCLE,
  locale: enUS,
  calendars: NO_CALENDARS,
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

const CalendarEventActionsContext =
  React.createContext<CalendarEventActionsValue | null>(null);

/** Outside a provider: no notice, and nothing to show or close */
const NO_NOTICE: CalendarNoticeValue = {
  notice: null,
  showNotice: () => {},
  dismissNotice: () => {},
};

const CalendarNoticeContext =
  React.createContext<CalendarNoticeValue>(NO_NOTICE);

/** Default `createEvent`: a "New event" covering the clicked slot */
function createDefaultEvent(range: NewEventRange): CalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: DEFAULT_NEW_EVENT_TITLE,
    start: range.start,
    end: range.end,
  };
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
    return getPeriodStart(
      new Date(),
      view,
      weekStartsOn,
      numberOfDays,
      showWeekends,
    );
  }
  // The app swapped in a view of another type: land like switchView
  if (view === "day")
    return getFirstShownDay(startOfDay(new Date()), showWeekends);
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
  // `null` on the server and during hydration
  const today = useToday();
  const todayPeriodStart = today
    ? getPeriodStart(
        today,
        props.view ?? props.defaultView ?? "week",
        props.weekStartsOn ?? 0,
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
  weekStartsOn = 0,
  numberOfDays: numberOfDaysProp,
  defaultNumberOfDays = DEFAULT_NUMBER_OF_DAYS,
  onNumberOfDaysChange,
  defaultViewSettings,
  snapMinutes = DEFAULT_SNAP_MINUTES,
  dayStartHour = DEFAULT_DAY_START_HOUR,
  dayEndHour = DEFAULT_DAY_END_HOUR,
  hourCycle = DEFAULT_HOUR_CYCLE,
  locale = enUS,
  secondaryTimeZone,
  calendars = NO_CALENDARS,
  contacts = NO_CONTACTS,
  rooms = NO_ROOMS,
  conferenceProviders = NO_CONFERENCE_PROVIDERS,
  locationSuggestions = NO_LOCATION_SUGGESTIONS,
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
  const [viewSettings, setViewSettings] = React.useState<ViewSettings>(() => ({
    ...DEFAULT_VIEW_SETTINGS,
    ...defaultViewSettings,
  }));
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
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
  /** Latest events, so `updateEvent` can compare without depending on them */
  const eventsRef = React.useRef(events);
  /** The slot or day a view last had the mouse over: where a paste goes */
  const pasteTargetRef = React.useRef<EventPasteTarget | null>(null);
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

  // A generated occurrence of a repeating event is selected by its id too
  const selectedEvent = React.useMemo(() => {
    if (selectedEventId === null) return null;
    return findEventOrOccurrence(events, selectedEventId);
  }, [events, selectedEventId]);

  // Only honor the focus request while that event is still the selected one
  const pendingTitleFocusId =
    titleFocusEventId === selectedEventId ? titleFocusEventId : null;

  const clearTitleFocus = React.useCallback(() => {
    setTitleFocusEventId(null);
  }, []);

  const selectEvent = React.useCallback(
    (eventId: string) => {
      setSelectedEventId(eventId);
      onEventSelect?.(eventId);
    },
    [onEventSelect],
  );

  const clearSelection = React.useCallback(() => {
    setSelectedEventId(null);
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

  const updateEvent = React.useCallback(
    (updatedEvent: CalendarEvent) => {
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

      // Moves and resizes (drag, keyboard, or the details) are announced;
      // edits that keep the time, like the title, are not
      if (!previous) return;
      const message = describeEventChange(previous, next, hourCycle, locale);
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
    ],
  );

  const addEventFromRange = React.useCallback(
    (range: NewEventRange) => {
      const newEvent = (createEvent ?? createDefaultEvent)(range);
      if (!newEvent) return;
      setEvents((prev) => [...prev, newEvent]);
      onEventCreate?.(newEvent);
      recordHistory("create", [
        { before: null, after: newEvent, index: eventsRef.current.length },
      ]);
      selectEvent(newEvent.id);
      setTitleFocusEventId(newEvent.id);
      announce(describeEventCreated(newEvent, hourCycle, locale));
    },
    [
      createEvent,
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
      const current = eventsRef.current;
      const index = current.findIndex((e) => e.id === eventId);
      // A generated date of a repeating event isn't stored
      const event = current[index] ?? findEventOrOccurrence(current, eventId);
      if (!event) return null;
      // One date of a series goes by being excluded from it, and its stored
      // event, when it has one, goes with it (ADR-007). The series' own
      // event stands for the series and is deleted as any event
      const removal = getOccurrenceRemoval(current, event);
      const changes: EventHistoryChange[] = removal
        ? [
            ...(removal.removed
              ? [{ before: removal.removed, after: null, index }]
              : []),
            {
              before: removal.series,
              after: removal.excluded,
              index: current.indexOf(removal.series),
            },
          ]
        : [{ before: event, after: null, index }];
      commitChanges(changes);
      const step = recordHistory(action, changes);
      setSelectedEventId((prev) => (prev === eventId ? null : prev));
      return { event, step };
    },
    [commitChanges, recordHistory],
  );

  const deleteEvent = React.useCallback(
    (eventId: string) => {
      const removed = removeEvent(eventId, "delete");
      if (!removed) return;
      announce(describeEventAction("delete", removed.event));
      openNotice(describeEventNotice("delete", removed.event), removed.step);
    },
    [removeEvent, announce, openNotice],
  );

  const cutEvent = React.useCallback(
    (eventId: string) => {
      const removed = removeEvent(eventId, "cut");
      if (!removed) return;
      setCopiedEvent(removed.event);
      announce(describeEventAction("cut", removed.event));
      openNotice(describeEventNotice("cut", removed.event), removed.step);
    },
    [removeEvent, announce, openNotice],
  );

  const copyEvent = React.useCallback(
    (eventId: string) => {
      const event = findEventOrOccurrence(eventsRef.current, eventId);
      if (!event) return;
      setCopiedEvent(event);
      announce(describeEventAction("copy", event));
      openNotice(describeEventNotice("copy", event), null);
    },
    [announce, openNotice],
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
        `${describeEventAction(action, copy)}, ${describeEventTime(copy, hourCycle, locale)}`,
      );
    },
    [commitChanges, recordHistory, selectEvent, announce, hourCycle, locale],
  );

  const duplicateEvent = React.useCallback(
    (eventId: string) => {
      const source = findEventOrOccurrence(eventsRef.current, eventId);
      if (!source) return;
      // A copy never claims to be an occurrence of the series it came from
      addEventCopy(
        createStandaloneCopy(source, crypto.randomUUID()),
        "duplicate",
      );
    },
    [addEventCopy],
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
    const entry = history.past[history.past.length - 1];
    if (!entry) return;
    const changes = invertEventChanges(entry.changes);
    if (!canApplyEventChanges(eventsRef.current, changes)) return;
    commitChanges(changes);
    setHistory({
      past: history.past.slice(0, -1),
      future: [...history.future, entry],
    });
    selectChangedEvent(changes);
    announce(describeHistoryStep(entry, "undo"));
  }, [history, commitChanges, selectChangedEvent, announce]);

  const redo = React.useCallback(() => {
    const entry = history.future[history.future.length - 1];
    if (!entry) return;
    if (!canApplyEventChanges(eventsRef.current, entry.changes)) return;
    commitChanges(entry.changes);
    setHistory({
      past: [...history.past, entry],
      future: history.future.slice(0, -1),
    });
    selectChangedEvent(entry.changes);
    announce(describeHistoryStep(entry, "redo"));
  }, [history, commitChanges, selectChangedEvent, announce]);

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

  const goToToday = React.useCallback(() => {
    setCurrentDate(
      getPeriodStart(
        new Date(),
        view,
        weekStartsOn,
        numberOfDays,
        showWeekends,
      ),
    );
  }, [view, weekStartsOn, numberOfDays, showWeekends, setCurrentDate]);

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

  const previousInSeries = React.useMemo(
    () =>
      selectedEvent
        ? findSeriesOccurrence(events, selectedEvent, "previous")
        : null,
    [events, selectedEvent],
  );
  const nextInSeries = React.useMemo(
    () =>
      selectedEvent
        ? findSeriesOccurrence(events, selectedEvent, "next")
        : null,
    [events, selectedEvent],
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
        setCurrentDate(getFirstShownDay(startOfDay(new Date()), showWeekends));
        return;
      }
      if (newView === "agenda") {
        setCurrentDate((prev) =>
          getAgendaStartFrom(
            prev,
            view,
            numberOfDays,
            new Date(),
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
          view === "year" ? getYearViewExitDate(prev, new Date()) : prev,
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
    ],
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
    const target = resolvePasteTarget(
      pasteTargetRef.current,
      visibleRange,
      new Date(),
      currentDate,
    );
    addEventCopy(
      {
        ...createStandaloneCopy(copiedEvent, crypto.randomUUID()),
        ...getPastedEventTimes(copiedEvent, target),
      },
      "paste",
    );
  }, [copiedEvent, view, visibleRange, currentDate, addEventCopy]);

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
    const key = `${visibleRange.start.getTime()}-${visibleRange.end.getTime()}`;
    if (reportedRangeKeyRef.current === key) return;
    reportedRangeKeyRef.current = key;
    onVisibleRangeChangeRef.current?.(visibleRange);
  }, [visibleRange, view, numberOfDays, viewProp, numberOfDaysProp]);

  const value = React.useMemo<CalendarContextValue>(
    () => ({
      events,
      view,
      currentDate,
      weekStartsOn,
      numberOfDays,
      viewSettings,
      visibleDays,
      displayMonth,
      visibleRange,
      loading,
      selectedEventId,
      selectedEvent,
      previousInSeries,
      nextInSeries,
      showSeriesOccurrence,
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
      addEventFromRange,
      updateEvent,
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
    }),
    [
      events,
      view,
      currentDate,
      weekStartsOn,
      numberOfDays,
      viewSettings,
      visibleDays,
      displayMonth,
      visibleRange,
      loading,
      selectedEventId,
      selectedEvent,
      previousInSeries,
      nextInSeries,
      showSeriesOccurrence,
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
      addEventFromRange,
      updateEvent,
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
    ],
  );

  const closeEventPopover = React.useCallback((eventId: string) => {
    setSelectedEventId((prev) => (prev === eventId ? null : prev));
  }, []);

  const reportPasteTarget = React.useCallback((target: EventPasteTarget) => {
    pasteTargetRef.current = target;
  }, []);

  const viewSync = React.useMemo<CalendarViewSyncValue>(
    () => ({
      reportView,
      reportVisibleDays: setVisibleDays,
      reportDisplayMonth: setDisplayMonth,
      closeEventPopover,
      reportPasteTarget,
    }),
    [reportView, closeEventPopover, reportPasteTarget],
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
      ...resolveDayHours(dayStartHour, dayEndHour),
      hourCycle,
      locale,
      // An unknown zone would make its labels throw: draw one column instead
      secondaryTimeZone:
        secondaryTimeZone && isKnownTimeZone(secondaryTimeZone)
          ? secondaryTimeZone
          : undefined,
      weekStartsOn,
      calendars,
      contacts,
      rooms,
      conferenceProviders,
      locationSuggestions,
    }),
    [
      snapMinutes,
      dayStartHour,
      dayEndHour,
      hourCycle,
      locale,
      secondaryTimeZone,
      weekStartsOn,
      calendars,
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
              <CalendarEventActionsContext.Provider value={eventActions}>
                <CalendarNoticeContext.Provider value={noticeValue}>
                  <EventTitleFocusProvider
                    pendingEventId={pendingTitleFocusId}
                    clearPending={clearTitleFocus}
                  >
                    {children}
                    {/* Announces changes, the event actions, undo and redo to screen readers */}
                    <div role="status" aria-live="polite" className="sr-only">
                      {announcement && (
                        <span key={announcement.id}>{announcement.text}</span>
                      )}
                    </div>
                  </EventTitleFocusProvider>
                </CalendarNoticeContext.Provider>
              </CalendarEventActionsContext.Provider>
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
 * Internal: the event menus' cut, copy, duplicate and delete, and whether a
 * cut or copied event waits to be pasted, for the right-click menu, the
 * details popover and the shortcuts. `null` outside a provider, where the
 * menus show the actions disabled.
 */
export function useCalendarEventActions(): CalendarEventActionsValue | null {
  return React.useContext(CalendarEventActionsContext);
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
