"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { PeoplePicker } from "@/components/people-picker";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { DEMO_CONTACTS, generateContactEvents } from "@/lib/mock-events";
import { createSampleEvents } from "@/lib/sample-events";

export function PeoplePickerTeammatesDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  const [open, setOpen] = React.useState(false);
  // Your app owns whose calendars show: the picker reports each change
  const [teammates, setTeammates] = React.useState<string[]>([]);
  // Their events by email, loaded as people are added
  const [contactEvents, setContactEvents] = React.useState<
    Record<string, DetailedCalendarEvent[]>
  >({});

  const handleTeammatesChange = (emails: string[]) => {
    setTeammates(emails);
    // Stands in for a request to your calendar API for these people's events
    const everyone = generateContactEvents();
    setContactEvents(
      Object.fromEntries(emails.map((email) => [email, everyone[email] ?? []])),
    );
  };

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      contacts={DEMO_CONTACTS}
      teammates={teammates}
      onTeammatesChange={handleTeammatesChange}
      contactEvents={contactEvents}
      defaultNumberOfDays={5}
    >
      <div className="flex h-[600px] flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Show teammate calendar...
          </Button>
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            {teammates.length > 0 ? teammates.join(", ") : "Nobody yet"}
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
      {/* "teammate" shows their calendar, without a meeting */}
      <PeoplePicker open={open} onOpenChange={setOpen} mode="teammate" />
    </CalendarProvider>
  );
}
