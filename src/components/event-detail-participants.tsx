"use client";

import { User } from "lucide-react";

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
 * Guests and meeting rooms: one row per guest and room, or a muted
 * "Participants and Rooms" when there are none
 */
export function EventDetailParticipants<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  const participants = event.participants ?? [];
  const rooms = event.rooms ?? [];

  if (participants.length === 0 && rooms.length === 0) {
    return (
      <EventDetailSection name="participants">
        <EventDetailPlaceholderRow icon={User} label="Participants and Rooms" />
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="participants">
      {participants.map((participant) => (
        <EventDetailRow key={participant.email} icon={User}>
          <span className="text-foreground truncate">
            {participant.name ?? participant.email}
          </span>
        </EventDetailRow>
      ))}
      {rooms.map((room) => (
        <EventDetailRow key={room.id} icon={User}>
          <span className="text-foreground truncate">{room.name}</span>
        </EventDetailRow>
      ))}
    </EventDetailSection>
  );
}
