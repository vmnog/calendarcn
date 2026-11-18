"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function WeekViewToolbarDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <Toolbar />
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Any component inside the provider can read the calendar and move it */
function Toolbar() {
  const { monthName, year, goToToday, goToPrev, goToNext } = useCalendar();

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
      {/* Follows the week on screen, also while it scrolls sideways */}
      <h2 className="flex-1 truncate text-sm font-semibold">
        {monthName} {year}
      </h2>
      <Button variant="outline" size="sm" onClick={goToToday}>
        Today
      </Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={goToPrev}>
        <ChevronLeftIcon />
        <span className="sr-only">Previous week</span>
      </Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={goToNext}>
        <ChevronRightIcon />
        <span className="sr-only">Next week</span>
      </Button>
    </header>
  );
}
