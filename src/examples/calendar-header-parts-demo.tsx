"use client";

import * as React from "react";

import { AgendaView } from "@/components/agenda-view";
import {
  CalendarNavigation,
  CalendarPeriodLabel,
  CalendarViewSwitcher,
} from "@/components/calendar-header";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { TimeGrid } from "@/components/time-grid";
import { YearView } from "@/components/year-view";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarHeaderPartsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      defaultViewSettings={{ showWeekNumbers: true }}
    >
      <div className="flex h-[600px] flex-col">
        <Toolbar />
        <div className="flex min-h-0 flex-1 flex-col">
          <Body />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** A header of your own, built from the Calendar Header's parts */
function Toolbar() {
  const { monthName, year } = useCalendar();

  return (
    // The parts follow the header's width: name the container `header`
    <header className="@container/header flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
        {monthName} {year}
        {/* "Week 23" while week numbers are on, the day in day view */}
        <CalendarPeriodLabel className="ml-2 text-xs font-normal text-muted-foreground" />
      </h2>
      <CalendarViewSwitcher />
      <CalendarNavigation buttonClassName="size-8" />
    </header>
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
