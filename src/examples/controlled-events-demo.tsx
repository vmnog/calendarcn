"use client";

import * as React from "react";
import { format, isSameDay } from "date-fns";

import { cn } from "@/lib/utils";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type {
  DetailedCalendarEvent,
  EventColor,
} from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Swatch class per event color, from the `--event-*-border` theme tokens */
const SWATCH_CLASS: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
};

export function ControlledEventsDemo() {
  // Your app owns the events: the calendar reports every change through
  // `onEventsChange` and draws whatever `events` holds
  const [events, setEvents] = React.useState<DetailedCalendarEvent[]>(() =>
    createSampleEvents(new Date()),
  );

  return (
    <CalendarProvider events={events} onEventsChange={setEvents}>
      {/* The list sits beside the calendar when there's room, below it otherwise */}
      <div className="@container h-full">
        <div className="flex h-full flex-col @2xl:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            <WeekView scrollToHour={8} />
          </div>
          <EventList
            events={events}
            onReset={() => setEvents(createSampleEvents(new Date()))}
          />
        </div>
      </div>
    </CalendarProvider>
  );
}

interface EventListProps {
  events: DetailedCalendarEvent[];
  onReset: () => void;
}

/** The app's copy of the events, updated live as you drag, resize or create */
function EventList({ events, onReset }: EventListProps) {
  const { selectedEventId, selectEvent } = useCalendar();
  const sortedEvents = React.useMemo(
    () => [...events].sort((a, b) => a.start.getTime() - b.start.getTime()),
    [events],
  );

  return (
    <aside className="flex h-40 shrink-0 flex-col border-t @2xl:h-auto @2xl:w-56 @2xl:border-t-0 @2xl:border-l">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <h3 className="text-xs font-medium">
          Events{" "}
          <span className="text-muted-foreground tabular-nums">
            ({events.length})
          </span>
        </h3>
        <Button variant="ghost" size="sm" className="h-7" onClick={onReset}>
          Reset
        </Button>
      </div>
      <ul className="flex-1 overflow-y-auto p-1">
        {sortedEvents.map((event) => (
          <li key={event.id}>
            <button
              type="button"
              onClick={() => selectEvent(event.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-150 ease-out outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
                event.id === selectedEventId && "bg-accent",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-1 size-2 shrink-0 rounded-full",
                  SWATCH_CLASS[event.color ?? "blue"],
                )}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">
                  {event.title}
                </span>
                <span className="block text-[11px] text-muted-foreground tabular-nums">
                  {formatEventTime(event)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** "Mon 9:00 AM – 9:30 AM", "Fri 4:00 PM – Sat 1:00 PM" or "Wed – Thu, all day" */
function formatEventTime(event: DetailedCalendarEvent): string {
  if (event.isAllDay) {
    const startDay = format(event.start, "EEE");
    const endDay = format(event.end, "EEE");
    if (startDay === endDay) {
      return `${startDay}, all day`;
    }
    return `${startDay} – ${endDay}, all day`;
  }

  const endFormat = isSameDay(event.start, event.end) ? "p" : "EEE p";
  return `${format(event.start, "EEE p")} – ${format(event.end, endFormat)}`;
}
