"use client";

import * as React from "react";
import { addDays } from "date-fns";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function CreateEventButtonDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={4}>
      <div className="flex h-[600px] flex-col">
        <NewEventBar />
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Buttons that start a draft: an event that is saved by its first edit */
function NewEventBar() {
  const { addEventAtNextSlot, startEventDraft, eventDraft } = useCalendar();

  /** A one-hour draft tomorrow at 10 AM */
  const draftTomorrow = () => {
    const tomorrow = addDays(new Date(), 1);
    const at = (hour: number) =>
      new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
        hour,
      );
    startEventDraft({ start: at(10), end: at(11) });
  };

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      {/* At the next half hour, as the C key does in Notion Calendar */}
      <Button size="sm" onClick={addEventAtNextSlot}>
        New event
      </Button>
      <Button variant="outline" size="sm" onClick={draftTomorrow}>
        Tomorrow at 10
      </Button>
      <p className="min-w-0 flex-1 truncate text-right text-sm text-muted-foreground">
        {eventDraft
          ? "A draft: type a title to save it, or press Esc"
          : "No draft"}
      </p>
    </div>
  );
}
