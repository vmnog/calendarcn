"use client";

import { EventDetailRow, EventDetailSection } from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** Label of each visibility setting */
const VISIBILITY_LABELS: Record<
  NonNullable<DetailedCalendarEvent["visibility"]>,
  string
> = {
  default: "Default visibility",
  public: "Public",
  private: "Private",
};

/**
 * Busy or free, and who can see the event, side by side under the calendar
 */
export function EventDetailAvailability<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  return (
    <EventDetailSection name="availability">
      <EventDetailRow>
        <div className="grid flex-1 grid-cols-2">
          <span className="text-foreground font-medium">
            {event.status === "free" ? "Free" : "Busy"}
          </span>
          <span className="text-foreground font-medium">
            {VISIBILITY_LABELS[event.visibility ?? "default"]}
          </span>
        </div>
      </EventDetailRow>
    </EventDetailSection>
  );
}
