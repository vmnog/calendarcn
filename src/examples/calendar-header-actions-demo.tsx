"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";

import { AgendaView } from "@/components/agenda-view";
import { CalendarHeader } from "@/components/calendar-header";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { TimeGrid } from "@/components/time-grid";
import { YearView } from "@/components/year-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarHeaderActionsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        {/* No panel props, so no panel toggles. Children sit before the
            view switcher, while the header is at least 36rem wide */}
        <CalendarHeader>
          <NewEventButton />
        </CalendarHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <Body />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** Starts a draft at the next half hour, as the C key does in Notion Calendar */
function NewEventButton() {
  const { addEventAtNextSlot } = useCalendar();

  return (
    <Button size="sm" onClick={addEventAtNextSlot}>
      <PlusIcon />
      New event
    </Button>
  );
}

/** The view switcher sets the provider's view: render the one it is on */
function Body() {
  const { view } = useCalendar();

  if (view === "month") return <MonthView />;
  if (view === "agenda") return <AgendaView />;
  if (view === "year") return <YearView />;
  return <TimeGrid view={view} scrollToHour={8} />;
}
