"use client";

import * as React from "react";
import { addDays, format, isSameDay, startOfWeek } from "date-fns";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { DayView } from "@/components/day-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

/** Days in the strip above the view */
const DAYS_PER_WEEK = 7;

export function DayViewWeekStripDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <WeekStrip />
        <div className="min-h-0 flex-1">
          <DayView scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** The week of the day on screen: click a day to show it */
function WeekStrip() {
  // In day view, `currentDate` is the day shown. It follows sideways scrolling too
  const { currentDate, goToDate } = useCalendar();
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: DAYS_PER_WEEK }, (_, index) =>
    addDays(weekStart, index),
  );

  return (
    <div className="grid shrink-0 grid-cols-7 gap-1 border-b p-2">
      {days.map((day) => (
        <Button
          key={day.getTime()}
          variant={isSameDay(day, currentDate) ? "default" : "ghost"}
          className="h-auto flex-col gap-0 py-1.5"
          onClick={() => goToDate(day)}
        >
          <span className="text-[11px] font-normal opacity-70">
            {format(day, "EEE")}
          </span>
          <span className="text-sm tabular-nums">{format(day, "d")}</span>
        </Button>
      ))}
    </div>
  );
}
