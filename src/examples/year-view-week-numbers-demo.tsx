"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { YearView } from "@/components/year-view";
import type { WeekStartsOn } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Weeks start on Monday */
const WEEK_STARTS_ON: WeekStartsOn = 1;

export function YearViewWeekNumbersDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() =>
    createSampleEvents(new Date(), WEEK_STARTS_ON),
  );

  return (
    <CalendarProvider
      defaultView="year"
      defaultEvents={initialEvents}
      // Every month starts its weeks on Monday
      defaultWeekStartsOn={WEEK_STARTS_ON}
      // A number beside each week of each month
      defaultViewSettings={{ showWeekNumbers: true }}
    >
      <div className="h-[600px]">
        <YearView />
      </div>
    </CalendarProvider>
  );
}
