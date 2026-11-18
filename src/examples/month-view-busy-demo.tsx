"use client";

import * as React from "react";
import { addMinutes } from "date-fns";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { CalendarEvent, EventColor } from "@/components/calendar-types";

/** More sessions than a day's cell has room for */
const SESSIONS = [
  "Doors open",
  "Keynote",
  "Design systems",
  "Coffee",
  "Accessibility",
  "Lunch",
  "Performance",
  "Panel",
  "Closing party",
];

/** Colors handed out to the sessions, in turn */
const COLORS: EventColor[] = ["blue", "purple", "green", "orange", "red"];

/** One session an hour today, from 9 AM */
function createConferenceDay(): CalendarEvent[] {
  const now = new Date();
  return SESSIONS.map((title, index) => {
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      9 + index,
    );
    return {
      id: `session-${index}`,
      title,
      start,
      end: addMinutes(start, 45),
      color: COLORS[index % COLORS.length],
    };
  });
}

export function MonthViewBusyDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createConferenceDay);

  return (
    <CalendarProvider defaultView="month" defaultEvents={initialEvents}>
      <div className="h-[600px]">
        <MonthOrWeek />
      </div>
    </CalendarProvider>
  );
}

/** "N more" on a busy day switches the provider to the week view: render it */
function MonthOrWeek() {
  const { view, switchView } = useCalendar();

  if (view === "month") return <MonthView />;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b p-2">
        <Button variant="outline" size="sm" onClick={() => switchView("month")}>
          Back to the month
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <WeekView scrollToHour={8} />
      </div>
    </div>
  );
}
