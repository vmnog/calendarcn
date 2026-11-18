"use client";

import * as React from "react";

import {
  CalendarProvider,
  useCalendarNotice,
} from "@/components/calendar-provider";
import { CalendarToaster } from "@/components/calendar-toaster";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarToasterNoticeDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <NoticeButtons />
        {/* The toaster sits at the bottom right of this positioned element */}
        <div className="relative min-h-0 flex-1">
          <WeekView scrollToHour={8} />
          <CalendarToaster />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Your app's own notices, shown where the calendar shows its own */
function NoticeButtons() {
  const { showNotice } = useCalendarNotice();
  const [isMuted, setIsMuted] = React.useState(false);

  const mute = () => {
    setIsMuted(true);
    // `onUndo` adds the Undo button, which calls it
    showNotice({
      message: "Reminders muted",
      onUndo: () => setIsMuted(false),
    });
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => showNotice({ message: "Link copied to clipboard" })}
      >
        Copy link
      </Button>
      <Button variant="outline" size="sm" disabled={isMuted} onClick={mute}>
        Mute reminders
      </Button>
      <p className="text-sm text-muted-foreground">
        Reminders are {isMuted ? "muted" : "on"}
      </p>
    </div>
  );
}
