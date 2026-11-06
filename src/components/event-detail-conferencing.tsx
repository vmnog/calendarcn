"use client";

import { Video } from "lucide-react";

import {
  EventDetailPlaceholderRow,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  ConferenceProvider,
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** Name shown for each conferencing provider */
const PROVIDER_NAMES: Record<ConferenceProvider, string> = {
  "google-meet": "Google Meet",
  zoom: "Zoom",
  "microsoft-teams": "Microsoft Teams",
  other: "Video call",
};

/**
 * The event's video call, or a muted "Conferencing" when it has none
 */
export function EventDetailConferencing<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  if (!event.conference) {
    return (
      <EventDetailSection name="conferencing">
        <EventDetailPlaceholderRow icon={Video} label="Conferencing" />
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="conferencing">
      <EventDetailRow icon={Video}>
        <span className="text-foreground truncate">
          {PROVIDER_NAMES[event.conference.provider]}
        </span>
      </EventDetailRow>
    </EventDetailSection>
  );
}
