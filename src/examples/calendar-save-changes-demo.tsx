"use client";

import * as React from "react";

import { Calendar } from "@/components/calendar";
import { createSampleEvents } from "@/lib/sample-events";

/** Lines the log keeps */
const MAX_LOG_LINES = 20;

export function CalendarSaveChangesDemo() {
  // The calendar reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  // What your server would have been sent, newest first
  const [log, setLog] = React.useState<string[]>([]);
  const record = (line: string) =>
    setLog((lines) => [line, ...lines].slice(0, MAX_LOG_LINES));

  return (
    <div className="flex h-[600px] flex-col">
      <div className="min-h-0 flex-1">
        <Calendar
          defaultEvents={initialEvents}
          // One call per change: send each to your server from here.
          // Undo and redo report what they change the same way
          onEventCreate={(event) => record(`POST /events "${event.title}"`)}
          onEventUpdate={(event) =>
            record(`PATCH /events/${event.id} "${event.title}"`)
          }
          onEventDelete={(event) => record(`DELETE /events/${event.id}`)}
          // Several calendars share this docs page, so the single-key shortcuts stay off
          shortcuts={false}
        />
      </div>
      <ol
        aria-label="Changes"
        className="h-28 shrink-0 overflow-y-auto border-t p-3 font-mono text-xs"
      >
        {log.length === 0 && (
          <li className="font-sans text-muted-foreground">
            Drag, resize, create or delete an event.
          </li>
        )}
        {log.map((line, index) => (
          <li key={log.length - index}>{line}</li>
        ))}
      </ol>
    </div>
  );
}
