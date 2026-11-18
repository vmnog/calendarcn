"use client";

import * as React from "react";

import { AvailabilityHint } from "@/components/availability-panel";
import { CalendarProvider } from "@/components/calendar-provider";
import {
  SchedulingProvider,
  useScheduling,
} from "@/components/scheduling-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function SchedulingShareDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={5}>
      {/* Inside the calendar's provider, around everything that reads it */}
      <SchedulingProvider>
        <div className="flex h-[600px] flex-col">
          <ShareBar />
          {/* The pill sits at the bottom of this positioned element */}
          <div className="relative min-h-0 flex-1">
            <WeekView scrollToHour={8} />
            {/* `showActions` gives the pill Cancel and Copy, for a layout
                without the scheduling panel */}
            <AvailabilityHint showActions />
          </div>
        </div>
      </SchedulingProvider>
    </CalendarProvider>
  );
}

/** Starts marking from a button of your own, and shows the text so far */
function ShareBar() {
  // `null` outside a SchedulingProvider
  const scheduling = useScheduling();
  if (!scheduling) return null;

  const { isPicking, text, startPicking } = scheduling;

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <Button size="sm" disabled={isPicking} onClick={() => startPicking()}>
        Share availability
      </Button>
      <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        {isPicking
          ? text || "Drag on a day to mark when you're free"
          : "Marks times on the grid and copies them as text"}
      </p>
    </div>
  );
}
