"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { createSampleEvents } from "@/lib/sample-events";

export function MonthViewDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultView="month" defaultEvents={initialEvents}>
      <MonthView />
    </CalendarProvider>
  );
}
