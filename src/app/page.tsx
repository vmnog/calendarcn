"use client";

import * as React from "react";

import { CalendarApp } from "@/components/calendar-app";
import type {
  DetailedCalendarEvent,
  NewEventRange,
  ViewSettings,
} from "@/components/week-view-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DEMO_CALENDARS,
  DEMO_CONTACTS,
  DEMO_LOCATION_SUGGESTIONS,
  DEMO_PRIMARY_CALENDAR_ID,
  DEMO_ROOMS,
  generateMockEvents,
} from "@/lib/mock-events";
import { DEMO_CONFERENCE_PROVIDERS } from "./demo-conference-providers";
import { DemoSidebarLinks } from "./demo-sidebar-links";

/** Name of the file the command menu's .ics export downloads */
const ICS_EXPORT_FILE_NAME = "calendarcn.ics";

/** Calendar name written into the exported .ics */
const ICS_CALENDAR_NAME = "CalendarCN";

/** Display preferences the demo starts with (week numbers shown) */
const DEMO_VIEW_SETTINGS: ViewSettings = {
  showWeekends: true,
  showDeclinedEvents: true,
  showWeekNumbers: true,
};

/** Cmd+, placeholder: settings aren't built yet, but the key is claimed already */
function openSettings() {}

/** Reminders of a new timed event: the primary calendar's own */
const NEW_EVENT_REMINDERS = DEMO_CALENDARS.find(
  (calendar) => calendar.id === DEMO_PRIMARY_CALENDAR_ID,
)?.defaultReminders;

/**
 * A new event, as Notion Calendar starts one: untitled, on the primary
 * calendar and in its color. A timed one is busy, with the calendar's
 * reminders; an all-day one is free, with none.
 */
function createDemoEvent(range: NewEventRange): DetailedCalendarEvent {
  return {
    id: crypto.randomUUID(),
    title: "",
    start: range.start,
    end: range.end,
    calendarId: DEMO_PRIMARY_CALENDAR_ID,
    calendarEmail: DEMO_PRIMARY_CALENDAR_ID,
    ...(range.isAllDay
      ? { isAllDay: true, status: "free" }
      : { reminders: NEW_EVENT_REMINDERS }),
  };
}

/**
 * The live demo: the Calendar App block with the sample data, the
 * conferencing services with their logos, and the demo's own avatar and
 * docs and GitHub links.
 */
export default function Page() {
  // The app reads its initial events once, so create them once. They're
  // dated from the viewer's today: the calendar renders nothing on the
  // server or during hydration, so the browser's copy is the one shown.
  const [initialEvents] = React.useState(() => generateMockEvents());

  return (
    <CalendarApp
      defaultEvents={initialEvents}
      defaultViewSettings={DEMO_VIEW_SETTINGS}
      calendars={DEMO_CALENDARS}
      contacts={DEMO_CONTACTS}
      rooms={DEMO_ROOMS}
      conferenceProviders={DEMO_CONFERENCE_PROVIDERS}
      locationSuggestions={DEMO_LOCATION_SUGGESTIONS}
      createEvent={createDemoEvent}
      exportFileName={ICS_EXPORT_FILE_NAME}
      exportCalendarName={ICS_CALENDAR_NAME}
      onOpenSettings={openSettings}
      showComingSoon
      sidebarFooterActions={<DemoSidebarLinks />}
      headerActions={
        <Avatar className="size-7">
          <AvatarImage
            src="https://github.com/vmnog.png"
            alt="Victor Nogueira"
          />
          <AvatarFallback>VN</AvatarFallback>
        </Avatar>
      }
    />
  );
}
