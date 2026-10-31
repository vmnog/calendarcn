"use client";

import * as React from "react";
import { addDays, addMonths, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";

import { useControllableState } from "@/hooks/use-controllable-state";
import { useToday } from "@/hooks/use-now";
import { EventTitleFocusProvider } from "./event-title-focus-context";
import {
  describeEventChange,
  describeEventCreated,
  getCalendarHeaderInfo,
  getPeriodStart,
  getVisibleDays,
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

/**
 * Setters the views use to report what they currently show. Kept out of
 * `useCalendar()` because only the views write these values.
 */
interface CalendarViewSyncValue {
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
 * Moves `date` by `amount` periods of the given view: days, months, or the
 * week view's step (`numberOfDays` below a week, a week otherwise)
 */
function shiftPeriod(
  date: Date,
  view: ViewType,
  amount: number,
  numberOfDays: number,
): Date {
  if (view === "day") return addDays(date, amount);
  if (view === "month") return addMonths(date, amount);
  return addDays(date, amount * getWeekViewStepDays(numberOfDays));
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

  React.useEffect(() => {
    eventsRef.current = events;
  }, [events]);

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
      setView(newView);
      if (newView === "day") {
        setCurrentDate(startOfDay(new Date()));
        return;
      }
      setCurrentDate((prev) =>
        getPeriodStart(prev, newView, weekStartsOn, numberOfDays),
      );
    },
    [view, weekStartsOn, numberOfDays, setView, setCurrentDate],
  );

  const changeNumberOfDays = React.useCallback(
    (count: number) => {
      setNumberOfDays(count);
      if (view !== "week") return;
      // Going back to a full week starts on the week's first day again
      setCurrentDate((prev) => {
        const next = getPeriodStart(prev, "week", weekStartsOn, count);
        return next.getTime() === prev.getTime() ? prev : next;
      });
    },
    [view, weekStartsOn, setNumberOfDays, setCurrentDate],
  );

  const showDay = React.useCallback(
    (date: Date) => {
      setView("week");
      setCurrentDate(getPeriodStart(date, "week", weekStartsOn, numberOfDays));
      setHighlightedDate(date);
    },
    [weekStartsOn, numberOfDays, setView, setCurrentDate],
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
  // Calendar's behavior). Month view labels its own month instead.
  const headerDate =
    view === "month"
      ? (displayMonth ?? currentDate)
      : (visibleDays[0] ?? currentDate);
  const headerRangeEnd =
    view === "month" ? undefined : visibleDays[visibleDays.length - 1];
  const { monthName, year, weekNumber } = getCalendarHeaderInfo(
    headerDate,
    weekStartsOn,
    locale,
    headerRangeEnd,
  );

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
      reportVisibleDays: setVisibleDays,
      reportDisplayMonth: setDisplayMonth,
      closeEventPopover,
    }),
    [closeEventPopover],
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
