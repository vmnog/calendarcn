"use client";

import * as React from "react";
import { format, isSameDay } from "date-fns";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { YearView } from "@/components/year-view";
import { createSampleEvents } from "@/lib/sample-events";

export function YearViewDayEventsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  // The day picked in the year, or `null` before the first click
  const [pickedDay, setPickedDay] = React.useState<Date | null>(null);

  return (
    <CalendarProvider defaultView="year" defaultEvents={initialEvents}>
      <div className="flex h-[600px]">
        <div className="min-w-0 flex-1">
          {/* `onDayClick` replaces the default, which opens the day's week */}
          <YearView onDayClick={setPickedDay} />
        </div>
        <DayEvents day={pickedDay} />
      </div>
    </CalendarProvider>
  );
}

/** The picked day's events, from the provider */
function DayEvents({ day }: { day: Date | null }) {
  const { events } = useCalendar();
  // Events that start that day. For repeating events, expand them first
  // with `expandRecurringEvents()` from `@/lib/recurrence`
  const dayEvents = day
    ? events.filter((event) => isSameDay(event.start, day))
    : [];

  return (
    <aside className="w-48 shrink-0 overflow-y-auto border-l p-3 text-sm">
      <h3 className="font-semibold">
        {day ? format(day, "EEEE, MMM d") : "Pick a day"}
      </h3>
      {day && dayEvents.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">No events.</p>
      )}
      <ul className="mt-2 flex flex-col gap-2">
        {dayEvents.map((event) => (
          <li key={event.id}>
            <p className="truncate text-xs font-medium">{event.title}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {event.isAllDay ? "All day" : format(event.start, "p")}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}
