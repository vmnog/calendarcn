"use client";

import * as React from "react";

import { Calendar } from "@/components/calendar";
import type {
  DetailedCalendarEvent,
  NewEventRange,
} from "@/components/calendar-types";
import { DEMO_CONFERENCE_PROVIDERS } from "@/lib/conference-providers";
import {
  DEMO_CALENDARS,
  DEMO_CONTACTS,
  DEMO_LOCATION_SUGGESTIONS,
  DEMO_PRIMARY_CALENDAR_ID,
  DEMO_ROOMS,
  generateMockEvents,
} from "@/lib/mock-events";

/** New events go on the primary calendar, in its color */
function createEvent(range: NewEventRange): DetailedCalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "New event",
    start: range.start,
    end: range.end,
    color: "red",
    calendarId: DEMO_PRIMARY_CALENDAR_ID,
    calendarEmail: DEMO_PRIMARY_CALENDAR_ID,
  };
}

export function SampleDataDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => generateMockEvents());

  return (
    <Calendar
      defaultEvents={initialEvents}
      calendars={DEMO_CALENDARS}
      contacts={DEMO_CONTACTS}
      rooms={DEMO_ROOMS}
      conferenceProviders={DEMO_CONFERENCE_PROVIDERS}
      locationSuggestions={DEMO_LOCATION_SUGGESTIONS}
      createEvent={createEvent}
    />
  );
}
