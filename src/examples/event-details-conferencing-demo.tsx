"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { EventDetailPanel } from "@/components/event-detail-panel";
import type {
  ConferenceProviderOption,
  DetailedCalendarEvent,
} from "@/components/calendar-types";

/** How long the made-up service takes to answer, in milliseconds */
const CREATE_DELAY_MS = 800;

/**
 * Your own video call service. `createConference` makes the call for the
 * event and returns its link. In your app, ask your server here: it holds
 * the service's credentials.
 */
const CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [
  {
    provider: "other",
    label: "Acme Meet",
    createConference: async (event) => {
      // The row shows the service as pending until this resolves
      await new Promise((resolve) => setTimeout(resolve, CREATE_DELAY_MS));
      return {
        provider: "other",
        label: "Acme Meet",
        url: `https://meet.example.com/${event.id}`,
        meetingId: event.id,
      };
    },
  },
];

/**
 * A fixed event, built from local date parts so the server and the browser
 * render the same times
 */
const INITIAL_EVENT: DetailedCalendarEvent = {
  id: "roadmap-sync",
  title: "Roadmap sync",
  start: new Date(2026, 10, 4, 14, 0),
  end: new Date(2026, 10, 4, 14, 45),
};

export function EventDetailsConferencingDemo() {
  const [event, setEvent] = React.useState(INITIAL_EVENT);

  return (
    // Without `conferenceProviders` the Conferencing row is hidden
    <CalendarProvider conferenceProviders={CONFERENCE_PROVIDERS}>
      <div className="flex h-full items-start justify-center overflow-y-auto bg-muted/40 p-6">
        <div className="w-[320px] shrink-0 overflow-hidden rounded-lg bg-popover shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/10">
          <EventDetailPanel event={event} onEventChange={setEvent} />
        </div>
      </div>
    </CalendarProvider>
  );
}
