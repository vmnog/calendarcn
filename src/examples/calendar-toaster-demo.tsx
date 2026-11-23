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
      <div className="flex h-full flex-col">
        <p className="shrink-0 border-b px-3 py-2.5 text-sm text-muted-foreground">
          Right-click an event → Delete, then Undo in the toast.
        </p>
        {/* The toaster sits at the bottom right of this positioned element */}
        <div className="relative min-h-0 flex-1">
          <WeekView scrollToHour={8} />
          <CalendarToaster />
        </div>
      </div>
    </CalendarProvider>
  );
}
