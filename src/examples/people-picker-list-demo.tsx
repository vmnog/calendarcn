"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { useCalendarPeople } from "@/components/calendar-people";
import { CalendarProvider } from "@/components/calendar-provider";
import { PeoplePicker } from "@/components/people-picker";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { DEMO_CONTACTS, generateContactEvents } from "@/lib/mock-events";
import { createSampleEvents } from "@/lib/sample-events";

export function PeoplePickerListDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  // Other people's events, by email: the sample data's
  const [contactEvents] = React.useState(() => generateContactEvents());

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      contacts={DEMO_CONTACTS}
      contactEvents={contactEvents}
      // Start in a meeting with Alex
      defaultMeetWith={["alex@example.com"]}
      defaultNumberOfDays={5}
    >
      <div className="flex h-[600px] flex-col">
        <MeetingBar />
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Who the meeting is with, each removable: your own list, without a sidebar */
function MeetingBar() {
  const [open, setOpen] = React.useState(false);
  // The people are provider state, so the picker and this list stay in sync
  const { meetWith, contacts, removeMeetWith } = useCalendarPeople();

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b px-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Meet with...
      </Button>
      {meetWith.map((email) => (
        <Button
          key={email}
          variant="secondary"
          size="sm"
          onClick={() => removeMeetWith(email)}
        >
          {contacts.find((contact) => contact.email === email)?.name ?? email}
          <XIcon />
          <span className="sr-only">Stop meeting with them</span>
        </Button>
      ))}
      {/* The people already in the meeting are left out of its list */}
      <PeoplePicker open={open} onOpenChange={setOpen} mode="meet-with" />
    </div>
  );
}
