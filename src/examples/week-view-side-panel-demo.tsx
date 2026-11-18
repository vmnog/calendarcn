"use client";

import * as React from "react";
import { format } from "date-fns";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

export function WeekViewSidePanelDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={4}>
      {/* The panel sits beside the view when there's room, below it otherwise */}
      <div className="@container h-[600px]">
        <div className="flex h-full flex-col @lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            {/* No popover beside the event: the panel shows the selection */}
            <WeekView scrollToHour={8} showEventPopover={false} />
          </div>
          <SidePanel />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** The selected event, read from the provider */
function SidePanel() {
  const { selectedEvent, editEvent, deleteEvent, clearSelection } =
    useCalendar<DetailedCalendarEvent>();

  if (!selectedEvent) {
    return (
      <aside className="h-40 shrink-0 border-t p-4 text-sm text-muted-foreground @lg:h-auto @lg:w-56 @lg:border-t-0 @lg:border-l">
        Click an event to see it here.
      </aside>
    );
  }

  return (
    <aside className="flex h-40 shrink-0 flex-col gap-3 border-t p-4 text-sm @lg:h-auto @lg:w-56 @lg:border-t-0 @lg:border-l">
      <input
        aria-label="Title"
        placeholder="Title"
        value={selectedEvent.title}
        // A new event is a draft until its first edit: typing a title saves it
        onChange={(e) => editEvent({ ...selectedEvent, title: e.target.value })}
        className="rounded-sm bg-transparent font-semibold outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <p className="text-xs text-muted-foreground tabular-nums">
        {selectedEvent.isAllDay
          ? `${format(selectedEvent.start, "EEE, MMM d")}, all day`
          : `${format(selectedEvent.start, "EEE, MMM d, p")} – ${format(selectedEvent.end, "p")}`}
      </p>
      {selectedEvent.location && (
        <p className="text-xs">{selectedEvent.location}</p>
      )}
      <div className="mt-auto flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => deleteEvent(selectedEvent.id)}
        >
          Delete
        </Button>
        <Button variant="ghost" size="sm" onClick={clearSelection}>
          Close
        </Button>
      </div>
    </aside>
  );
}
