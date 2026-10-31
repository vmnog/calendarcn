"use client";

import * as React from "react";
import { format } from "date-fns";

import { EventDetailPanel } from "@/components/event-detail-panel";
import type { DetailedCalendarEvent } from "@/components/calendar-types";

/**
 * A fixed event, built from local date parts so the server and the browser
 * render the same times
 */
const INITIAL_EVENT: DetailedCalendarEvent = {
  id: "design-review",
  title: "Design review",
  start: new Date(2026, 10, 4, 14, 0),
  end: new Date(2026, 10, 4, 15, 30),
  color: "purple",
  location: "Room 4B",
  description: "Walk through the new onboarding flow.",
  recurrence: "Every week on Wed",
  reminders: [{ amount: 10, unit: "minutes" }],
  status: "busy",
  visibility: "default",
  calendarEmail: "team@example.com",
};

export function EventDetailsDemo() {
  const [event, setEvent] = React.useState(INITIAL_EVENT);

  return (
    // Side by side when the container is wide enough, stacked otherwise
    <div className="@container h-full overflow-y-auto bg-muted/40">
      <div className="flex flex-col items-center gap-4 p-6 @xl:flex-row @xl:items-start @xl:justify-center">
        {/* No CalendarProvider needed: the panel only needs an event and a change handler */}
        <div className="w-[320px] shrink-0 overflow-hidden rounded-lg bg-popover shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/10">
          <EventDetailPanel event={event} onEventChange={setEvent} />
        </div>
        <dl className="grid w-[320px] shrink-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-background p-3 text-xs shadow-xs ring-1 ring-black/5 @xl:w-56 dark:shadow-none dark:ring-white/10">
          <dt className="font-mono text-muted-foreground">title</dt>
          <dd className="truncate font-medium">{event.title}</dd>
          <dt className="font-mono text-muted-foreground">start</dt>
          <dd className="tabular-nums">{format(event.start, "EEE p")}</dd>
          <dt className="font-mono text-muted-foreground">end</dt>
          <dd className="tabular-nums">{format(event.end, "EEE p")}</dd>
          <dt className="font-mono text-muted-foreground">color</dt>
          <dd>{event.color}</dd>
        </dl>
      </div>
    </div>
  );
}
