"use client";

import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider } from "@/components/calendar-provider";

export function AgendaViewEmptyDemo() {
  return (
    // No events in the next 30 days: the agenda shows its empty state
    <CalendarProvider>
      <div className="h-[400px]">
        <AgendaView />
      </div>
    </CalendarProvider>
  );
}
