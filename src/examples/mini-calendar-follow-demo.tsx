"use client";

import * as React from "react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { DayView } from "@/components/day-view";
import { MiniCalendar } from "@/components/mini-calendar";
import { createSampleEvents } from "@/lib/sample-events";

export function MiniCalendarFollowDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      {/* Side by side from the `sm` breakpoint, stacked on phones */}
      <div className="flex h-[600px] flex-col sm:flex-row">
        <aside className="flex shrink-0 justify-center border-b py-2 sm:border-r sm:border-b-0">
          <div className="w-60">
            <DayPicker />
          </div>
        </aside>
        <div className="min-h-0 min-w-0 flex-1">
          <DayView scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** A mini calendar wired to the provider: it follows the view and drives it */
function DayPicker() {
  const { currentDate, visibleDays, weekStartsOn, goToDate } = useCalendar();

  return (
    <MiniCalendar
      currentDate={currentDate}
      // The days on screen are highlighted, and their month is shown
      visibleDays={visibleDays}
      weekStartsOn={weekStartsOn}
      // Picking a day shows it in the view
      onDateSelect={goToDate}
    />
  );
}
