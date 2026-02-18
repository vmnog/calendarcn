"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  getWeek,
  isToday,
} from "date-fns";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";
import type { HourSlot, WeekDay, WeekViewProps } from "./week-view-types";
import { WeekViewAllDayRow } from "./week-view-all-day-row";
import { WeekViewDayColumns } from "./week-view-day-columns";
import { WeekViewGrid } from "./week-view-grid";
import { WeekViewTimeAxis } from "./week-view-time-axis";
import { WeekViewTimeIndicator } from "./week-view-time-indicator";

/** Minimum height of each hour row in pixels */
const MIN_HOUR_HEIGHT = 48;

/** Width of the time axis column in pixels (4rem = 64px) */
export const TIME_AXIS_WIDTH = 64;

/** Number of visible days in the week view */
const VISIBLE_DAYS = 7;

/** Number of buffer days on each side for scroll */
const BUFFER_DAYS = 7;

/** Buffer extension step size (extend in chunks to reduce re-renders) */
const BUFFER_STEP = 7;

/**
 * Generates an array of WeekDay objects starting from the given date.
 * Note: isToday is computed dynamically, not cached, to handle overnight page views
 */
function generateWeekDays(
  startDate: Date
): Omit<WeekDay, "isToday">[] {
  const end = addDays(startDate, VISIBLE_DAYS - 1);

  return eachDayOfInterval({ start: startDate, end }).map((date) => ({
    date,
    dayName: format(date, "EEE"),
    dayNumber: date.getDate(),
  }));
}

/**
 * Generates an extended array of days including buffer days on both sides
 * for smooth horizontal scroll transitions
 */
function generateBufferedDays(
  startDate: Date,
  bufferDays: number
): Omit<WeekDay, "isToday">[] {
  const bufferStart = addDays(startDate, -bufferDays);
  const bufferEnd = addDays(startDate, VISIBLE_DAYS + bufferDays - 1);

  return eachDayOfInterval({ start: bufferStart, end: bufferEnd }).map(
    (date) => ({
      date,
      dayName: format(date, "EEE"),
      dayNumber: date.getDate(),
    })
  );
}

/**
 * Generates an array of HourSlot objects for all 24 hours
 */
function generateHours(): HourSlot[] {
  return Array.from({ length: 24 }, (_, i) => {
    const dateWithHour = new Date();
    dateWithHour.setHours(i, 0, 0, 0);
    return {
      hour: i,
      label: format(dateWithHour, "h a"),
    };
  });
}

/**
 * Returns the month name, year, and week number for the current date
 */
export function getCalendarHeaderInfo(
  currentDate: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
) {
  return {
    monthName: format(currentDate, "MMMM"),
    year: format(currentDate, "yyyy"),
    weekNumber: getWeek(currentDate, { weekStartsOn }),
  };
}

/**
 * Returns the visible days starting from the given date (used for sidebar highlighting)
 */
export function getVisibleDays(currentDate: Date): Date[] {
  const end = addDays(currentDate, VISIBLE_DAYS - 1);
  return eachDayOfInterval({ start: currentDate, end });
}

/**
 * Main Week View calendar component
 * Displays a week grid with time slots and supports horizontal scroll navigation
 */
export function WeekView({
  currentDate = new Date(),
  events = [],
  onEventClick,
  onDateChange,
  onVisibleDaysChange,
  className,
}: WeekViewProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const dayColumnsScrollRef = React.useRef<HTMLDivElement>(null);
  const allDayScrollRef = React.useRef<HTMLDivElement>(null);

  // Visible days (7 days starting from currentDate)
  const baseDays = React.useMemo(
    () => generateWeekDays(currentDate),
    [currentDate]
  );

  const days: WeekDay[] = baseDays.map((day) => ({
    ...day,
    isToday: isToday(day.date),
  }));

  const hours = React.useMemo(() => generateHours(), []);

  const allDayEvents = React.useMemo(
    () => events.filter((e) => e.isAllDay),
    [events]
  );

  const timedEvents = React.useMemo(
    () => events.filter((e) => !e.isAllDay),
    [events]
  );

  // Compute day column width and dynamic hour height from container
  const [dayColumnWidth, setDayColumnWidth] = React.useState(0);
  const [hourHeight, setHourHeight] = React.useState(MIN_HOUR_HEIGHT);

  React.useEffect(() => {
    const updateDimensions = () => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const availableWidth = container.clientWidth - TIME_AXIS_WIDTH;
      setDayColumnWidth(availableWidth / VISIBLE_DAYS);
      setHourHeight(Math.max(MIN_HOUR_HEIGHT, container.clientHeight / 24));
    };

    updateDimensions();

    const observer = new ResizeObserver(updateDimensions);
    if (scrollContainerRef.current) {
      observer.observe(scrollContainerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Track whether navigation was initiated by scroll (to avoid double-animation)
  const scrollNavigatedRef = React.useRef(false);
  const prevDateRef = React.useRef(currentDate);

  const handleNavigate = React.useCallback(
    (daysDelta: number) => {
      scrollNavigatedRef.current = true;
      onDateChange?.(addDays(currentDate, daysDelta));
    },
    [currentDate, onDateChange]
  );

  const { scrollOffset, slideOffset, isAnimating, triggerSlideAnimation } =
    useHorizontalScroll({
      containerRef: scrollContainerRef,
      dayColumnWidth,
      onNavigate: handleNavigate,
    });

  // Compute how many days the scroll has shifted from center
  const scrollDaysDelta = dayColumnWidth > 0
    ? Math.round(-scrollOffset / dayColumnWidth)
    : 0;

  // Report visible days to parent in real-time as scroll crosses day boundaries
  React.useEffect(() => {
    const start = addDays(currentDate, scrollDaysDelta);
    const end = addDays(start, VISIBLE_DAYS - 1);
    onVisibleDaysChange?.(eachDayOfInterval({ start, end }));
  }, [currentDate, scrollDaysDelta, onVisibleDaysChange]);

  // Dynamic buffer: extends in BUFFER_STEP chunks based on scroll distance
  const extraScrollDays = dayColumnWidth > 0
    ? Math.ceil(Math.abs(scrollOffset) / dayColumnWidth / BUFFER_STEP) * BUFFER_STEP
    : 0;
  const dynamicBuffer = BUFFER_DAYS + extraScrollDays;
  const totalDays = dynamicBuffer + VISIBLE_DAYS + dynamicBuffer;

  // Extended buffered days for scroll (grows dynamically with scroll distance)
  const bufferedBaseDays = React.useMemo(
    () => generateBufferedDays(currentDate, dynamicBuffer),
    [currentDate, dynamicBuffer]
  );

  const bufferedDays: WeekDay[] = bufferedBaseDays.map((day) => ({
    ...day,
    isToday: isToday(day.date),
  }));

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

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header - day columns and all-day row with synchronized scroll */}
      <div className="flex-shrink-0">
        <div className="overflow-hidden" ref={dayColumnsScrollRef}>
          <div className="flex bg-background">
            {/* Timezone label - rendered outside scroll container */}
            <div className="text-muted-foreground flex w-16 flex-shrink-0 items-center justify-end pr-2 text-xxs">
              {new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).match(/\s([A-Z]{2,5})$/)?.[1] ?? ""}
            </div>
            <div className="flex-1 overflow-hidden">
              <div style={scrollStyle}>
                <WeekViewDayColumns days={bufferedDays} standalone />
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden" ref={allDayScrollRef}>
          <WeekViewAllDayRow
            days={bufferedDays}
            allDayEvents={allDayEvents}
            scrollStyle={scrollStyle}
          />
        </div>
      </div>

      {/* Scrollable grid area */}
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
                onEventClick={onEventClick}
              />
            </div>
          </div>
          <WeekViewTimeIndicator
            days={days}
            hourHeight={hourHeight}
            scrollDays={bufferedDays}
            scrollStyle={scrollStyle}
          />
        </div>
      </div>
    </div>
  );
}
