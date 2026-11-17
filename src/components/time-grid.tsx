"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
} from "date-fns";
import type { Locale } from "date-fns";
import * as React from "react";

import { cn } from "@/lib/utils";
import {
  formatHourLabel,
  formatTimeOfDayLabel,
  getPeriodStart,
  getVisibleDayCount,
  getWeekViewStepDays,
  isMultiDayEvent,
} from "@/lib/event-utils";
import {
  getSecondaryTimeAxisInstant,
  getTimeZoneOffsetDifference,
  getViewerTimeZone,
} from "@/lib/time-zones";
import { getTimeZoneLabel } from "@/lib/timezone-label";
import { expandRecurringEvents } from "@/lib/recurrence";
import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";
import { useEventKeyboard } from "@/hooks/use-event-keyboard";
import { useEventDrag } from "@/hooks/use-event-drag";
import { useEventResize } from "@/hooks/use-event-resize";
import { useAllDayResize } from "@/hooks/use-all-day-resize";
import { useToday } from "@/hooks/use-now";
import { useTimeZoneLabel } from "@/hooks/use-timezone-label";
import type {
  CalendarEvent,
  HourCycle,
  HourSlot,
  NewEventRange,
  TimeGridProps,
  TimeGridView,
  TimeZoneAxisColumn,
  WeekDay,
} from "./week-view-types";
import {
  useCalendar,
  useCalendarConfig,
  useCalendarViewSync,
} from "./calendar-provider";
import { WeekViewAllDayRow } from "./week-view-all-day-row";
import { CalendarDayHeaders } from "./calendar-day-headers";
import { WeekViewGrid } from "./week-view-grid";
import { WeekViewTimeAxis } from "./week-view-time-axis";
import { WeekViewTimeIndicator } from "./week-view-time-indicator";
import {
  CalendarPopoverBoundaryProvider,
  isEventInsideCalendarPopover,
} from "./calendar-popover-context";
import { CalendarLoadingBar } from "./calendar-loading-bar";
import { AddTimeZoneButton, TimeZoneAxisLabel } from "./time-zone-axis-label";

/**
 * Smallest hour height the default size fills the screen with, in pixels.
 * Zooming out (the provider's `hourHeight`) goes below it.
 */
const MIN_HOUR_HEIGHT = 48;

/**
 * Width of one time axis column in pixels (4rem = 64px). Each additional
 * time zone adds a column of the same width.
 */
export const TIME_AXIS_WIDTH = 64;

/** Hour labels of an additional time zone column before they're known (on the server and during hydration) */
const NO_LABELS: string[] = [];

/** One additional column of the time axis, left of the calendar's own */
interface ExtraAxisColumn extends TimeZoneAxisColumn {
  /** The time its zone's clock shows at each hour row, in order */
  hourLabels: string[];
}

/** Buffer days per view mode (each side, for horizontal scroll) */
const BUFFER_DAYS_BY_VIEW: Record<TimeGridView, number> = {
  day: 1,
  week: 7,
};

/** Buffer extension step size per view mode */
const BUFFER_STEP_BY_VIEW: Record<TimeGridView, number> = {
  day: 1,
  week: 7,
};

/** Days the day view moves when a drag or resize is held at its side edge */
const DAY_VIEW_EDGE_NAV_DAYS = 7;

/**
 * Generates an array of WeekDay objects starting from the given date.
 * Note: isToday is added separately from the shared `useToday` clock, so it
 * stays correct across midnight and is never computed on the server
 */
function generateWeekDays(
  startDate: Date,
  count: number,
  locale: Locale,
): Omit<WeekDay, "isToday">[] {
  const end = addDays(startDate, count - 1);

  return eachDayOfInterval({ start: startDate, end }).map((date) => ({
    date,
    dayName: format(date, "EEE", { locale }),
    dayNumber: date.getDate(),
  }));
}

/**
 * Generates an extended array of days including buffer days on both sides
 * for smooth horizontal scroll transitions
 */
function generateBufferedDays(
  startDate: Date,
  bufferDays: number,
  visibleDays: number,
  locale: Locale,
): Omit<WeekDay, "isToday">[] {
  const bufferStart = addDays(startDate, -bufferDays);
  const bufferEnd = addDays(startDate, visibleDays + bufferDays - 1);

  return eachDayOfInterval({ start: bufferStart, end: bufferEnd }).map(
    (date) => ({
      date,
      dayName: format(date, "EEE", { locale }),
      dayNumber: date.getDate(),
    }),
  );
}

/**
 * Generates an HourSlot for each visible hour, from `dayStartHour` up to
 * (not including) `dayEndHour`
 */
function generateHours(
  dayStartHour: number,
  dayEndHour: number,
  hourCycle: HourCycle,
  locale: Locale,
): HourSlot[] {
  return Array.from({ length: dayEndHour - dayStartHour }, (_, i) => {
    const hour = dayStartHour + i;
    return { hour, label: formatHourLabel(hour, hourCycle, locale) };
  });
}

/** Marks the day matching `today` (none while `today` is unknown). */
function withIsToday(
  days: Omit<WeekDay, "isToday">[],
  today: Date | null,
): WeekDay[] {
  return days.map((day) => ({
    ...day,
    isToday: today !== null && isSameDay(day.date, today),
  }));
}

/**
 * Hourly time grid behind DayView and WeekView: day headers, the all-day
 * row, the time axis and the timed-event columns, with horizontal scroll
 * navigation. `view` sets the column count (one day, or `numberOfDays`);
 * date, events and selection come from the surrounding CalendarProvider,
 * which adopts `view` and `numberOfDays` while it doesn't control them.
 *
 * Changing `view` re-lays out the same grid instead of remounting it, so
 * driving it from the provider (`<TimeGrid view={view} />`) keeps the
 * vertical scroll position across day/week switches.
 *
 * With the provider's `secondaryTimeZones` (or `secondaryTimeZone`), the
 * time axis gets a column per zone on its left: that zone's hours on the
 * same lines, its short label above them. While the calendar travels
 * (`travelToTimeZone`), the home zone gets a column too, and the zone
 * travelled to is filled in the primary color. The now line keeps its one
 * badge, in the calendar's column. Each label opens Notion Calendar's time
 * zone menu, and the "+" left of them adds a zone.
 *
 * With the provider's `timeZone`, the hours, today and the now line are
 * that zone's, and the time axis is labeled with it.
 *
 * Renders the same markup on the server and during hydration: everything that
 * depends on the viewer's clock (today, the current-time line, past events)
 * reads the shared `useNow` clock, which is unknown until hydration finishes.
 */
export function TimeGrid({
  view,
  numberOfDays: numberOfDaysProp,
  showEventPopover = true,
  onEventPopoverExpand,
  scrollToHour,
  className,
}: TimeGridProps) {
  const {
    view: providerView,
    currentDate,
    events,
    selectedEvent,
    highlightedDate,
    selectEvent,
    clearSelection,
    addEventFromRange,
    updateEvent,
    goToDate,
    numberOfDays: providerNumberOfDays,
    weekStartsOn,
    hourHeight: zoomedHourHeight,
    loading,
    timeZones,
    travelTimeZone,
  } = useCalendar();
  const {
    snapMinutes,
    dayStartHour,
    dayEndHour,
    hourCycle,
    locale,
    secondaryTimeZones,
    timeZone,
  } = useCalendarConfig();
  const {
    reportView,
    reportVisibleDays,
    closeEventPopover,
    reportPasteTarget,
    reportHourHeight,
  } = useCalendarViewSync();
  const numberOfDays = numberOfDaysProp ?? providerNumberOfDays;
  /** Day columns this grid pins the provider to (none in day view) */
  const fixedNumberOfDays = view === "week" ? numberOfDaysProp : undefined;
  /**
   * Whether the provider navigates by this grid's type and day count. False
   * for the commit before it adopts them (on mount, or right after a switch
   * this grid doesn't follow).
   */
  const isProviderInSync =
    providerView === view &&
    (fixedNumberOfDays === undefined ||
      providerNumberOfDays === fixedNumberOfDays);
  // `null` on the server and during hydration. On the calendar's clock
  const today = useToday(timeZone);
  const selectedEventId = selectedEvent?.id;
  const VISIBLE_DAYS = getVisibleDayCount(view, numberOfDays);
  const visibleHourCount = dayEndHour - dayStartHour;
  /**
   * Zones of the columns left of the calendar's own: the additional ones,
   * then the home zone while travelling (`null`: the viewer's, unknown
   * until hydration)
   */
  const extraZones = React.useMemo(
    () =>
      travelTimeZone
        ? [
            // The zone travelled to has its own column
            ...secondaryTimeZones.filter((zone) => zone !== travelTimeZone),
            timeZones.primary ?? null,
          ]
        : secondaryTimeZones,
    [secondaryTimeZones, travelTimeZone, timeZones.primary],
  );
  /** Width of the time axis: one column per zone */
  const timeAxisWidth = TIME_AXIS_WIDTH * (extraZones.length + 1);
  // A drag held at the grid's side edge moves by one prev/next step
  const edgeNavigationDays =
    view === "day" ? DAY_VIEW_EDGE_NAV_DAYS : getWeekViewStepDays(numberOfDays);
  const BUFFER_DAYS = BUFFER_DAYS_BY_VIEW[view];
  const BUFFER_STEP = BUFFER_STEP_BY_VIEW[view];
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const dayColumnsScrollRef = React.useRef<HTMLDivElement>(null);
  const allDayScrollRef = React.useRef<HTMLDivElement>(null);
  const allDayScrollContentRef = React.useRef<HTMLDivElement>(null);

  // Visible days starting from currentDate
  const baseDays = React.useMemo(
    () => generateWeekDays(currentDate, VISIBLE_DAYS, locale),
    [currentDate, VISIBLE_DAYS, locale],
  );

  const days = withIsToday(baseDays, today);

  const hours = React.useMemo(
    () => generateHours(dayStartHour, dayEndHour, hourCycle, locale),
    [dayStartHour, dayEndHour, hourCycle, locale],
  );

  // Each additional column: its zone's short label, and the time its clock
  // shows at each hour row. Both depend on the hour rows' zone (the
  // calendar's, else the viewer's), so like that zone's own label they stay
  // blank on the server and during hydration (`today` is null until then).
  // The offset is read at noon on today, or on the first day shown when
  // today isn't on screen.
  const extraColumns = React.useMemo<ExtraAxisColumn[]>(() => {
    const kind = (index: number) =>
      travelTimeZone && index === extraZones.length - 1 ? "home" : "secondary";
    if (today === null) {
      return extraZones.map((zone, index) => ({
        timeZone: zone ?? "",
        kind: kind(index),
        label: "",
        hourLabels: NO_LABELS,
      }));
    }
    const viewerTimeZone = getViewerTimeZone();
    const primaryTimeZone = timeZone ?? viewerTimeZone;
    const instant = getSecondaryTimeAxisInstant(
      baseDays.map((day) => day.date),
      today,
      primaryTimeZone,
    );
    return extraZones.map((zone, index) => {
      const columnZone = zone ?? viewerTimeZone;
      const offsetMinutes = getTimeZoneOffsetDifference(
        instant,
        primaryTimeZone,
        columnZone,
      );
      return {
        timeZone: columnZone,
        kind: kind(index),
        label: getTimeZoneLabel(instant, columnZone),
        hourLabels: hours.map((slot) =>
          formatTimeOfDayLabel(
            slot.hour * 60 + offsetMinutes,
            hourCycle,
            locale,
          ),
        ),
      };
    });
  }, [
    extraZones,
    travelTimeZone,
    timeZone,
    today,
    baseDays,
    hours,
    hourCycle,
    locale,
  ]);

  // The stored events, for the drag and resize hooks to commit from
  const allDayEvents = React.useMemo(
    () => events.filter((e) => e.isAllDay || isMultiDayEvent(e)),
    [events],
  );

  const timedEvents = React.useMemo(
    () => events.filter((e) => !e.isAllDay && !isMultiDayEvent(e)),
    [events],
  );

  // Compute day column width and dynamic hour height from container
  const [dayColumnWidth, setDayColumnWidth] = React.useState(0);
  /** Hour height that fills the container: the default size */
  const [fillHourHeight, setFillHourHeight] = React.useState(MIN_HOUR_HEIGHT);
  /** Hour height drawn: the provider's zoomed one, else the default */
  const hourHeight = zoomedHourHeight ?? fillHourHeight;
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const [isAllDayResizing, setIsAllDayResizing] = React.useState(false);
  // Empty on the server and during hydration, the calendar's zone afterwards
  const timeZoneLabel = useTimeZoneLabel(timeZone);
  /** The calendar's own column, next to the days */
  const mainColumn: TimeZoneAxisColumn = {
    // Read only once the label is known, after hydration
    timeZone: timeZoneLabel ? (timeZone ?? getViewerTimeZone()) : "",
    kind: travelTimeZone ? "travel" : "primary",
    label: timeZoneLabel,
  };

  React.useEffect(() => {
    const updateDimensions = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const availableWidth = container.clientWidth - timeAxisWidth;
      setDayColumnWidth(availableWidth / VISIBLE_DAYS);
      setFillHourHeight(
        Math.max(MIN_HOUR_HEIGHT, container.clientHeight / visibleHourCount),
      );
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (scrollContainerRef.current) {
      observer.observe(scrollContainerRef.current);
    }
    return () => observer.disconnect();
  }, [VISIBLE_DAYS, visibleHourCount, timeAxisWidth]);

  /** Whether `scrollToHour` has been applied; it only applies once */
  const hasScrolledToHourRef = React.useRef(false);

  // Scroll to `scrollToHour` before the first paint. A grid mounted hidden
  // (e.g. in an inactive tab) has no height yet, so wait until it has one.
  React.useLayoutEffect(() => {
    if (scrollToHour === undefined || hasScrolledToHourRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const applyScroll = () => {
      if (hasScrolledToHourRef.current || container.clientHeight === 0) return;
      hasScrolledToHourRef.current = true;
      // Same row height the grid settles on (see updateDimensions above)
      const rowHeight =
        zoomedHourHeight ??
        Math.max(MIN_HOUR_HEIGHT, container.clientHeight / visibleHourCount);
      const hour = Math.min(Math.max(scrollToHour, dayStartHour), dayEndHour);
      container.scrollTop = (hour - dayStartHour) * rowHeight;
    };

    applyScroll();
    if (hasScrolledToHourRef.current) return;

    const observer = new ResizeObserver(applyScroll);
    observer.observe(container);
    return () => observer.disconnect();
  }, [
    scrollToHour,
    dayStartHour,
    dayEndHour,
    visibleHourCount,
    zoomedHourHeight,
  ]);

  // Zooming keeps the time in the middle of the screen where it was. Only
  // a zoom: the default height settling on mount or a resize scrolls nothing.
  const lastHourHeightRef = React.useRef(hourHeight);
  const lastZoomedHourHeightRef = React.useRef(zoomedHourHeight);
  React.useLayoutEffect(() => {
    const previous = lastHourHeightRef.current;
    const zoomChanged = lastZoomedHourHeightRef.current !== zoomedHourHeight;
    lastHourHeightRef.current = hourHeight;
    lastZoomedHourHeightRef.current = zoomedHourHeight;
    const container = scrollContainerRef.current;
    if (!zoomChanged || previous === hourHeight || !container) return;
    const middle = container.scrollTop + container.clientHeight / 2;
    container.scrollTop =
      (middle / previous) * hourHeight - container.clientHeight / 2;
  }, [hourHeight, zoomedHourHeight]);

  // The provider zooms from the height on screen while it fills the screen
  React.useEffect(() => {
    reportHourHeight(hourHeight);
  }, [hourHeight, reportHourHeight]);

  // Track whether navigation was initiated by scroll (to avoid double-animation)
  const scrollNavigatedRef = React.useRef(false);
  const prevDateRef = React.useRef(currentDate);
  const wasProviderInSyncRef = React.useRef(isProviderInSync);

  // Tell the provider which view is on screen. `reportView` changes with the
  // provider's state, so this also re-checks after every switch. A layout
  // effect: the provider adopts this grid before the first paint.
  React.useLayoutEffect(() => {
    reportView({ view, numberOfDays: fixedNumberOfDays });
  }, [view, fixedNumberOfDays, reportView]);

  const handleNavigate = React.useCallback(
    (daysDelta: number) => {
      scrollNavigatedRef.current = true;
      goToDate(addDays(currentDate, daysDelta));
    },
    [currentDate, goToDate],
  );

  const handleDragNavigate = React.useCallback(
    (daysDelta: number) => {
      goToDate(addDays(currentDate, daysDelta));
    },
    [currentDate, goToDate],
  );

  const handleEventClick = React.useCallback(
    (event: CalendarEvent) => selectEvent(event.id),
    [selectEvent],
  );

  const visibleDayDates = React.useMemo(() => days.map((d) => d.date), [days]);

  const { resizeState, handleResizePointerDown } = useEventResize({
    hourHeight,
    scrollContainerRef,
    events: timedEvents,
    days: visibleDayDates,
    dayColumnWidth,
    timeAxisWidth,
    snapMinutes,
    dayStartHour,
    dayEndHour,
    edgeNavigationDays,
    onEventChange: updateEvent,
    onEventClick: handleEventClick,
    onResizeNavigate: handleDragNavigate,
  });

  const { dragState, handleEventPointerDown } = useEventDrag({
    hourHeight,
    scrollContainerRef,
    events: timedEvents,
    days: visibleDayDates,
    dayColumnWidth,
    timeAxisWidth,
    snapMinutes,
    dayStartHour,
    dayEndHour,
    edgeNavigationDays,
    onEventChange: updateEvent,
    onEventClick: handleEventClick,
    onDragNavigate: handleDragNavigate,
  });

  const { scrollOffset, slideOffset, isAnimating, triggerSlideAnimation } =
    useHorizontalScroll({
      containerRef: scrollContainerRef,
      dayColumnWidth,
      onNavigate: handleNavigate,
      disabled:
        dragState?.isDragging ||
        resizeState?.isResizing ||
        isAllDayResizing ||
        contextMenuOpen,
    });

  // Compute how many days the scroll has shifted from center
  const scrollDaysDelta =
    dayColumnWidth > 0 ? Math.round(-scrollOffset / dayColumnWidth) : 0;

  // Report visible days to the provider in real-time as scroll crosses day
  // boundaries. Not while it is adopting this grid: it sets them itself, and
  // these would be the days of the date it is moving away from.
  React.useEffect(() => {
    if (!isProviderInSync) return;
    const start = addDays(currentDate, scrollDaysDelta);
    const end = addDays(start, VISIBLE_DAYS - 1);
    reportVisibleDays(eachDayOfInterval({ start, end }));
  }, [
    isProviderInSync,
    currentDate,
    scrollDaysDelta,
    reportVisibleDays,
    VISIBLE_DAYS,
  ]);

  // Dynamic buffer: extends in BUFFER_STEP chunks based on scroll distance
  const extraScrollDays =
    dayColumnWidth > 0 && BUFFER_STEP > 0
      ? Math.ceil(Math.abs(scrollOffset) / dayColumnWidth / BUFFER_STEP) *
        BUFFER_STEP
      : 0;
  const dynamicBuffer = BUFFER_DAYS + extraScrollDays;
  const totalDays = dynamicBuffer + VISIBLE_DAYS + dynamicBuffer;

  // Extended buffered days for scroll (grows dynamically with scroll distance)
  const bufferedBaseDays = React.useMemo(
    () =>
      generateBufferedDays(currentDate, dynamicBuffer, VISIBLE_DAYS, locale),
    [currentDate, dynamicBuffer, VISIBLE_DAYS, locale],
  );

  const bufferedDays = withIsToday(bufferedBaseDays, today);

  const bufferedDayDates = React.useMemo(
    () => bufferedBaseDays.map((d) => d.date),
    [bufferedBaseDays],
  );

  // What the grid draws: repeating events on each of their dates in the
  // buffered days, generated for them and never stored (ADR-007)
  const bufferStartTime = bufferedDayDates[0].getTime();
  const bufferEndTime = addDays(
    bufferedDayDates[bufferedDayDates.length - 1],
    1,
  ).getTime();
  const displayedEvents = React.useMemo(
    () =>
      expandRecurringEvents(
        events,
        { start: new Date(bufferStartTime), end: new Date(bufferEndTime) },
        timeZone,
      ),
    [events, bufferStartTime, bufferEndTime, timeZone],
  );
  const displayedAllDayEvents = React.useMemo(
    () => displayedEvents.filter((e) => e.isAllDay || isMultiDayEvent(e)),
    [displayedEvents],
  );
  const displayedTimedEvents = React.useMemo(
    () => displayedEvents.filter((e) => !e.isAllDay && !isMultiDayEvent(e)),
    [displayedEvents],
  );

  const { allDayResizeState, handleAllDayResizePointerDown } = useAllDayResize({
    days: bufferedDayDates,
    dayColumnWidth,
    allDayContainerRef: allDayScrollContentRef,
    events: allDayEvents,
    onEventChange: updateEvent,
    onEventClick: handleEventClick,
  });

  React.useEffect(() => {
    setIsAllDayResizing(allDayResizeState?.isResizing ?? false);
  }, [allDayResizeState?.isResizing]);

  // Trigger slide animation when currentDate changes externally (not from scroll)
  React.useEffect(() => {
    const wasProviderInSync = wasProviderInSyncRef.current;
    wasProviderInSyncRef.current = isProviderInSync;

    if (scrollNavigatedRef.current) {
      scrollNavigatedRef.current = false;
      prevDateRef.current = currentDate;
      return;
    }

    const prevDate = prevDateRef.current;
    const daysDiff = differenceInCalendarDays(currentDate, prevDate);
    prevDateRef.current = currentDate;

    if (daysDiff === 0) return;
    // Dates set while the provider adopts this grid (its starting date, or an
    // undone switch) are not navigation
    if (!wasProviderInSync || !isProviderInSync) return;

    triggerSlideAnimation(daysDiff);
  }, [currentDate, isProviderInSync, triggerSlideAnimation]);

  // The base translateX centers on the visible days (skip dynamicBuffer columns)
  const baseTranslateX = -(dynamicBuffer * dayColumnWidth);
  const transformX = baseTranslateX + scrollOffset + slideOffset;

  const scrollStyle: React.CSSProperties = {
    width: `${(totalDays / VISIBLE_DAYS) * 100}%`,
    transform: `translateX(${transformX}px)`,
    transition: isAnimating ? `transform ${200}ms ease-out` : "none",
  };

  // Ref for the popover collision boundary (constrains popovers within the calendar area)
  const calendarBoundaryRef = React.useRef<HTMLDivElement>(null);
  // Ref for the header (weekday columns + all-day row) to measure its height for popover top inset
  const calendarHeaderRef = React.useRef<HTMLDivElement>(null);

  const isDayVisible = React.useCallback(
    (date: Date) => visibleDayDates.some((day) => isSameDay(day, date)),
    [visibleDayDates],
  );

  const revealDay = React.useCallback(
    (date: Date) =>
      goToDate(getPeriodStart(date, view, weekStartsOn, numberOfDays)),
    [goToDate, view, weekStartsOn, numberOfDays],
  );

  /** The slot under the mouse: where the next paste goes */
  const handleSlotHover = React.useCallback(
    (range: NewEventRange) =>
      reportPasteTarget({ date: range.start, hasTime: true }),
    [reportPasteTarget],
  );

  const handleEventKeyDown = useEventKeyboard({
    containerRef: calendarBoundaryRef,
    scrollContainerRef,
    isDayVisible,
    revealDay,
  });

  return (
    <CalendarPopoverBoundaryProvider
      boundaryRef={calendarBoundaryRef}
      headerRef={calendarHeaderRef}
      view={view}
    >
      <div
        ref={calendarBoundaryRef}
        className={cn("flex h-full flex-col", className)}
        aria-busy={loading || undefined}
        onKeyDown={handleEventKeyDown}
        onClick={(e) => {
          if (isEventInsideCalendarPopover(e)) return;
          clearSelection();
        }}
      >
        {/* Header - day columns and all-day row with synchronized scroll */}
        <div className="relative flex-shrink-0">
          <div
            ref={(el) => {
              (
                dayColumnsScrollRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
              (
                calendarHeaderRef as React.MutableRefObject<HTMLDivElement | null>
              ).current = el;
            }}
            className="overflow-hidden"
          >
            <div className="flex bg-background">
              {/* Time zone labels, one per time axis column - rendered outside scroll container */}
              {[...extraColumns, mainColumn].map((column, index) => (
                <TimeZoneAxisLabel
                  key={`${column.kind}-${index}`}
                  column={column}
                  hasOtherZones={extraColumns.length > 0}
                />
              ))}
              <div className="min-w-0 flex-1 overflow-clip">
                <div style={scrollStyle}>
                  <CalendarDayHeaders
                    days={bufferedDays}
                    standalone
                    highlightedDate={highlightedDate}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden" ref={allDayScrollRef}>
            {/* Adds a time zone, left of the "All-day" label */}
            <AddTimeZoneButton />
            <WeekViewAllDayRow
              days={bufferedDays}
              allDayEvents={displayedAllDayEvents}
              onEventClick={handleEventClick}
              selectedEventId={selectedEventId}
              scrollStyle={scrollStyle}
              allDayResizeState={allDayResizeState ?? undefined}
              onAllDayResizePointerDown={handleAllDayResizePointerDown}
              onEventChange={updateEvent}
              onContextMenuOpenChange={setContextMenuOpen}
              allDayScrollContentRef={allDayScrollContentRef}
              showEventPopover={showEventPopover}
              onEventPopoverExpand={onEventPopoverExpand}
              onEventPopoverClose={closeEventPopover}
              visibleStartIndex={dynamicBuffer}
              visibleCount={VISIBLE_DAYS}
              dayColumnWidth={dayColumnWidth}
              highlightedDate={highlightedDate}
              timeAxisWidth={timeAxisWidth}
            />
          </div>
          {/* Under the day columns, along the header's bottom border */}
          {loading && (
            <div
              className="absolute right-0 bottom-0"
              style={{ left: timeAxisWidth }}
            >
              <CalendarLoadingBar />
            </div>
          )}
        </div>

        {/* Scrollable grid area \u2014 also serves as the collision boundary for popovers */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto scrollbar-hide"
        >
          <div
            className="relative flex"
            style={{ height: hours.length * hourHeight }}
          >
            {extraColumns.map((column, index) => (
              <WeekViewTimeAxis
                key={`${column.kind}-${index}`}
                hours={hours}
                hourHeight={hourHeight}
                labels={column.hourLabels}
              />
            ))}
            <WeekViewTimeAxis
              hours={hours}
              hourHeight={hourHeight}
              highlighted={travelTimeZone !== null}
            />
            {/* Buffer wrappers clip rather than hide: a hidden box can still be
                scrolled by script or the browser (e.g. scrollIntoView before
                an automated click), which would slide the grid out of line
                with the day headers. The buffer only moves by scrollStyle. */}
            <div className="relative min-w-0 flex-1 overflow-clip">
              <div style={scrollStyle}>
                <WeekViewGrid
                  days={bufferedDays}
                  hours={hours}
                  hourHeight={hourHeight}
                  events={displayedTimedEvents}
                  onEventClick={handleEventClick}
                  selectedEventId={selectedEventId}
                  onEventCreate={addEventFromRange}
                  onSlotHover={handleSlotHover}
                  dragState={dragState ?? undefined}
                  onEventDragPointerDown={handleEventPointerDown}
                  resizeState={resizeState ?? undefined}
                  onEventResizePointerDown={handleResizePointerDown}
                  onEventChange={updateEvent}
                  onContextMenuOpenChange={setContextMenuOpen}
                  showEventPopover={showEventPopover}
                  onEventPopoverExpand={onEventPopoverExpand}
                  onEventPopoverClose={closeEventPopover}
                  highlightedDate={highlightedDate}
                  visibleStartIndex={dynamicBuffer}
                  visibleCount={VISIBLE_DAYS}
                />
              </div>
            </div>
            <WeekViewTimeIndicator
              days={days}
              hourHeight={hourHeight}
              scrollDays={bufferedDays}
              scrollStyle={scrollStyle}
              behindSelection={!!selectedEventId}
              timeAxisWidth={timeAxisWidth}
            />
          </div>
        </div>
      </div>
    </CalendarPopoverBoundaryProvider>
  );
}
