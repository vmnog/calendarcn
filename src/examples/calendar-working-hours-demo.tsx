"use client";

import * as React from "react";

import { Calendar } from "@/components/calendar";
import type { WeekStartsOn } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Weeks start on Monday */
const WEEK_STARTS_ON: WeekStartsOn = 1;

export function CalendarWorkingHoursDemo() {
  // The calendar reads its initial events once, so create them once
  const [initialEvents] = React.useState(() =>
    createSampleEvents(new Date(), WEEK_STARTS_ON),
  );

  return (
    <div className="h-[600px]">
      <Calendar
        defaultEvents={initialEvents}
        // Monday to Friday
        defaultWeekStartsOn={WEEK_STARTS_ON}
        defaultViewSettings={{ showWeekends: false }}
        // The day and week views run from 08:00 to 18:00
        dayStartHour={8}
        dayEndHour={18}
        // "15:00" instead of "3 PM"
        hourCycle={24}
        // Several calendars share this docs page, so the single-key shortcuts stay off
        shortcuts={false}
      />
    </div>
  );
}
