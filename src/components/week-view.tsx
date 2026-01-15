"use client";

import {
  eachDayOfInterval,
  endOfWeek,
  format,
  getWeek,
  isToday,
  startOfWeek,
} from "date-fns";
import * as React from "react";

import { cn } from "@/lib/utils";
import type { HourSlot, WeekDay, WeekViewProps } from "./week-view-types";
import { WeekViewAllDayRow } from "./week-view-all-day-row";
import { WeekViewDayColumns } from "./week-view-day-columns";
import { WeekViewGrid } from "./week-view-grid";
import { WeekViewTimeAxis } from "./week-view-time-axis";
import { WeekViewTimeIndicator } from "./week-view-time-indicator";

/** Height of each hour row in pixels */
export const HOUR_HEIGHT = 48;

/** Width of the time axis column in pixels (4rem = 64px) */
export const TIME_AXIS_WIDTH = 64;

/**
 * Generates an array of WeekDay objects for the week containing the given date
 * Note: isToday is computed dynamically, not cached, to handle overnight page views
 */
function generateWeekDays(
  displayedDate: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
): Omit<WeekDay, "isToday">[] {
  const weekStart = startOfWeek(displayedDate, { weekStartsOn });
  const weekEnd = endOfWeek(displayedDate, { weekStartsOn });

  return eachDayOfInterval({ start: weekStart, end: weekEnd }).map((date) => ({
    date,
    dayName: format(date, "EEE"),
    dayNumber: date.getDate(),
  }));
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
export function getCalendarHeaderInfo(currentDate: Date, weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6) {
  return {
    monthName: format(currentDate, "MMMM"),
    year: format(currentDate, "yyyy"),
    weekNumber: getWeek(currentDate, { weekStartsOn }),
  };
}

/**
 * Main Week View calendar component
 * Displays a week grid with time slots
 */
export function WeekView({
  currentDate = new Date(),
  weekStartsOn = 0,
  events = [],
  onEventClick,
  className,
}: WeekViewProps) {
  const baseDays = React.useMemo(
    () => generateWeekDays(currentDate, weekStartsOn),
    [currentDate, weekStartsOn]
  );

  // Compute isToday fresh on each render to handle overnight page views
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

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* Header - NOT in scroll container, won't scroll */}
      <div className="flex-shrink-0">
        <WeekViewDayColumns days={days} />
        <WeekViewAllDayRow days={days} allDayEvents={allDayEvents} />
      </div>

      {/* ONLY this part scrolls */}
      <div className="flex-1 overflow-auto">
        <div className="relative flex" style={{ height: hours.length * HOUR_HEIGHT }}>
          <WeekViewTimeAxis hours={hours} hourHeight={HOUR_HEIGHT} />
          <div className="relative flex-1">
            <WeekViewGrid
              days={days}
              hours={hours}
              hourHeight={HOUR_HEIGHT}
              events={timedEvents}
              onEventClick={onEventClick}
            />
          </div>
          <WeekViewTimeIndicator days={days} hourHeight={HOUR_HEIGHT} />
        </div>
      </div>
    </div>
  );
}
