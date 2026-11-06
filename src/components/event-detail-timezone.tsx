"use client";

import { Globe } from "lucide-react";

import { useTimeZoneDisplayName } from "@/hooks/use-timezone-label";
import {
  EVENT_DETAIL_MUTED_CLASS,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import { getTimeZoneDisplayName } from "@/lib/timezone-label";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/**
 * "GMT-3 Sao Paulo" with the offset muted and the city in full color; a
 * label without a city stays muted
 */
function TimezoneDisplay({ timezone }: { timezone: string }) {
  const spaceIdx = timezone.indexOf(" ");
  if (spaceIdx === -1) {
    return <span className={EVENT_DETAIL_MUTED_CLASS}>{timezone}</span>;
  }

  const code = timezone.substring(0, spaceIdx);
  const city = timezone.substring(spaceIdx + 1);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={EVENT_DETAIL_MUTED_CLASS}>{code}</span>
      <span className="text-foreground">{city}</span>
    </span>
  );
}

/**
 * The event's time zone: its IANA `timeZone`, else the legacy `timezone`
 * label, else the viewer's zone. All-day events have none.
 */
export function EventDetailTimezone<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event }: EventDetailSectionProps<TEvent>) {
  // Empty on the server and during hydration, the viewer's zone afterwards
  const viewerTimeZone = useTimeZoneDisplayName();

  if (event.isAllDay) return null;

  const label = event.timeZone
    ? getTimeZoneDisplayName(event.start, event.timeZone)
    : (event.timezone ?? viewerTimeZone);

  return (
    <EventDetailSection name="timezone">
      <EventDetailRow icon={Globe}>
        <TimezoneDisplay timezone={label} />
      </EventDetailRow>
    </EventDetailSection>
  );
}
