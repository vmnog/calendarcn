"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CommandMenu } from "@/components/command-menu";
import { Button } from "@/components/ui/button";
import { WeekView } from "@/components/week-view";
import { createSampleEvents } from "@/lib/sample-events";

export function CommandMenuDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  const [open, setOpen] = React.useState(false);

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-full flex-col">
        <div className="flex h-12 shrink-0 items-center border-b px-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Open command menu
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <WeekView scrollToHour={8} />
        </div>
      </div>
      {/* A button here, to leave ⌘K to the docs' search. In your app, open it
          with useCalendarShortcuts({ onToggleCommandMenu }) */}
      <CommandMenu open={open} onOpenChange={setOpen} />
    </CalendarProvider>
  );
}
