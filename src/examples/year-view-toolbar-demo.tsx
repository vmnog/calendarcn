"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { YearView } from "@/components/year-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function YearViewToolbarDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultView="year" defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <Toolbar />
        <div className="min-h-0 flex-1">
          <YearView />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** In year view, previous and next move a year */
function Toolbar() {
  const { year, goToToday, goToPrev, goToNext } = useCalendar();

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
      <h2 className="flex-1 text-sm font-semibold tabular-nums">{year}</h2>
      <Button variant="outline" size="sm" onClick={goToToday}>
        This year
      </Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={goToPrev}>
        <ChevronLeftIcon />
        <span className="sr-only">Previous year</span>
      </Button>
      <Button variant="ghost" size="icon" className="size-8" onClick={goToNext}>
        <ChevronRightIcon />
        <span className="sr-only">Next year</span>
      </Button>
    </header>
  );
}
