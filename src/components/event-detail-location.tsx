"use client";

import { MapPin } from "lucide-react";

import {
  EventDetailPlaceholderRow,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/**
 * Where the event happens, or a muted "Location"
 */
export function EventDetailLocation<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  if (!event.location) {
    return (
      <EventDetailSection name="location">
        <EventDetailPlaceholderRow icon={MapPin} label="Location" />
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="location">
      <EventDetailRow icon={MapPin}>
        <span className="text-foreground truncate">{event.location}</span>
      </EventDetailRow>
    </EventDetailSection>
  );
}
