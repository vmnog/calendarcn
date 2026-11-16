"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CalendarToaster } from "@/components/calendar-toaster";
import { WeekView } from "@/components/week-view";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarToasterDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      {/* The toaster sits at the bottom right of this positioned element */}
      <div className="relative h-full">
        <WeekView scrollToHour={8} />
        <CalendarToaster />
      </div>
    </CalendarProvider>
  );
}
