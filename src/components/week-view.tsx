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
  getPeriodStart,
  getVisibleDayCount,
  getWeekViewStepDays,
  isMultiDayEvent,
} from "@/lib/event-utils";
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
  ViewType,
  WeekDay,
  WeekViewProps,
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
import { CalendarPopoverBoundaryProvider } from "./calendar-popover-context";

/** Minimum height of each hour row in pixels */
const MIN_HOUR_HEIGHT = 48;

/** Width of the time axis column in pixels (4rem = 64px) */
export const TIME_AXIS_WIDTH = 64;

/** Buffer days per view mode (each side, for horizontal scroll) */
const BUFFER_DAYS_BY_VIEW: Record<ViewType, number> = {
  day: 1,
  week: 7,
  month: 7,
};

/** Buffer extension step size per view mode */
const BUFFER_STEP_BY_VIEW: Record<ViewType, number> = {
  day: 1,
  week: 7,
  month: 7,
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
 * Main Week View calendar component (day and week views)
 * Displays a week grid with time slots and supports horizontal scroll navigation.
 * View, date, events and selection come from the surrounding CalendarProvider.
 *
 * Renders the same markup on the server and during hydration: everything that
 * depends on the viewer's clock (today, the current-time line, past events)
 * reads the shared `useNow` clock, which is unknown until hydration finishes.
 */
export function WeekView({
  showEventPopover = true,
  onEventPopoverExpand,
  className,
}: WeekViewProps) {
  const {
    view,
    currentDate,
    events,
    selectedEvent,
    highlightedDate,
    selectEvent,
    clearSelection,
    addEventFromRange,
    updateEvent,
    goToDate,
    goToPrev,
    goToNext,
    numberOfDays,
    weekStartsOn,
  } = useCalendar();
  const { snapMinutes, dayStartHour, dayEndHour, hourCycle, locale } =
    useCalendarConfig();
  const { reportVisibleDays, closeEventPopover } = useCalendarViewSync();
  // `null` on the server and during hydration
  const today = useToday();
  const selectedEventId = selectedEvent?.id;
  const VISIBLE_DAYS = getVisibleDayCount(view, numberOfDays);
  const visibleHourCount = dayEndHour - dayStartHour;
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
  const [hourHeight, setHourHeight] = React.useState(MIN_HOUR_HEIGHT);
  const [contextMenuOpen, setContextMenuOpen] = React.useState(false);
  const [isAllDayResizing, setIsAllDayResizing] = React.useState(false);
  // Empty on the server and during hydration, the viewer's zone afterwards
  const timeZoneLabel = useTimeZoneLabel();

  React.useEffect(() => {
    const updateDimensions = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const availableWidth = container.clientWidth - TIME_AXIS_WIDTH;
      setDayColumnWidth(availableWidth / VISIBLE_DAYS);
      setHourHeight(
        Math.max(MIN_HOUR_HEIGHT, container.clientHeight / visibleHourCount),
      );
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (scrollContainerRef.current) {
      observer.observe(scrollContainerRef.current);
    }
    return () => observer.disconnect();
  }, [VISIBLE_DAYS, visibleHourCount]);

  // Track whether navigation was initiated by scroll (to avoid double-animation)
  const scrollNavigatedRef = React.useRef(false);
  const prevDateRef = React.useRef(currentDate);

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
    timeAxisWidth: TIME_AXIS_WIDTH,
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
    timeAxisWidth: TIME_AXIS_WIDTH,
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

  // Report visible days to the provider in real-time as scroll crosses day boundaries
  React.useEffect(() => {
    const start = addDays(currentDate, scrollDaysDelta);
    const end = addDays(start, VISIBLE_DAYS - 1);
    reportVisibleDays(eachDayOfInterval({ start, end }));
  }, [currentDate, scrollDaysDelta, reportVisibleDays, VISIBLE_DAYS]);

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
    if (scrollNavigatedRef.current) {
      scrollNavigatedRef.current = false;
      prevDateRef.current = currentDate;
      return;
    }

    const prevDate = prevDateRef.current;
    const daysDiff = differenceInCalendarDays(currentDate, prevDate);
    prevDateRef.current = currentDate;

    if (daysDiff === 0) return;

    triggerSlideAnimation(daysDiff);
  }, [currentDate, triggerSlideAnimation]);

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
        onKeyDown={handleEventKeyDown}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-radix-popper-content-wrapper]")) return;
          clearSelection();
        }}
      >
        {/* Header - day columns and all-day row with synchronized scroll */}
        <div className="flex-shrink-0">
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
              {/* Timezone label - rendered outside scroll container */}
              <div className="text-muted-foreground flex w-16 flex-shrink-0 items-center justify-end pr-2 text-xxs">
                {timeZoneLabel}
              </div>
              <div className="flex-1 overflow-hidden">
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
          <div className="overflow-hidden" ref={allDayScrollRef}>
            <WeekViewAllDayRow
              days={bufferedDays}
              allDayEvents={allDayEvents}
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
              onPrevWeek={goToPrev}
              onNextWeek={goToNext}
              visibleStartIndex={dynamicBuffer}
              visibleCount={VISIBLE_DAYS}
              dayColumnWidth={dayColumnWidth}
              highlightedDate={highlightedDate}
            />
          </div>
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
            <WeekViewTimeAxis hours={hours} hourHeight={hourHeight} />
            <div className="relative flex-1 overflow-hidden">
              <div style={scrollStyle}>
                <WeekViewGrid
                  days={bufferedDays}
                  hours={hours}
                  hourHeight={hourHeight}
                  events={timedEvents}
                  onEventClick={handleEventClick}
                  selectedEventId={selectedEventId}
                  onEventCreate={addEventFromRange}
                  dragState={dragState ?? undefined}
                  onEventDragPointerDown={handleEventPointerDown}
                  resizeState={resizeState ?? undefined}
                  onEventResizePointerDown={handleResizePointerDown}
                  onEventChange={updateEvent}
                  onContextMenuOpenChange={setContextMenuOpen}
                  showEventPopover={showEventPopover}
                  onEventPopoverExpand={onEventPopoverExpand}
                  onEventPopoverClose={closeEventPopover}
                  onPrevWeek={goToPrev}
                  onNextWeek={goToNext}
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
            />
          </div>
        </div>
      </div>
    </CalendarPopoverBoundaryProvider>
  );
}
