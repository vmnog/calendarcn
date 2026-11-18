"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CommandMenu } from "@/components/command-menu";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function CommandMenuAppCommandsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  const [open, setOpen] = React.useState(false);
  // The last of your app's commands that ran
  const [lastCommand, setLastCommand] = React.useState("none yet");

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Open command menu
          </Button>
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            Your last command: {lastCommand}
          </p>
        </div>
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
      {/* A command of your app is listed only when you pass its callback.
          Here each one says it ran, where your app would do the work */}
      <CommandMenu
        open={open}
        onOpenChange={setOpen}
        onToggleSidebar={() => setLastCommand("Toggle sidebar")}
        onOpenSettings={() => setLastCommand("Go to settings")}
        onSupport={() => setLastCommand("Support & feedback")}
        // Called with the text typed in the menu, or an empty string
        onSearchEvents={(query) =>
          setLastCommand(`Search events${query ? ` for "${query}"` : ""}`)
        }
      />
    </CalendarProvider>
  );
}
