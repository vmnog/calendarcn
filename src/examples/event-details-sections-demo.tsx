"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { EventDetailParticipants } from "@/components/event-detail-participants";
import {
  EventDetailDivider,
  EventDetailGroup,
} from "@/components/event-detail-parts";
import { EventDetailTime } from "@/components/event-detail-time";
import type {
  DetailedCalendarEvent,
  EventContact,
  EventDetailSectionProps,
} from "@/components/calendar-types";

/** People the participants field suggests */
const CONTACTS: EventContact[] = [
  { name: "Priya Shah", email: "priya@example.com", recent: true },
  { name: "Alex Rivera", email: "alex@example.com", recent: true },
  { name: "Sam Lee", email: "sam@example.com" },
];

/**
 * A fixed event, built from local date parts so the server and the browser
 * render the same times
 */
const INITIAL_EVENT: DetailedCalendarEvent = {
  id: "kickoff",
  title: "Project kickoff",
  start: new Date(2026, 10, 4, 10, 0),
  end: new Date(2026, 10, 4, 11, 0),
  calendarEmail: "you@example.com",
};

export function EventDetailsSectionsDemo() {
  const [event, setEvent] = React.useState(INITIAL_EVENT);

  return (
    // The provider supplies the contacts the participants field suggests
    <CalendarProvider contacts={CONTACTS}>
      <div className="flex h-full items-start justify-center overflow-y-auto bg-muted/40 p-6">
        <div className="w-[320px] shrink-0 rounded-lg bg-popover shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/10">
          <h3 className="px-4 pt-3 text-sm font-semibold">{event.title}</h3>
          <WhenAndWho event={event} onEventChange={setEvent} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Two of the panel's sections, in a layout of your own */
function WhenAndWho({ event, onEventChange }: EventDetailSectionProps) {
  return (
    <div className="flex flex-col text-sm font-medium">
      <EventDetailGroup name="when">
        <EventDetailTime event={event} onEventChange={onEventChange} />
      </EventDetailGroup>
      <EventDetailDivider />
      <EventDetailGroup name="who">
        <EventDetailParticipants event={event} onEventChange={onEventChange} />
      </EventDetailGroup>
    </div>
  );
}
