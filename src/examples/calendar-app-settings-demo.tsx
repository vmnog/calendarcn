"use client";

import * as React from "react";
import { CircleHelpIcon } from "lucide-react";

import { CalendarApp } from "@/components/calendar-app";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DEMO_CALENDARS,
  DEMO_CONTACTS,
  generateMockEvents,
} from "@/lib/mock-events";

/** Where "Support & feedback" and the sidebar's help button go */
const HELP_URL = "https://calendarcn.xyz/docs";

export function CalendarAppSettingsDemo() {
  // The app reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => generateMockEvents());

  return (
    <CalendarApp
      defaultEvents={initialEvents}
      calendars={DEMO_CALENDARS}
      contacts={DEMO_CONTACTS}
      // The settings dialog: ⌘, and "Go to settings" in the command menu open it
      settingsDialog
      // "Add calendar account" in the sidebar, the command menu and the
      // settings. Connect an account your way; here an .ics file becomes one
      onAddCalendarAccount={({ importIcsCalendar }) => importIcsCalendar()}
      // "Support & feedback" in the command menu
      onSupport={() => window.open(HELP_URL, "_blank", "noopener,noreferrer")}
      // Before the view switcher, on wide headers
      headerActions={
        <Avatar className="size-7">
          <AvatarFallback>AR</AvatarFallback>
        </Avatar>
      }
      // In the sidebar's footer, before the theme toggle
      sidebarFooterActions={
        <Button variant="ghost" size="icon" className="size-7" asChild>
          <a href={HELP_URL} target="_blank" rel="noreferrer">
            <CircleHelpIcon />
            <span className="sr-only">Help</span>
          </a>
        </Button>
      }
    />
  );
}
