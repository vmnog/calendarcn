"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CalendarSettingsDialog } from "@/components/calendar-settings";
import { Button } from "@/components/ui/button";
import type { CalendarInfo } from "@/components/calendar-types";

/** Two accounts: each gets its own pane in the settings */
const CALENDARS: CalendarInfo[] = [
  {
    id: "personal",
    name: "Personal",
    color: "purple",
    email: "you@example.com",
  },
  { id: "family", name: "Family", color: "orange", email: "you@example.com" },
  { id: "work", name: "Work", color: "blue", email: "you@work.example.com" },
];

/** The account "Add calendar account" connects here */
const TEAM_CALENDAR: CalendarInfo = {
  id: "team",
  name: "Team",
  color: "green",
  email: "team@example.com",
};

export function CalendarSettingsAccountsDemo() {
  const [open, setOpen] = React.useState(false);
  const [calendars, setCalendars] = React.useState(CALENDARS);
  const [hiddenCalendarIds, setHiddenCalendarIds] = React.useState<string[]>(
    [],
  );
  const hasTeam = calendars.includes(TEAM_CALENDAR);

  return (
    // The accounts are the provider's calendars, grouped by their email
    <CalendarProvider calendars={calendars}>
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Manage calendar accounts
        </Button>
        <p className="text-sm text-muted-foreground tabular-nums">
          {calendars.length} calendars, {hiddenCalendarIds.length} hidden
        </p>
      </div>
      <CalendarSettingsDialog
        open={open}
        onOpenChange={setOpen}
        // Opens on the first account instead of General
        defaultSection="calendars"
        // With these two, each calendar gets a button to show or hide it
        hiddenCalendarIds={hiddenCalendarIds}
        onHiddenCalendarIdsChange={setHiddenCalendarIds}
        // Lists "Add calendar account". Connect an account your way
        onAddCalendarAccount={
          hasTeam
            ? undefined
            : () => setCalendars([...calendars, TEAM_CALENDAR])
        }
      />
    </CalendarProvider>
  );
}
