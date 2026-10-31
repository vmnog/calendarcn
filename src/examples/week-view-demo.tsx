"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { createSampleEvents } from "@/lib/sample-events";

export function WeekViewDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <WeekView scrollToHour={8} />
    </CalendarProvider>
  );
}
