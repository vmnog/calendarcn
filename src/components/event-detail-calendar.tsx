"use client";

import { cn } from "@/lib/utils";
import { EventDetailRow, EventDetailSection } from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventColor,
  EventDetailSectionProps,
} from "./week-view-types";

/** Swatch color of each event color */
const COLOR_SWATCH_CLASS: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
};

/**
 * The event's color swatch and the calendar or account it belongs to
 */
export function EventDetailCalendar<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  const color = event.color ?? "blue";

  return (
    <EventDetailSection name="calendar">
      <EventDetailRow
        leading={
          <span
            className={cn("size-3 rounded-xs", COLOR_SWATCH_CLASS[color])}
          />
        }
      >
        <span className="text-foreground truncate">
          {event.calendarEmail ?? event.calendarId ?? "Calendar"}
        </span>
      </EventDetailRow>
    </EventDetailSection>
  );
}
