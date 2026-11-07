"use client";

import * as React from "react";
import { format } from "date-fns";

import {
  CalendarProvider,
  useCalendarConfig,
} from "@/components/calendar-provider";
import { EventDetailPanel } from "@/components/event-detail-panel";
import type {
  CalendarInfo,
  ConferenceProviderOption,
  DetailedCalendarEvent,
  EventContact,
  EventReminder,
  EventRoom,
  LocationSuggestion,
} from "@/components/calendar-types";
import { formatRecurrenceRule, getEventRecurrenceRule } from "@/lib/recurrence";

/** Calendars the event can move to, grouped by account in the picker */
const CALENDARS: CalendarInfo[] = [
  { id: "work", name: "Work", color: "blue", email: "you@example.com" },
  {
    id: "personal",
    name: "Personal",
    color: "purple",
    email: "you@example.com",
  },
  { id: "team", name: "Team", color: "green", email: "team@example.com" },
];

/** People the participants field suggests; recent ones show before typing */
const CONTACTS: EventContact[] = [
  { name: "Alex Rivera", email: "alex@example.com", recent: true },
  { name: "Priya Shah", email: "priya@example.com", recent: true },
  { name: "Taylor Kim", email: "taylor@example.com" },
  { name: "Jamie Chen", email: "jamie@example.com" },
];

/** Rooms the participants field offers */
const ROOMS: EventRoom[] = [
  {
    id: "room-4b@example.com",
    name: "Room 4B",
    location: "5th floor",
    capacity: 8,
  },
  {
    id: "atlas@example.com",
    name: "Atlas",
    location: "3rd floor",
    capacity: 12,
  },
];

/** Video call services; call your service's API in `createConference` (it can be async) */
const CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [
  {
    provider: "google-meet",
    label: "Google Meet",
    createConference: () => ({
      provider: "google-meet",
      label: "Google Meet",
      url: "https://meet.example.com/abc-defg-hij",
      meetingId: "abc-defg-hij",
    }),
  },
  {
    provider: "zoom",
    label: "Zoom",
    createConference: () => ({
      provider: "zoom",
      label: "Zoom",
      url: "https://zoom.example.com/j/1234567890",
      meetingId: "123 456 7890",
    }),
  },
];

/** Places the location field suggests as you type */
const LOCATION_SUGGESTIONS: LocationSuggestion[] = [
  { name: "Central Park", address: "New York, NY, USA" },
  { name: "Golden Gate Park", address: "San Francisco, CA, USA" },
  { name: "Hyde Park", address: "London, UK" },
];

/**
 * A fixed event, built from local date parts so the server and the browser
 * render the same times
 */
const INITIAL_EVENT: DetailedCalendarEvent = {
  id: "design-review",
  title: "Design review",
  start: new Date(2026, 10, 4, 14, 0),
  end: new Date(2026, 10, 4, 15, 30),
  calendarId: "work",
  calendarEmail: "you@example.com",
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
    // contacts, rooms, video call services and places. Without one, those
    // sections have nothing to offer, and the rest still work.
    <CalendarProvider
      calendars={CALENDARS}
      contacts={CONTACTS}
      rooms={ROOMS}
      conferenceProviders={CONFERENCE_PROVIDERS}
      locationSuggestions={LOCATION_SUGGESTIONS}
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
