"use client";

import * as React from "react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { TimeGrid } from "@/components/time-grid";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function TimeGridDayWeekDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <DayWeekGrid />
      </div>
    </CalendarProvider>
  );
}

/** Your own header over one grid that shows a day or a week */
function DayWeekGrid() {
  const { view, switchView, monthName, year } = useCalendar();
  // The provider's view can be any of five: the grid draws two of them
  const gridView = view === "day" ? "day" : "week";

  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
        <h2 className="flex-1 truncate text-sm font-semibold">
          {monthName} {year}
        </h2>
        <Button
          variant={gridView === "day" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => switchView("day")}
        >
          Day
        </Button>
        <Button
          variant={gridView === "week" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => switchView("week")}
        >
          Week
        </Button>
      </header>
      <div className="min-h-0 flex-1">
        {/* One grid for both, so switching keeps the scroll position */}
        <TimeGrid view={gridView} scrollToHour={8} />
      </div>
    </>
  );
}
