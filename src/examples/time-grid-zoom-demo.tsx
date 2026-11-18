"use client";

import * as React from "react";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { TimeGrid } from "@/components/time-grid";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function TimeGridZoomDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={5}>
      <div className="flex h-[600px] flex-col">
        <ZoomControls />
        <div className="min-h-0 flex-1">
          <TimeGrid view="week" scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** The hour size lives in the provider, so any control can change it */
function ZoomControls() {
  // `hourHeight` is `null` while the hours fill the grid, the default
  const { hourHeight, zoomHoursIn, zoomHoursOut, resetHourHeight } =
    useCalendar();

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
      <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground tabular-nums">
        {hourHeight === null
          ? "Hours fill the grid"
          : `${hourHeight}px an hour`}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={zoomHoursOut}
      >
        <ZoomOutIcon />
        <span className="sr-only">Zoom hours out</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={zoomHoursIn}
      >
        <ZoomInIcon />
        <span className="sr-only">Zoom hours in</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={hourHeight === null}
        onClick={resetHourHeight}
      >
        Reset
      </Button>
    </div>
  );
}
