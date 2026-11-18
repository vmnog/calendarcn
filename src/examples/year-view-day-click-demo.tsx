"use client";

import * as React from "react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { DayView } from "@/components/day-view";
import { YearView } from "@/components/year-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function YearViewDayClickDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultView="year" defaultEvents={initialEvents}>
      <div className="h-[600px]">
        <YearOrDay />
      </div>
    </CalendarProvider>
  );
}

/** The year, or the day that was clicked in it */
function YearOrDay() {
  const { view, switchView, goToDate } = useCalendar();

  if (view === "year") {
    return (
      <YearView
        // Without `onDayClick`, a click opens the day's week (`showDay()`)
        onDayClick={(date) => {
          switchView("day");
          goToDate(date);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b p-2">
        <Button variant="outline" size="sm" onClick={() => switchView("year")}>
          Back to the year
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <DayView scrollToHour={8} />
      </div>
    </div>
  );
}
