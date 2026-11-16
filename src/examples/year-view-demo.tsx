"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { YearView } from "@/components/year-view";
import { createSampleEvents } from "@/lib/sample-events";

export function YearViewDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultView="year" defaultEvents={initialEvents}>
      <YearView />
    </CalendarProvider>
  );
}
