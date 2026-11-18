"use client";

import * as React from "react";
import { addWeeks } from "date-fns";

import { AgendaView } from "@/components/agenda-view";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { EventDetailPanel } from "@/components/event-detail-panel";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** This week's sample events and next week's, so the list runs past today */
function createTwoWeeks(): DetailedCalendarEvent[] {
  const today = new Date();
  const nextWeek = createSampleEvents(addWeeks(today, 1)).map((event) => ({
    ...event,
    id: `${event.id}-next`,
  }));
  return [...createSampleEvents(today), ...nextWeek];
}

export function AgendaViewPhoneDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createTwoWeeks);

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      {/* A phone's width: the rows stack the title over the time */}
      <div className="mx-auto h-[600px] w-full max-w-[390px] border-x">
        {/* A 320px popover leaves little of a phone screen, so turn it off */}
        <AgendaView showEventPopover={false} />
      </div>
      <EventSheet />
    </CalendarProvider>
  );
}

/** The selected event's details in a sheet, closed by clearing the selection */
function EventSheet() {
  const { selectedEvent, editEvent, clearSelection } =
    useCalendar<DetailedCalendarEvent>();

  return (
    <Sheet
      open={selectedEvent !== null}
      onOpenChange={(open) => {
        if (!open) clearSelection();
      }}
    >
      <SheetContent className="w-[320px] gap-0 overflow-y-auto pt-10">
        <SheetTitle className="sr-only">Event details</SheetTitle>
        <SheetDescription className="sr-only">
          The selected event, editable in place.
        </SheetDescription>
        {selectedEvent && (
          <EventDetailPanel event={selectedEvent} onEventChange={editEvent} />
        )}
      </SheetContent>
    </Sheet>
  );
}
