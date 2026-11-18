"use client";

import * as React from "react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { EventDetailPanel } from "@/components/event-detail-panel";
import { WeekView } from "@/components/week-view";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

export function EventDetailsSidePanelDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={3}>
      <div className="flex h-[600px]">
        <div className="min-w-0 flex-1">
          {/* The panel shows the details, so the view opens no popover */}
          <WeekView scrollToHour={8} showEventPopover={false} />
        </div>
        <SidePanel />
      </div>
    </CalendarProvider>
  );
}

/** The selected event's details, wired to the provider as the popover is */
function SidePanel() {
  const {
    selectedEvent,
    eventDraft,
    editEvent,
    updateEventDraft,
    cutEvent,
    copyEvent,
    duplicateEvent,
    deleteEvent,
  } = useCalendar<DetailedCalendarEvent>();

  if (!selectedEvent) {
    return (
      <aside className="w-[320px] shrink-0 border-l p-4 text-sm text-muted-foreground">
        Click an event, or double-click an empty slot to create one.
      </aside>
    );
  }

  const { id } = selectedEvent;

  return (
    <aside className="w-[320px] shrink-0 overflow-y-auto border-l bg-popover">
      <EventDetailPanel
        event={selectedEvent}
        // A change to one date of a repeating event waits until the event
        // is left, then asks which events it applies to
        onEventChange={editEvent}
        // While the event is the unsaved draft, typing its title previews it
        onTitlePreview={eventDraft?.id === id ? updateEventDraft : undefined}
        // The "..." menu: an action you don't pass is disabled
        onCut={() => cutEvent(id)}
        onCopy={() => copyEvent(id)}
        onDuplicate={() => duplicateEvent(id)}
        onDelete={() => deleteEvent(id)}
      />
    </aside>
  );
}
