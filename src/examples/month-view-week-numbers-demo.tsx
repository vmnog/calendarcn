"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import type { WeekStartsOn } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Weeks start on Monday */
const WEEK_STARTS_ON: WeekStartsOn = 1;

export function MonthViewWeekNumbersDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() =>
    createSampleEvents(new Date(), WEEK_STARTS_ON),
  );

  return (
    <CalendarProvider
      defaultView="month"
      defaultEvents={initialEvents}
      defaultWeekStartsOn={WEEK_STARTS_ON}
      // A number beside each week, counted the way the locale counts weeks
      defaultViewSettings={{ showWeekNumbers: true }}
    >
      <div className="h-[600px]">
        <MonthView />
      </div>
    </CalendarProvider>
  );
}
