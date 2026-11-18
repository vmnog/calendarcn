"use client";

import * as React from "react";
import { MapPinIcon } from "lucide-react";

import { CalendarProvider } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import type {
  DetailedCalendarEvent,
  EventContentProps,
} from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

export function MonthViewEventContentDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultView="month"
      defaultEvents={initialEvents}
      renderEventContent={renderEventContent}
    >
      <div className="h-[600px]">
        <MonthView />
      </div>
    </CalendarProvider>
  );
}

/**
 * Draws the inside of every event. Month view has two placements, each one
 * line tall: a timed event's line in its day, and a bar across days.
 */
function renderEventContent({
  event,
  placement,
  timeLabel,
}: EventContentProps<DetailedCalendarEvent>) {
  if (placement === "month-bar") {
    return (
      <span className="flex min-w-0 items-center gap-1 px-1 text-[0.6875rem] font-semibold">
        <span className="truncate">{event.title}</span>
        {event.location && (
          <>
            <MapPinIcon className="size-3 shrink-0 opacity-70" />
            <span className="truncate font-normal">{event.location}</span>
          </>
        )}
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-baseline gap-1 text-[0.6875rem]">
      <span className="truncate font-semibold">{event.title}</span>
      <span className="shrink-0 tabular-nums opacity-70">{timeLabel}</span>
    </span>
  );
}
