"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CommandMenu } from "@/components/command-menu";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { CommandMenuPage } from "@/components/week-view-types";
import { createSampleEvents } from "@/lib/sample-events";

export function CommandMenuGoToDateDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  const [open, setOpen] = React.useState(false);
  // The page the menu opens on. Set it before opening
  const [page, setPage] = React.useState<CommandMenuPage>("commands");

  const openOn = (nextPage: CommandMenuPage) => {
    setPage(nextPage);
    setOpen(true);
  };

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          {/* Type "next friday", "dec 25" or "in 2 weeks", then press Enter */}
          <Button size="sm" onClick={() => openOn("go-to-date")}>
            Go to date
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openOn("commands")}
          >
            All commands
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
      <CommandMenu open={open} onOpenChange={setOpen} defaultPage={page} />
    </CalendarProvider>
  );
}
