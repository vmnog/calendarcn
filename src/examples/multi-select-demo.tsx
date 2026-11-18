"use client";

import * as React from "react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function MultiSelectDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="flex h-[600px] flex-col">
        <SelectionBar />
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
    </CalendarProvider>
  );
}

/** What is selected, and actions on all of it */
function SelectionBar() {
  const {
    selectedEventIds,
    selectAllVisible,
    clearSelection,
    deleteEvent,
    undo,
    canUndo,
  } = useCalendar();
  const count = selectedEventIds.length;

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground tabular-nums">
        {count === 0
          ? "Shift-click events to select several"
          : `${count} selected`}
      </p>
      <Button variant="outline" size="sm" onClick={selectAllVisible}>
        Select all visible
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={count === 0}
        // On one of several selected events, deleting deletes them all, as one undo step
        onClick={() => deleteEvent(selectedEventIds[0])}
      >
        Delete
      </Button>
      <Button variant="ghost" size="sm" disabled={!canUndo} onClick={undo}>
        Undo
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={count === 0}
        onClick={clearSelection}
      >
        Clear
      </Button>
    </div>
  );
}
