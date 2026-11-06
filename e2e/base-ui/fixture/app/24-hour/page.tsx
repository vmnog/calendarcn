import { Calendar } from "@/components/calendar"
import type { CalendarEvent } from "@/components/calendar-types"

/**
 * The calendar on a 24-hour clock, for the time menu's spec: "Design Review"
 * on Thursday, June 4 2026, 10:00-11:00 in America/New_York
 */
const EVENTS: CalendarEvent[] = [
  {
    id: "design-review",
    title: "Design Review",
    start: new Date("2026-06-04T10:00:00-04:00"),
    end: new Date("2026-06-04T11:00:00-04:00"),
    color: "blue",
  },
]

export default function Page() {
  return (
    <main className="h-svh">
      <Calendar defaultEvents={EVENTS} hourCycle={24} />
    </main>
  )
}
