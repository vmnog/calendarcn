"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { DayView } from "@/components/day-view";
import { createSampleEvents } from "@/lib/sample-events";

export function DayViewSnapDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      // Drag, resize and new events move in 5-minute steps (15 by default)
      snapMinutes={5}
      // A double-click on an empty slot starts a 20-minute event (30 by default)
      defaultEventDuration={20}
    >
      <div className="h-[600px]">
        <DayView scrollToHour={8} />
      </div>
    </CalendarProvider>
  );
}
