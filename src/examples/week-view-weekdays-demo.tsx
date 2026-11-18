"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import type { WeekStartsOn } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Weeks start on Monday */
const WEEK_STARTS_ON: WeekStartsOn = 1;

export function WeekViewWeekdaysDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() =>
    createSampleEvents(new Date(), WEEK_STARTS_ON),
  );

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      defaultWeekStartsOn={WEEK_STARTS_ON}
      // Monday to Friday: scrolling, previous and next step over the weekend
      defaultViewSettings={{ showWeekends: false }}
    >
      <div className="h-[600px]">
        <WeekView scrollToHour={8} />
      </div>
    </CalendarProvider>
  );
}
