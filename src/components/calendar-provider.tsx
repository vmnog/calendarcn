"use client";

import * as React from "react";
import { addDays, addMonths, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";

import { useControllableState } from "@/hooks/use-controllable-state";
import { useToday } from "@/hooks/use-now";
import { EventTitleFocusProvider } from "./event-title-focus-context";
import {
  AGENDA_DAYS,
  describeEventChange,
  describeEventCreated,
  getCalendarHeaderInfo,
  getPeriodStart,
  getVisibleDays,
  getVisibleRange,
  getWeekViewStepDays,
} from "@/lib/event-utils";
import type {
  CalendarConfig,
  CalendarContextValue,
  CalendarEvent,
  CalendarInfo,
  CalendarProviderProps,
  CalendarRenderSlots,
  EventContentProps,
  HourCycle,
  NewEventRange,
  ViewSettings,
  ViewType,
  VisibleRange,
  WeekStartsOn,
} from "./calendar-types";

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

/** Config used outside a provider, and for every provider prop left unset */
const DEFAULT_CALENDAR_CONFIG: CalendarConfig = {
  snapMinutes: DEFAULT_SNAP_MINUTES,
  dayStartHour: DEFAULT_DAY_START_HOUR,
  dayEndHour: DEFAULT_DAY_END_HOUR,
  hourCycle: DEFAULT_HOUR_CYCLE,
  locale: enUS,
  calendars: NO_CALENDARS,
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
 * Moves `date` by `amount` periods of the given view: days, months, the
 * agenda's `AGENDA_DAYS`, or the week view's step (`numberOfDays` below a
 * week, a week otherwise)
 */
function shiftPeriod(
  date: Date,
  view: ViewType,
  amount: number,
  numberOfDays: number,
): Date {
  if (view === "day") return addDays(date, amount);
  if (view === "month") return addMonths(date, amount);
  if (view === "agenda") return addDays(date, amount * AGENDA_DAYS);
  return addDays(date, amount * getWeekViewStepDays(numberOfDays));
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
): Date {
  const periodEnd = shiftPeriod(date, view, 1, numberOfDays);
  if (now >= date && now < periodEnd) return startOfDay(now);
  return startOfDay(date);
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
    return getPeriodStart(new Date(), view, weekStartsOn, numberOfDays);
  }
  // The app swapped in a view of another type: land like switchView
  if (view === "day") return startOfDay(new Date());
  return getPeriodStart(currentDate, view, weekStartsOn, numberOfDays);
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
 *   (DayView, WeekView, MonthView, AgendaView, or TimeGrid's `view`), so a
 *   lone view just works. `defaultView` only applies until a view mounts.
 * - Controlled `view` always wins: the provider never changes it to match
 *   the mounted view (development builds warn about a mismatch). Render the
 *   view it names, e.g. `<TimeGrid view={view} />`.
 * - A view's `numberOfDays` prop (WeekView, TimeGrid) works the same way
 *   against the provider's `numberOfDays`. Without it the view follows the
 *   provider.
 * - Switches the mounted view doesn't follow (`switchView`, `showDay`,
 *   `setNumberOfDays`, the D/W/M and 2-9 shortcuts while a lone WeekView
 *   stays mounted) are undone, date included. To make switching work,
 *   render the view from `view`, as the demo does with `TimeGrid`.
 * - Without `date` or `defaultDate`, the calendar starts on today's period
 *   of the adopted view: today for DayView and AgendaView, this week for
 *   WeekView.
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
  calendars = NO_CALENDARS,
  createEvent,
  onEventCreate,
  onEventUpdate,
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
    getVisibleDays(currentDate, view, numberOfDays),
  );
  /** ID of a just-created event whose title input should be focused once */
  const [titleFocusEventId, setTitleFocusEventId] = React.useState<
    string | null
  >(null);
  /** Latest move, resize or create, read out by the live region */
  const [announcement, setAnnouncement] = React.useState<Announcement | null>(
    null,
  );
  /** Latest events, so `updateEvent` can compare without depending on them */
  const eventsRef = React.useRef(events);
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

  // Month view shows no day range; consumers sync to `displayMonth` instead
  React.useEffect(() => {
    if (view !== "month") return;
    setVisibleDays([]);
  }, [view]);

  const selectedEvent = React.useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

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

  const updateEvent = React.useCallback(
    (updatedEvent: CalendarEvent) => {
      const previous = eventsRef.current.find((e) => e.id === updatedEvent.id);
      setEvents((prev) =>
        prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
      );
      onEventUpdate?.(updatedEvent);

      // Moves and resizes (drag, keyboard, or the details) are announced;
      // edits that keep the time, like the title, are not
      if (!previous) return;
      const message = describeEventChange(
        previous,
        updatedEvent,
        hourCycle,
        locale,
      );
      if (message) announce(message);
    },
    [setEvents, onEventUpdate, hourCycle, locale, announce],
  );

  const addEventFromRange = React.useCallback(
    (range: NewEventRange) => {
      const newEvent = (createEvent ?? createDefaultEvent)(range);
      if (!newEvent) return;
      setEvents((prev) => [...prev, newEvent]);
      onEventCreate?.(newEvent);
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
    ],
  );

  const goToToday = React.useCallback(() => {
    setCurrentDate(
      getPeriodStart(new Date(), view, weekStartsOn, numberOfDays),
    );
  }, [view, weekStartsOn, numberOfDays, setCurrentDate]);

  const goToPrev = React.useCallback(() => {
    setCurrentDate((prev) => shiftPeriod(prev, view, -1, numberOfDays));
  }, [view, numberOfDays, setCurrentDate]);

  const goToNext = React.useCallback(() => {
    setCurrentDate((prev) => shiftPeriod(prev, view, 1, numberOfDays));
  }, [view, numberOfDays, setCurrentDate]);

  const goToDate = React.useCallback(
    (date: Date) => setCurrentDate(date),
    [setCurrentDate],
  );

  const switchView = React.useCallback(
    (newView: ViewType) => {
      if (newView === view) return;
      pendingSwitchRef.current = { view, numberOfDays, date: currentDate };
      setView(newView);
      if (newView === "day") {
        setCurrentDate(startOfDay(new Date()));
        return;
      }
      if (newView === "agenda") {
        setCurrentDate((prev) =>
          getAgendaStartFrom(prev, view, numberOfDays, new Date()),
        );
        return;
      }
      setCurrentDate((prev) =>
        getPeriodStart(prev, newView, weekStartsOn, numberOfDays),
      );
    },
    [view, currentDate, weekStartsOn, numberOfDays, setView, setCurrentDate],
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
        const next = getPeriodStart(prev, "week", weekStartsOn, count);
        return next.getTime() === prev.getTime() ? prev : next;
      });
    },
    [
      view,
      numberOfDays,
      currentDate,
      weekStartsOn,
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
      setCurrentDate(getPeriodStart(date, "week", weekStartsOn, numberOfDays));
      setHighlightedDate(date);
    },
    [view, currentDate, weekStartsOn, numberOfDays, setView, setCurrentDate],
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
      });
      setView(nextView);
      setNumberOfDays(nextNumberOfDays);
      setCurrentDate(nextDate);
      // Header info reads the visible days: match them to the new date before
      // the first paint (the view reports its own after it). A controlled date
      // may not change, so it waits for the view's report.
      if (dateProp !== undefined) return;
      setVisibleDays(
        nextView === "month"
          ? []
          : getVisibleDays(nextDate, nextView, nextNumberOfDays),
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
      setView,
      setNumberOfDays,
      setCurrentDate,
    ],
  );

  const toggleWeekends = React.useCallback(() => {
    setViewSettings((prev) => ({ ...prev, showWeekends: !prev.showWeekends }));
  }, []);

  const toggleDeclinedEvents = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showDeclinedEvents: !prev.showDeclinedEvents,
    }));
  }, []);

  const toggleWeekNumbers = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showWeekNumbers: !prev.showWeekNumbers,
    }));
  }, []);

  // Week/day views name the month after the LAST visible day, so a week
  // crossing into the next month is labeled with the later month (Notion
  // Calendar's behavior). Month view labels its own month instead, and the
  // agenda the month it starts in.
  const headerDate =
    view === "month"
      ? (displayMonth ?? currentDate)
      : (visibleDays[0] ?? currentDate);
  const headerRangeEnd =
    view === "month" || view === "agenda"
      ? undefined
      : visibleDays[visibleDays.length - 1];
  const { monthName, year, weekNumber } = getCalendarHeaderInfo(
    headerDate,
    weekStartsOn,
    locale,
    headerRangeEnd,
  );

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
    ],
  );

  const closeEventPopover = React.useCallback((eventId: string) => {
    setSelectedEventId((prev) => (prev === eventId ? null : prev));
  }, []);

  const viewSync = React.useMemo<CalendarViewSyncValue>(
    () => ({
      reportView,
      reportVisibleDays: setVisibleDays,
      reportDisplayMonth: setDisplayMonth,
      closeEventPopover,
    }),
    [reportView, closeEventPopover],
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
      calendars,
    }),
    [snapMinutes, dayStartHour, dayEndHour, hourCycle, locale, calendars],
  );

  return (
    <CalendarContext.Provider value={value}>
      <CalendarViewSyncContext.Provider value={viewSync}>
        <CalendarRenderSlotsContext.Provider value={renderSlots}>
          <CalendarConfigContext.Provider value={config}>
            <EventTitleFocusProvider
              pendingEventId={pendingTitleFocusId}
              clearPending={clearTitleFocus}
            >
              {children}
              {/* Announces moves, resizes and creates to screen readers */}
              <div role="status" aria-live="polite" className="sr-only">
                {announcement && (
                  <span key={announcement.id}>{announcement.text}</span>
                )}
              </div>
            </EventTitleFocusProvider>
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
