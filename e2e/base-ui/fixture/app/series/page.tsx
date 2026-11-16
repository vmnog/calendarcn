"use client"

import * as React from "react"

import { Calendar } from "@/components/calendar"
import type { DetailedCalendarEvent } from "@/components/calendar-types"

/**
 * A weekly "Standup" from Thursday, June 4 2026, drawn every Thursday: the
 * details' next arrow selects the June 11 occurrence, and its first edit
 * stores it, which `onEventCreate` reports. The ids it reports are listed
 * above the calendar.
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
