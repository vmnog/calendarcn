"use client";

import * as React from "react";

import { CalendarApp } from "@/components/calendar-app";
import type {
  CalendarInfo,
  DetailedCalendarEvent,
  EventContact,
  NewEventRange,
} from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Account the team's calendars belong to */
const TEAM_ACCOUNT = "team@acme.example";

/** Your calendars: the sidebar lists them, and the details' picker offers them */
const CALENDARS: CalendarInfo[] = [
  { id: "team", name: "Team", color: "blue", email: TEAM_ACCOUNT },
  { id: "launches", name: "Launches", color: "red", email: TEAM_ACCOUNT },
];

/** The people to invite, and to meet with */
const CONTACTS: EventContact[] = [
  { name: "Priya Shah", email: "priya@acme.example", recent: true },
  { name: "Alex Rivera", email: "alex@acme.example", recent: true },
];

/** Stands in for your API: this week's sample events, on the two calendars */
function loadEvents(): DetailedCalendarEvent[] {
  return createSampleEvents(new Date()).map((event, index) => ({
    ...event,
    // Without a color of its own, an event takes its calendar's
    color: undefined,
    calendarId: index % 4 === 0 ? "launches" : "team",
    calendarEmail: TEAM_ACCOUNT,
  }));
}

/** New events go on the Team calendar, untitled until they are named */
function createEvent(range: NewEventRange): DetailedCalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "",
    ...range,
    calendarId: "team",
    calendarEmail: TEAM_ACCOUNT,
  };
}

export function CalendarAppDataDemo() {
  // Your app owns the events: the app reports every change as the next list
  const [events, setEvents] = React.useState(loadEvents);

  return (
    // The app fills the viewport, so give it a page of its own
    <CalendarApp
      events={events}
      onEventsChange={setEvents}
      calendars={CALENDARS}
      contacts={CONTACTS}
      createEvent={createEvent}
    />
  );
}
