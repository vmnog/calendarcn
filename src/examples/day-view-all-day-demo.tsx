"use client";

import * as React from "react";
import { addDays, startOfDay } from "date-fns";

import { CalendarProvider } from "@/components/calendar-provider";
import { DayView } from "@/components/day-view";
import type { CalendarEvent } from "@/components/calendar-types";

/** Today's events: two in the all-day row, two on the hour grid */
function createTodayEvents(): CalendarEvent[] {
  const today = startOfDay(new Date());
  const at = (hour: number, minute = 0) =>
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hour,
      minute,
    );

  return [
    // An all-day event ends on its last day: one day has `start` equal to `end`
    {
      id: "holiday",
      title: "Public holiday",
      start: today,
      end: today,
      isAllDay: true,
      color: "green",
    },
    // Yesterday to tomorrow: the bar runs past both edges of the day
    {
      id: "conference",
      title: "Design conference",
      start: addDays(today, -1),
      end: addDays(today, 1),
      isAllDay: true,
      color: "purple",
    },
    {
      id: "keynote",
      title: "Keynote",
      start: at(9),
      end: at(10),
      color: "blue",
    },
    {
      id: "workshop",
      title: "Workshop",
      start: at(10, 30),
      end: at(12),
      color: "orange",
    },
  ];
}

export function DayViewAllDayDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createTodayEvents);

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="h-[600px]">
        <DayView scrollToHour={8} />
      </div>
    </CalendarProvider>
  );
}
