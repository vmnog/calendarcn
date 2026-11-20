"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CalendarSettingsDialog } from "@/components/calendar-settings";
import type { HourCycle } from "@/components/calendar-types";
import { Button } from "@/components/ui/button";
import { MonthView } from "@/components/month-view";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarSettingsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  // Starts open so the docs show the dialog: start it closed in your app
  const [open, setOpen] = React.useState(true);
  const [hourCycle, setHourCycle] = React.useState<HourCycle>(12);

  return (
    <CalendarProvider defaultEvents={initialEvents} hourCycle={hourCycle}>
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center border-b px-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Open settings
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <MonthView />
        </div>
      </div>
      {/* Weekends and week numbers come from the provider; the time format
          shows because there's a handler for it */}
      <CalendarSettingsDialog
        open={open}
        onOpenChange={setOpen}
        onHourCycleChange={setHourCycle}
      />
    </CalendarProvider>
  );
}
