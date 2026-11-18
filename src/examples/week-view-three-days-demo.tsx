"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { createSampleEvents } from "@/lib/sample-events";

export function WeekViewThreeDaysDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    // Below 7, the columns start on today and previous/next move by that many days
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={3}>
      {/* The view fills its parent's height */}
      <div className="h-[600px]">
        <WeekView scrollToHour={8} />
      </div>
    </CalendarProvider>
  );
}
