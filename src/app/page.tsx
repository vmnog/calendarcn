"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CalendarApp } from "@/components/calendar-app";
import type {
  CalendarAccountHelpers,
  DetailedCalendarEvent,
  EventColor,
  NewEventRange,
  ViewSettings,
} from "@/components/week-view-types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { pickRandomEventColor } from "@/lib/event-utils";
import {
  DEMO_CALENDARS,
  DEMO_CONTACTS,
  DEMO_LOCATION_SUGGESTIONS,
  DEMO_PRIMARY_CALENDAR_ID,
  DEMO_ROOMS,
  generateContactEvents,
  generateMockEvents,
} from "@/lib/mock-events";
import { DEMO_CONFERENCE_PROVIDERS } from "./demo-conference-providers";
import { DemoSidebarLinks } from "./demo-sidebar-links";

/** Title given to an event created by clicking an empty time slot */
const NEW_EVENT_TITLE = "New event";

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

/** Where "Support & feedback" goes: a new issue on GitHub */
const SUPPORT_URL = "https://github.com/vmnog/calendarcn/issues/new";

/** Where "About CalendarCN" goes: the docs */
const ABOUT_PATH = "/docs";

/** "Support & feedback": a new GitHub issue, in a new tab */
function openSupport() {
  window.open(SUPPORT_URL, "_blank", "noopener,noreferrer");
}

/** "Add calendar account": the demo has no accounts, so it adds an .ics file as a calendar */
function addCalendarAccount({ importIcsCalendar }: CalendarAccountHelpers) {
  importIcsCalendar();
}

/**
 * The live demo: the Calendar App block with the sample data, the
 * conferencing services with their logos, and the demo's own avatar and
 * docs and GitHub links.
 */
export default function Page() {
  const router = useRouter();
  // The app reads its initial events once, so create them once. They're
  // dated from the viewer's today: the calendar renders nothing on the
  // server or during hydration, so the browser's copy is the one shown.
  const [initialEvents] = React.useState(() => generateMockEvents());
  // The sample teammates' weeks, drawn by "Meet with..." and "Show teammate
  // calendar..."; an app would load them (free/busy) when someone is added
  const [contactEvents] = React.useState(() => generateContactEvents());
  /** Color given to the last click-created event, so the next one differs */
  const lastCreatedColorRef = React.useRef<EventColor | null>(null);

  const createDemoEvent = React.useCallback(
    (range: NewEventRange): DetailedCalendarEvent => {
      // Demo choice: a random color per created event makes each click visibly
      // new. A real app would use the target calendar's color instead.
      const color = pickRandomEventColor(lastCreatedColorRef.current);
      lastCreatedColorRef.current = color;
      return {
        id: crypto.randomUUID(),
        title: NEW_EVENT_TITLE,
        start: range.start,
        end: range.end,
        color,
        calendarId: DEMO_PRIMARY_CALENDAR_ID,
        calendarEmail: DEMO_PRIMARY_CALENDAR_ID,
      };
    },
    [],
  );

  return (
    <CalendarApp
      defaultEvents={initialEvents}
      defaultViewSettings={DEMO_VIEW_SETTINGS}
      calendars={DEMO_CALENDARS}
      contacts={DEMO_CONTACTS}
      contactEvents={contactEvents}
      rooms={DEMO_ROOMS}
      conferenceProviders={DEMO_CONFERENCE_PROVIDERS}
      locationSuggestions={DEMO_LOCATION_SUGGESTIONS}
      createEvent={createDemoEvent}
      exportFileName={ICS_EXPORT_FILE_NAME}
      exportCalendarName={ICS_CALENDAR_NAME}
      settingsDialog
      onAddCalendarAccount={addCalendarAccount}
      onSupport={openSupport}
      onAbout={() => router.push(ABOUT_PATH)}
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
