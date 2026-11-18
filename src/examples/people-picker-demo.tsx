"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { PeoplePicker } from "@/components/people-picker";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { PeoplePickerMode } from "@/components/calendar-types";
import { DEMO_CONTACTS, generateContactEvents } from "@/lib/mock-events";
import { createSampleEvents } from "@/lib/sample-events";

export function PeoplePickerDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  // Other people's events, by email: the sample data's
  const [contactEvents] = React.useState(() => generateContactEvents());
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<PeoplePickerMode>("meet-with");

  const openPicker = (nextMode: PeoplePickerMode) => {
    setMode(nextMode);
    setOpen(true);
  };

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      // The people the picker searches
      contacts={DEMO_CONTACTS}
      contactEvents={contactEvents}
      defaultNumberOfDays={5}
    >
      <div className="flex h-[600px] flex-col">
        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPicker("meet-with")}
          >
            Meet with...
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPicker("teammate")}
          >
            Show teammate calendar...
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
      {/* Buttons here. In your app, F and P can open it too:
          useCalendarShortcuts({ onMeetWith, onShowTeammateCalendar }) */}
      <PeoplePicker open={open} onOpenChange={setOpen} mode={mode} />
    </CalendarProvider>
  );
}
