"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { AvailabilityPanel } from "@/components/availability-panel";
import { CalendarProvider } from "@/components/calendar-provider";
import {
  SchedulingProvider,
  useScheduling,
} from "@/components/scheduling-provider";
import { CALENDAR_SIDEBAR_COLORS_CLASS } from "@/components/sidebar-overlay";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function SchedulingPanelDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={3}>
      <SchedulingProvider
        // The meeting length the text asks for: "Would 45 min ..."
        defaultDurationMinutes={45}
      >
        <div className="flex h-[600px]">
          <div className="min-w-0 flex-1">
            <WeekView scrollToHour={8} />
          </div>
          <aside
            className={cn(
              // The panel is drawn in the calendar sidebars' colors
              CALENDAR_SIDEBAR_COLORS_CLASS,
              "flex w-[309px] shrink-0 flex-col border-l bg-sidebar text-sidebar-foreground",
            )}
          >
            {/* Renders nothing until times are being marked */}
            <AvailabilityPanel />
            <StartScheduling />
          </aside>
        </div>
      </SchedulingProvider>
    </CalendarProvider>
  );
}

/** What the panel's place shows before marking starts */
function StartScheduling() {
  const scheduling = useScheduling();
  if (!scheduling || scheduling.isPicking) return null;

  return (
    <div className="flex flex-col items-start gap-3 p-4 text-sm">
      <p className="text-sidebar-foreground/70">
        Mark the times you&apos;re free, then copy them as a message.
      </p>
      <Button size="sm" onClick={() => scheduling.startPicking()}>
        Share availability
      </Button>
    </div>
  );
}
