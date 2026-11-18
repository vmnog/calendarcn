"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CalendarToaster } from "@/components/calendar-toaster";
import { WeekView } from "@/components/week-view";
import { createSampleEvents } from "@/lib/sample-events";

/** How long a toast stays, in milliseconds */
const TOAST_DURATION_MS = 10_000;

export function CalendarToasterDurationDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="relative h-[600px]">
        <WeekView scrollToHour={8} />
        <CalendarToaster
          // Ten seconds instead of five
          duration={TOAST_DURATION_MS}
          // At the bottom left instead of the bottom right
          className="right-auto left-4 justify-start"
        />
      </div>
    </CalendarProvider>
  );
}
