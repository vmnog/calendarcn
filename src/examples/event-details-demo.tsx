"use client";

import * as React from "react";
import { format } from "date-fns";

import {
  CalendarProvider,
  useCalendarConfig,
} from "@/components/calendar-provider";
import { EventDetailPanel } from "@/components/event-detail-panel";
import type {
  DetailedCalendarEvent,
  EventReminder,
} from "@/components/calendar-types";
import { DEMO_CONFERENCE_PROVIDERS } from "@/lib/conference-providers";
import {
  DEMO_CALENDARS,
  DEMO_CONTACTS,
  DEMO_LOCATION_SUGGESTIONS,
  DEMO_ROOMS,
} from "@/lib/mock-events";
import { formatRecurrenceRule, getEventRecurrenceRule } from "@/lib/recurrence";

/**
 * A fixed event, built from local date parts so the server and the browser
 * render the same times
 */
const INITIAL_EVENT: DetailedCalendarEvent = {
  id: "design-review",
  title: "Design review",
  start: new Date(2026, 10, 4, 14, 0),
  end: new Date(2026, 10, 4, 15, 30),
  calendarId: "Work",
  calendarEmail: "you@work.example.com",
  location: "Room 4B",
  description: "Walk through the new onboarding flow.",
  // Every week on Wednesday
  recurrenceRule: { frequency: "weekly", weekdays: [3] },
  reminders: [{ amount: 10, unit: "minutes" }],
  status: "busy",
  visibility: "default",
};

/** "10 minutes", "1 day at 9:00" */
function formatReminder({ amount, unit, time }: EventReminder): string {
  const units = amount === 1 ? unit.slice(0, -1) : unit;
  if (!time) return `${amount} ${units}`;
  const minutes = String(time.minutes).padStart(2, "0");
  return `${amount} ${units} at ${time.hours}:${minutes}`;
}

/** The values joined, or nothing for an empty list */
function joinList(values: string[] | undefined): string | undefined {
  return values?.length ? values.join(", ") : undefined;
}

/** Every field the panel edits, as the event holds it */
function EventState({ event }: { event: DetailedCalendarEvent }) {
  const { locale } = useCalendarConfig();
  const rule = getEventRecurrenceRule(event);

  const fields: [string, string | undefined][] = [
    ["title", event.title],
    ["kind", event.kind],
    ["start", format(event.start, "EEE MMM d, p", { locale })],
    ["end", format(event.end, "EEE MMM d, p", { locale })],
    ["isAllDay", String(Boolean(event.isAllDay))],
    ["timeZone", event.timeZone],
    [
      "recurrenceRule",
      rule ? formatRecurrenceRule(rule, event.start, locale) : undefined,
    ],
    [
      "participants",
      joinList(
        event.participants?.map((p) =>
          [
            p.name ?? p.email,
            p.organizer && "(organizer)",
            p.optional && "(optional)",
          ]
            .filter(Boolean)
            .join(" "),
        ),
      ),
    ],
    ["rooms", joinList(event.rooms?.map((room) => room.name))],
    ["conference", event.conference?.url],
    ["aiMeetingNotes", String(Boolean(event.aiMeetingNotes))],
    ["location", event.location],
    ["links", joinList(event.links?.map((link) => link.url))],
    ["attachments", joinList(event.attachments?.map((file) => file.name))],
    ["description", event.description],
    ["calendarId", event.calendarId],
    ["color", event.color],
    ["status", event.status],
    ["visibility", event.visibility],
    ["reminders", joinList(event.reminders?.map(formatReminder))],
  ];

  return (
    <dl className="grid w-[320px] shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-background p-3 text-xs shadow-xs ring-1 ring-black/5 @xl:w-72 dark:shadow-none dark:ring-white/10">
      {fields.map(([name, value]) => (
        <React.Fragment key={name}>
          <dt className="font-mono text-muted-foreground">{name}</dt>
          <dd
            className={
              value === undefined
                ? "text-muted-foreground"
                : "line-clamp-2 break-words tabular-nums"
            }
          >
            {value ?? "—"}
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function EventDetailsDemo() {
  const [event, setEvent] = React.useState(INITIAL_EVENT);

  return (
    // The provider supplies what the panel offers to pick from: calendars,
    // contacts, rooms, video call services and places, here the live demo's
    // (@calendarcn/sample-data and @calendarcn/conference-providers). Without
    // one, those sections have nothing to offer, and the rest still work.
    <CalendarProvider
      calendars={DEMO_CALENDARS}
      contacts={DEMO_CONTACTS}
      rooms={DEMO_ROOMS}
      conferenceProviders={DEMO_CONFERENCE_PROVIDERS}
      locationSuggestions={DEMO_LOCATION_SUGGESTIONS}
    >
      {/* Side by side when the container is wide enough, stacked otherwise */}
      <div className="@container h-full overflow-y-auto bg-muted/40">
        <div className="flex flex-col items-center gap-4 p-6 @xl:flex-row @xl:items-start @xl:justify-center">
          <div className="w-[320px] shrink-0 overflow-hidden rounded-lg bg-popover shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/10">
            <EventDetailPanel event={event} onEventChange={setEvent} />
          </div>
          <EventState event={event} />
        </div>
      </div>
    </CalendarProvider>
  );
}
