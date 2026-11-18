"use client"

import * as React from "react"

import { Calendar } from "@/components/calendar"
import { useCalendar } from "@/components/calendar-provider"
import type {
  DetailedCalendarEvent,
  NewEventRange,
} from "@/components/calendar-types"

/**
 * An empty calendar for creating events. The titles `onEventCreate` reports
 * are listed above it, so the spec can tell a draft (never reported) from
 * the event it is saved as (reported once). "Start draft" starts one from
 * code with `startEventDraft`, as an app's own button or command would.
 */
const NO_EVENTS: DetailedCalendarEvent[] = []

/** Friday, June 5 2026, 9 to 9:30 AM in New York */
const DRAFT_RANGE: NewEventRange = {
  start: new Date("2026-06-05T09:00:00-04:00"),
  end: new Date("2026-06-05T09:30:00-04:00"),
}

function StartDraftButton() {
  const { startEventDraft } = useCalendar()

  return (
    <button
      type="button"
      className="fixed right-2 bottom-2 z-50 rounded-md border bg-background px-3 py-1.5 text-sm"
      onClick={() => startEventDraft(DRAFT_RANGE)}
    >
      Start draft
    </button>
  )
}

export default function CreatePage() {
  const [created, setCreated] = React.useState<string[]>([])

  return (
    <main className="flex h-svh flex-col">
      <p aria-label="Created events" className="px-4 py-2 text-sm">
        {created.join(", ")}
      </p>
      <div className="min-h-0 flex-1">
        <Calendar
          defaultEvents={NO_EVENTS}
          onEventCreate={(event) =>
            setCreated((titles) => [...titles, event.title || "(untitled)"])
          }
        >
          <StartDraftButton />
        </Calendar>
      </div>
    </main>
  )
}
