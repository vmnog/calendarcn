"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isToday,
} from "date-fns";
import * as React from "react";

import { useHorizontalScroll } from "@/hooks/use-horizontal-scroll";
import { useEventDrag } from "@/hooks/use-event-drag";
import type { CalendarEvent, HourSlot, WeekDay } from "@/components/week-view-types";

const MIN_HOUR_HEIGHT = 48;
export const TIME_AXIS_WIDTH = 64;

interface UseCalendarViewOptions {
  visibleDaysCount: number;
  bufferDays: number;
  bufferStep: number;
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  onDateChange?: (date: Date) => void;
  onVisibleDaysChange?: (days: Date[]) => void;
  onEventChange?: (event: CalendarEvent) => void;
}

function generateDays(
  startDate: Date,
  count: number
): Omit<WeekDay, "isToday">[] {
  const end = addDays(startDate, count - 1);
  return eachDayOfInterval({ start: startDate, end }).map((date) => ({
    date,
    dayName: format(date, "EEE"),
    dayNumber: date.getDate(),
  }));
}

function generateBufferedDays(
  startDate: Date,
  visibleDaysCount: number,
  bufferDays: number
): Omit<WeekDay, "isToday">[] {
  const bufferStart = addDays(startDate, -bufferDays);
  const bufferEnd = addDays(startDate, visibleDaysCount + bufferDays - 1);
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
    const d = new Date();
    d.setHours(i, 0, 0, 0);
    return { hour: i, label: format(d, "h a") };
  });
}

function withIsToday(baseDays: Omit<WeekDay, "isToday">[]): WeekDay[] {
  return baseDays.map((day) => ({ ...day, isToday: isToday(day.date) }));
}

export function useCalendarView({
  visibleDaysCount,
  bufferDays: baseBufDays,
  bufferStep,
  currentDate,
  events,
  onEventClick,
  onDateChange,
  onVisibleDaysChange,
  onEventChange,
}: UseCalendarViewOptions) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const baseDays = React.useMemo(
    () => generateDays(currentDate, visibleDaysCount),
    [currentDate, visibleDaysCount]
  );
  const days = withIsToday(baseDays);
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
      setDayColumnWidth(availableWidth / visibleDaysCount);
      setHourHeight(Math.max(MIN_HOUR_HEIGHT, container.clientHeight / 24));
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (scrollContainerRef.current) observer.observe(scrollContainerRef.current);
    return () => observer.disconnect();
  }, [visibleDaysCount]);

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
    [currentDate, onDateChange]
  );

  const visibleDayDates = React.useMemo(() => days.map((d) => d.date), [days]);

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

  const scrollDaysDelta =
    dayColumnWidth > 0 ? Math.round(-scrollOffset / dayColumnWidth) : 0;

  React.useEffect(() => {
    const start = addDays(currentDate, scrollDaysDelta);
    const end = addDays(start, visibleDaysCount - 1);
    onVisibleDaysChange?.(eachDayOfInterval({ start, end }));
  }, [currentDate, scrollDaysDelta, visibleDaysCount, onVisibleDaysChange]);

  const extraScrollDays =
    dayColumnWidth > 0
      ? Math.ceil(Math.abs(scrollOffset) / dayColumnWidth / bufferStep) * bufferStep
      : 0;
  const dynamicBuffer = baseBufDays + extraScrollDays;
  const totalDays = dynamicBuffer + visibleDaysCount + dynamicBuffer;

  const bufferedBaseDays = React.useMemo(
    () => generateBufferedDays(currentDate, visibleDaysCount, dynamicBuffer),
    [currentDate, visibleDaysCount, dynamicBuffer]
  );
  const bufferedDays = withIsToday(bufferedBaseDays);

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
    width: `${(totalDays / visibleDaysCount) * 100}%`,
    transform: `translateX(${transformX}px)`,
    transition: isAnimating ? "transform 200ms ease-out" : "none",
  };

  return {
    scrollContainerRef,
    days,
    bufferedDays,
    hours,
    hourHeight,
    allDayEvents,
    timedEvents,
    dragState,
    handleEventMouseDown,
    scrollStyle,
    selectedEventId: undefined as string | undefined,
  };
}
