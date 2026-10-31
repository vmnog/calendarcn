"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { TimeGrid } from "@/components/time-grid";
import { createSampleEvents } from "@/lib/sample-events";

export function TimeGridDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      {/* A three-day grid: prev/next step by three days */}
      <TimeGrid view="week" numberOfDays={3} />
    </CalendarProvider>
  );
}
