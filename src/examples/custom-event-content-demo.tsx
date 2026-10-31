"use client";

import * as React from "react";
import { MapPinIcon, RepeatIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { CalendarProvider } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import type {
  DetailedCalendarEvent,
  EventColor,
  EventContentProps,
} from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Text class per event color, from the `--event-*` theme tokens */
const TEXT_CLASS: Record<EventColor, string> = {
  red: "text-event-red",
  orange: "text-event-orange",
  yellow: "text-event-yellow",
  green: "text-event-green",
  blue: "text-event-blue",
  purple: "text-event-purple",
  gray: "text-event-gray",
};

export function CustomEventContentDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      renderEventContent={renderEventContent}
    >
      <WeekView scrollToHour={8} />
    </CalendarProvider>
  );
}

/**
 * Draws the inside of every event. The calendar still draws the box around
 * it (position, color, selection, drag and resize handles).
 */
function renderEventContent({
  event,
  placement,
  isCompact,
  timeLabel,
}: EventContentProps<DetailedCalendarEvent>) {
  const textClass = cn(
    "text-[0.625rem] leading-tight dark:text-white/85",
    TEXT_CLASS[event.color ?? "blue"],
  );

  // One line: the all-day row, month cells, and short time-grid blocks
  if (isCompact || placement !== "time-grid") {
    return (
      <div className={cn("flex h-full items-center gap-1", textClass)}>
        {event.recurrence && <RepeatIcon className="size-2.5 shrink-0" />}
        <span className="truncate font-semibold">{event.title}</span>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col gap-0.5 pt-0.5", textClass)}>
      <span className="font-semibold">{event.title}</span>
      <span className="tabular-nums opacity-80">{timeLabel}</span>
      {event.location && (
        <span className="flex items-center gap-0.5 opacity-80">
          <MapPinIcon strokeWidth={1.5} className="size-2.5 shrink-0" />
          <span className="truncate">{event.location}</span>
        </span>
      )}
    </div>
  );
}
