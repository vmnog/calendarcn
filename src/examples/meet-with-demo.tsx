"use client";

import * as React from "react";

import { useCalendarPeople } from "@/components/calendar-people";
import { CalendarProvider } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { EventContact } from "@/components/calendar-types";
import { generateContactEvents } from "@/lib/mock-events";
import { createSampleEvents } from "@/lib/sample-events";

/** The people you can meet with. Sample data has a week of events for each */
const CONTACTS: EventContact[] = [
  { name: "Priya Shah", email: "priya@example.com" },
  { name: "Alex Rivera", email: "alex@example.com" },
  { name: "Sam Lee", email: "sam@example.com" },
];

export function MeetWithDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  // Other people's events, by email. Load yours when `onMeetWithChange` or
  // `onVisibleRangeChange` fires, from your calendar API's free/busy
  const [contactEvents] = React.useState(() => generateContactEvents());

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      contacts={CONTACTS}
      contactEvents={contactEvents}
      // Start in a meeting with Priya
      defaultMeetWith={["priya@example.com"]}
      defaultNumberOfDays={5}
    >
      <div className="flex h-[600px] flex-col">
        <People />
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Your own control for who the meeting is with */
function People() {
  const { contacts, meetWith, addMeetWith, removeMeetWith } =
    useCalendarPeople();

  return (
    <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
      <p className="text-sm text-muted-foreground">Meet with</p>
      {contacts.map(({ email, name }) => {
        const isIn = meetWith.includes(email);
        return (
          <Button
            key={email}
            variant={isIn ? "secondary" : "outline"}
            size="sm"
            aria-pressed={isIn}
            onClick={() => (isIn ? removeMeetWith(email) : addMeetWith(email))}
          >
            {name ?? email}
          </Button>
        );
      })}
    </div>
  );
}
