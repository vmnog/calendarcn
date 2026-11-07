"use client"

import * as React from "react"

import { Calendar } from "@/components/calendar"
import type { DetailedCalendarEvent } from "@/components/calendar-types"

/**
 * A weekly "Standup" on Thursday, June 4 2026, the only event of its
 * series, so the details' next arrow adds the June 11 occurrence. The ids
 * `onEventCreate` reports are listed above the calendar.
 */
const EVENTS: DetailedCalendarEvent[] = [
  {
    id: "standup",
    title: "Standup",
    start: new Date("2026-06-04T09:00:00-04:00"),
    end: new Date("2026-06-04T09:30:00-04:00"),
    color: "blue",
    recurrenceRule: { frequency: "weekly" },
  },
]

export default function SeriesPage() {
  const [created, setCreated] = React.useState<string[]>([])

  return (
    <main className="flex h-svh flex-col">
      <p aria-label="Created events" className="px-4 py-2 text-sm">
        {created.join(", ")}
      </p>
      <div className="min-h-0 flex-1">
        <Calendar
          defaultEvents={EVENTS}
          onEventCreate={(event) =>
            setCreated((ids) => [...ids, event.id])
          }
        />
      </div>
    </main>
  )
}
