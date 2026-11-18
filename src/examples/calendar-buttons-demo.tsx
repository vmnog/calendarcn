"use client";

import * as React from "react";
import { addMonths, format } from "date-fns";

import { Calendar } from "@/components/calendar";
import { useCalendar } from "@/components/calendar-provider";
import { Button } from "@/components/ui/button";
import type { ViewType } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Views the panel's buttons switch between */
const VIEWS: ViewType[] = ["day", "week", "month", "agenda"];

export function CalendarButtonsDemo() {
  // The calendar reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <div className="flex h-[600px] flex-col">
      <Calendar
        defaultEvents={initialEvents}
        // The calendar takes the height the bar under it leaves
        className="h-auto flex-1"
        // Several calendars share this docs page, so the single-key shortcuts stay off
        shortcuts={false}
      >
        {/* Children render inside the calendar's provider, after the calendar */}
        <QuickJump />
      </Calendar>
    </div>
  );
}

/** Buttons of your own: `useCalendar()` reads the calendar and moves it */
function QuickJump() {
  const { view, currentDate, switchView, goToToday, navigateToDate } =
    useCalendar();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t p-2">
      <Button variant="outline" size="sm" onClick={goToToday}>
        Today
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigateToDate(addMonths(currentDate, 1))}
      >
        A month ahead
      </Button>
      {VIEWS.map((option) => (
        <Button
          key={option}
          variant={view === option ? "secondary" : "ghost"}
          size="sm"
          className="capitalize"
          onClick={() => switchView(option)}
        >
          {option}
        </Button>
      ))}
      <p className="ml-auto text-xs text-muted-foreground tabular-nums">
        From {format(currentDate, "MMM d, yyyy")}
      </p>
    </div>
  );
}
