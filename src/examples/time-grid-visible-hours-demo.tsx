"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { TimeGrid } from "@/components/time-grid";
import { createSampleEvents } from "@/lib/sample-events";

export function TimeGridVisibleHoursDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      // The grid runs from 8 AM to 6 PM. Events outside it are clipped at the
      // edge, or hidden, and drag, resize and new events stay inside
      dayStartHour={8}
      dayEndHour={18}
    >
      <div className="h-[600px]">
        <TimeGrid view="week" />
      </div>
    </CalendarProvider>
  );
}
