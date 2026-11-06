"use client";

import { cn } from "@/lib/utils";
import {
  EVENT_DETAIL_MUTED_CLASS,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/**
 * The event's notes, or a muted "Description". It has no icon: the text
 * starts at the panel's left edge.
 */
export function EventDetailDescription<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  return (
    <EventDetailSection name="description" className="px-4 text-xs">
      {event.description ? (
        <p className="text-foreground whitespace-pre-wrap">
          {event.description}
        </p>
      ) : (
        <span className={cn(EVENT_DETAIL_MUTED_CLASS)}>Description</span>
      )}
    </EventDetailSection>
  );
}
