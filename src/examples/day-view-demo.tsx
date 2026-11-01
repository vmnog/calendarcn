"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { DayView } from "@/components/day-view";
import { createSampleEvents } from "@/lib/sample-events";

export function DayViewDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <DayView scrollToHour={8} />
    </CalendarProvider>
  );
}
