"use client";

import * as React from "react";
import { addWeeks } from "date-fns";
import { MapPinIcon } from "lucide-react";

import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider } from "@/components/calendar-provider";
import type {
  DetailedCalendarEvent,
  EventContentProps,
} from "@/components/calendar-types";
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

export function AgendaViewEventContentDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createTwoWeeks);

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      renderEventContent={renderEventContent}
    >
      <div className="h-[600px]">
        <AgendaView />
      </div>
    </CalendarProvider>
  );
}

/** Draws the inside of each row. The agenda still draws the row and its color bar */
function renderEventContent({
  event,
  timeLabel,
  isPast,
}: EventContentProps<DetailedCalendarEvent>) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 py-0.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{event.title}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {timeLabel || "All day"}
        </p>
      </div>
      {event.location && (
        <span className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          <MapPinIcon className="size-3" />
          {event.location}
        </span>
      )}
      {isPast && <span className="text-xs text-muted-foreground">Done</span>}
    </div>
  );
}
