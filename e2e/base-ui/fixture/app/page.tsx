import { Calendar } from "@/components/calendar"
import type { CalendarEvent } from "@/components/calendar-types"

/**
 * Fixed events in the week of Sunday, May 31 2026. The e2e spec freezes the
 * clock on Thursday, June 4 in America/New_York, so the week view opens on
 * this week and the agenda on June 4.
 */
const EVENTS: CalendarEvent[] = [
  {
    id: "design-review",
    title: "Design Review",
    start: new Date("2026-06-04T10:00:00-04:00"),
    end: new Date("2026-06-04T11:00:00-04:00"),
    color: "blue",
  },
  {
    id: "team-offsite",
    title: "Team Offsite",
    start: new Date("2026-06-04T00:00:00-04:00"),
    end: new Date("2026-06-04T00:00:00-04:00"),
    isAllDay: true,
    color: "green",
  },
]

export default function Page() {
  return (
    <main className="h-svh">
      <Calendar defaultEvents={EVENTS} />
    </main>
  )
}
