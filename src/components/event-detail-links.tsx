"use client";

import { Link, Paperclip } from "lucide-react";

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
 * One row per link and attached file, or a muted "Add links and
 * attachments" when there are none
 */
export function EventDetailLinks<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  const links = event.links ?? [];
  const attachments = event.attachments ?? [];

  if (links.length === 0 && attachments.length === 0) {
    return (
      <EventDetailSection name="links">
        <EventDetailPlaceholderRow
          icon={Link}
          label="Add links and attachments"
        />
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="links">
      {links.map((link) => (
        <EventDetailRow key={link.url} icon={Link}>
          <span className="text-foreground truncate">
            {link.title ?? link.url}
          </span>
        </EventDetailRow>
      ))}
      {attachments.map((attachment) => (
        <EventDetailRow key={attachment.url} icon={Paperclip}>
          <span className="text-foreground truncate">{attachment.name}</span>
        </EventDetailRow>
      ))}
    </EventDetailSection>
  );
}
