"use client"

import * as React from "react"

import { Calendar } from "@/components/calendar"
import type { DetailedCalendarEvent } from "@/components/calendar-types"

/**
 * A daily "Standup" from Monday, June 1 2026, 9 to 9:30 AM. The ids each
 * callback reports are listed above the calendar, for the series question's
 * tests (e2e/base-ui/series-scope.spec.ts).
 */
const EVENTS: DetailedCalendarEvent[] = [
  {
    id: "standup",
    title: "Standup",
    start: new Date("2026-06-01T09:00:00-04:00"),
    end: new Date("2026-06-01T09:30:00-04:00"),
    color: "blue",
    recurrenceRule: { frequency: "daily" },
  },
]

export default function SeriesScopePage() {
  const [created, setCreated] = React.useState<string[]>([])
  const [updated, setUpdated] = React.useState<string[]>([])
  const [deleted, setDeleted] = React.useState<string[]>([])

  return (
    <main className="flex h-svh flex-col">
      <p aria-label="Created events" className="px-4 text-sm">
        {created.join(", ")}
      </p>
      <p aria-label="Updated events" className="px-4 text-sm">
        {updated.join(", ")}
      </p>
      <p aria-label="Deleted events" className="px-4 text-sm">
        {deleted.join(", ")}
      </p>
      <div className="min-h-0 flex-1">
        <Calendar
          defaultEvents={EVENTS}
          onEventCreate={(event) => setCreated((ids) => [...ids, event.id])}
          onEventUpdate={(event) => setUpdated((ids) => [...ids, event.id])}
          onEventDelete={(event) => setDeleted((ids) => [...ids, event.id])}
        />
      </div>
    </main>
  )
}
