"use client";

import * as React from "react";
import { addWeeks } from "date-fns";

import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider } from "@/components/calendar-provider";
import { createSampleEvents } from "@/lib/sample-events";

export function AgendaViewDemo() {
  // The provider reads its initial events once, so create them once: this
  // week's and next week's (with their own ids), so the list runs past today
  const [initialEvents] = React.useState(() => {
    const today = new Date();
    const nextWeek = createSampleEvents(addWeeks(today, 1)).map((event) => ({
      ...event,
      id: `${event.id}-next`,
    }));
    return [...createSampleEvents(today), ...nextWeek];
  });

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <AgendaView />
    </CalendarProvider>
  );
}
