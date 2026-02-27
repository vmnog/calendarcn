"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isToday,
} from "date-fns";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";
import { useEventDrag } from "@/hooks/use-event-drag";
import type { HourSlot, WeekDay, CalendarEvent } from "./week-view-types";
import { WeekViewAllDayRow } from "./week-view-all-day-row";
import { WeekViewDayColumns } from "./week-view-day-columns";
import { WeekViewGrid } from "./week-view-grid";
import { WeekViewTimeAxis } from "./week-view-time-axis";
import { WeekViewTimeIndicator } from "./week-view-time-indicator";

const MIN_HOUR_HEIGHT = 48;
export const TIME_AXIS_WIDTH = 64;
const VISIBLE_DAYS = 1;
const BUFFER_DAYS = 3;
const BUFFER_STEP = 3;

export interface DayViewProps {
  currentDate?: Date;
  events?: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  onBackgroundClick?: () => void;
  onDateChange?: (date: Date) => void;
  onVisibleDaysChange?: (days: Date[]) => void;
  onEventChange?: (event: CalendarEvent) => void;
  dirtyEventIds?: Set<string>;
  className?: string;
}

function generateDayArray(date: Date): Omit<WeekDay, "isToday">[] {
  return [
    {
      date,
      dayName: format(date, "EEE"),
      dayNumber: date.getDate(),
    },
  ];
}

function generateBufferedDays(
  startDate: Date,
  bufferDays: number
): Omit<WeekDay, "isToday">[] {
  const bufferStart = addDays(startDate, -bufferDays);
  const bufferEnd = addDays(startDate, bufferDays);

  return eachDayOfInterval({ start: bufferStart, end: bufferEnd }).map(
    (date) => ({
      date,
      dayName: format(date, "EEE"),
      dayNumber: date.getDate(),
    })
  );
}

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

export function getDayHeaderInfo(currentDate: Date) {
  return {
    dayName: format(currentDate, "EEEE"),
    monthName: format(currentDate, "MMMM"),
    dayNumber: format(currentDate, "d"),
    year: format(currentDate, "yyyy"),
  };
}

export function DayView({
  currentDate = new Date(),
  events = [],
  onEventClick,
  selectedEventId,
  onBackgroundClick,
  onDateChange,
  onVisibleDaysChange,
  onEventChange,
  dirtyEventIds,
  className,
}: DayViewProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const dayColumnsScrollRef = React.useRef<HTMLDivElement>(null);
  const allDayScrollRef = React.useRef<HTMLDivElement>(null);

  const baseDays = React.useMemo(
    () => generateDayArray(currentDate),
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

  const scrollNavigatedRef = React.useRef(false);
  const prevDateRef = React.useRef(currentDate);

  const handleNavigate = React.useCallback(
    (daysDelta: number) => {
      scrollNavigatedRef.current = true;
      onDateChange?.(addDays(currentDate, daysDelta));
    },
    [currentDate, onDateChange]
  );

  const handleDragNavigate = React.useCallback(
    (daysDelta: number) => {
      onDateChange?.(addDays(currentDate, daysDelta));
    },
    [currentDate, onDateChange],
  );

  const visibleDayDates = React.useMemo(
    () => days.map((d) => d.date),
    [days],
  );

  const { dragState, handleEventMouseDown } = useEventDrag({
    hourHeight,
    scrollContainerRef,
    events: timedEvents,
    days: visibleDayDates,
    dayColumnWidth,
    timeAxisWidth: TIME_AXIS_WIDTH,
    onEventChange,
    onEventClick,
    onDragNavigate: handleDragNavigate,
  });

  const { scrollOffset, slideOffset, isAnimating, triggerSlideAnimation } =
    useHorizontalScroll({
      containerRef: scrollContainerRef,
      dayColumnWidth,
      onNavigate: handleNavigate,
      disabled: dragState?.isDragging,
    });

  const scrollDaysDelta = dayColumnWidth > 0
    ? Math.round(-scrollOffset / dayColumnWidth)
    : 0;

  React.useEffect(() => {
    const start = addDays(currentDate, scrollDaysDelta);
    onVisibleDaysChange?.([start]);
  }, [currentDate, scrollDaysDelta, onVisibleDaysChange]);

  const extraScrollDays = dayColumnWidth > 0
    ? Math.ceil(Math.abs(scrollOffset) / dayColumnWidth / BUFFER_STEP) * BUFFER_STEP
    : 0;
  const dynamicBuffer = BUFFER_DAYS + extraScrollDays;
  const totalDays = dynamicBuffer + VISIBLE_DAYS + dynamicBuffer;

  const bufferedBaseDays = React.useMemo(
    () => generateBufferedDays(currentDate, dynamicBuffer),
    [currentDate, dynamicBuffer]
  );

  const bufferedDays: WeekDay[] = bufferedBaseDays.map((day) => ({
    ...day,
    isToday: isToday(day.date),
  }));

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

  const baseTranslateX = -(dynamicBuffer * dayColumnWidth);
  const transformX = baseTranslateX + scrollOffset + slideOffset;

  const scrollStyle: React.CSSProperties = {
    width: `${(totalDays / VISIBLE_DAYS) * 100}%`,
    transform: `translateX(${transformX}px)`,
    transition: isAnimating ? "transform 200ms ease-out" : "none",
  };

  return (
    <div className={cn("flex h-full flex-col", className)} onClick={onBackgroundClick}>
      <div className="shrink-0">
        <div className="overflow-hidden" ref={dayColumnsScrollRef}>
          <div className="flex bg-background">
            <div className="text-muted-foreground flex w-16 shrink-0 items-center justify-end pr-2 text-xxs">
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
            onEventClick={onEventClick}
            selectedEventId={selectedEventId}
            scrollStyle={scrollStyle}
          />
        </div>
      </div>

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
                selectedEventId={selectedEventId}
                dragState={dragState ?? undefined}
                onEventDragMouseDown={handleEventMouseDown}
                onEventChange={onEventChange}
                dirtyEventIds={dirtyEventIds}
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
  );
}
