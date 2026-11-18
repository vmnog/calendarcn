"use client";

import * as React from "react";
import { addWeeks } from "date-fns";

import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider } from "@/components/calendar-provider";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** This week's sample events and next week's, so the list runs past today */
function createTwoWeeks(): DetailedCalendarEvent[] {
  const today = new Date();
  const nextWeek = createSampleEvents(addWeeks(today, 1)).map((event) => ({
    ...event,
    id: `${event.id}-next`,
  }));
  return [...createSampleEvents(today), ...nextWeek];
}

export function AgendaViewWeekNumbersDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createTwoWeeks);

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      // "14:00" instead of "2 PM"
      hourCycle={24}
      // "Week 23" marks where each week starts: on Mondays here
      defaultWeekStartsOn={1}
      defaultViewSettings={{ showWeekNumbers: true }}
    >
      <div className="h-[600px]">
        <AgendaView />
      </div>
    </CalendarProvider>
  );
}
