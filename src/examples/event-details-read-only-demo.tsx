"use client";

import { EventDetailPanel } from "@/components/event-detail-panel";
import type { DetailedCalendarEvent } from "@/components/calendar-types";

/**
 * A fixed event, built from local date parts so the server and the browser
 * render the same times
 */
const EVENT: DetailedCalendarEvent = {
  id: "all-hands",
  title: "Company all-hands",
  start: new Date(2026, 10, 5, 16, 0),
  end: new Date(2026, 10, 5, 17, 0),
  location: "Main stage",
  description: "Quarterly results and what's next. Bring your questions.",
  // Every month on the first Thursday, which November 5 is
  recurrenceRule: { frequency: "monthly", monthlyBy: "weekday-of-month" },
  participants: [
    { email: "ceo@example.com", name: "Dana Whitfield", organizer: true },
    { email: "you@example.com", name: "You", response: "accepted" },
  ],
  reminders: [{ amount: 10, unit: "minutes" }],
};

export function EventDetailsReadOnlyDemo() {
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-muted/40 p-6">
      <div className="w-[320px] shrink-0 overflow-hidden rounded-lg bg-popover shadow-sm ring-1 ring-black/5 dark:shadow-none dark:ring-white/10">
        {/* No `onEventChange`: no field accepts typing, and the menus that
            change the event are disabled */}
        <EventDetailPanel event={EVENT} />
      </div>
    </div>
  );
}
