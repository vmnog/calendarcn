"use client";

import { NotepadText } from "lucide-react";

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
 * Whether AI meeting notes are on, or a muted "Add AI meeting notes"
 */
export function EventDetailAiNotes<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  if (!event.aiMeetingNotes) {
    return (
      <EventDetailSection name="ai-notes">
        <EventDetailPlaceholderRow
          icon={NotepadText}
          label="Add AI meeting notes"
        />
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="ai-notes">
      <EventDetailRow icon={NotepadText}>
        <span className="text-foreground">AI meeting notes</span>
      </EventDetailRow>
    </EventDetailSection>
  );
}
