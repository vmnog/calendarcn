"use client";

import * as React from "react";
import { DoorOpenIcon, UsersIcon } from "lucide-react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type {
  CalendarEvent,
  EventContentProps,
  EventDetailsRenderProps,
  NewEventRange,
} from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Your own event type: the calendar's fields plus anything your app needs */
interface Meeting extends CalendarEvent {
  room: string;
  attendees: string[];
}

/** Rooms handed out to the sample meetings, in turn */
const ROOMS = ["Atlas", "Borealis", "Cosmos"];

/** Attendees handed out to the sample meetings, in turn */
const PEOPLE = ["Ana", "Sam", "Lee", "Kai", "Noor"];

/** Turns the shared sample events into meetings with a room and attendees */
function createSampleMeetings(): Meeting[] {
  return createSampleEvents(new Date()).map((event, index) => ({
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    isAllDay: event.isAllDay,
    color: event.color,
    room: ROOMS[index % ROOMS.length],
    attendees: PEOPLE.slice(0, (index % PEOPLE.length) + 1),
  }));
}

/**
 * Builds the meeting created by clicking an empty slot. Required here: the
 * calendar's default "New event" has no `room` or `attendees`, so
 * TypeScript asks for this factory as soon as `Meeting` adds required fields.
 */
function createMeeting(range: NewEventRange): Meeting {
  return {
    id: crypto.randomUUID(),
    title: "New meeting",
    start: range.start,
    end: range.end,
    color: "blue",
    room: ROOMS[0],
    attendees: [],
  };
}

export function TypedEventsDemo() {
  // `Meeting` is inferred from `defaultEvents`, so every callback and
  // renderer below receives a `Meeting`, not a plain `CalendarEvent`
  const [initialEvents] = React.useState(createSampleMeetings);

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      createEvent={createMeeting}
      renderEventContent={renderMeetingContent}
      renderEventDetails={renderMeetingDetails}
    >
      <WeekView />
    </CalendarProvider>
  );
}

/** Event content with the room under the title */
function renderMeetingContent({
  event,
  isCompact,
}: EventContentProps<Meeting>) {
  return (
    <div className="flex h-full min-w-0 flex-col pt-0.5 text-[0.625rem] leading-tight text-foreground/80">
      <span className="truncate font-semibold">{event.title}</span>
      {!isCompact && (
        <span className="flex items-center gap-0.5 opacity-80">
          <DoorOpenIcon strokeWidth={1.5} className="size-2.5 shrink-0" />
          <span className="truncate">{event.room}</span>
        </span>
      )}
    </div>
  );
}

/** Popover body for a meeting */
function renderMeetingDetails(props: EventDetailsRenderProps<Meeting>) {
  return <MeetingDetails {...props} />;
}

function MeetingDetails({ event, close }: EventDetailsRenderProps<Meeting>) {
  const { updateEvent } = useCalendar<Meeting>();

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      <p className="font-semibold">{event.title}</p>
      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <DoorOpenIcon strokeWidth={1.5} className="size-3.5" />
          {event.room}
        </span>
        <span className="flex items-center gap-1.5">
          <UsersIcon strokeWidth={1.5} className="size-3.5" />
          {event.attendees.length > 0
            ? event.attendees.join(", ")
            : "No attendees yet"}
        </span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            updateEvent({
              ...event,
              room: ROOMS[(ROOMS.indexOf(event.room) + 1) % ROOMS.length],
            })
          }
        >
          Change room
        </Button>
        <Button variant="ghost" size="sm" onClick={close}>
          Done
        </Button>
      </div>
    </div>
  );
}
