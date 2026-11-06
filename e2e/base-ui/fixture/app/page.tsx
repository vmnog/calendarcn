import { Calendar } from "@/components/calendar"
import type { DetailedCalendarEvent } from "@/components/calendar-types"

/**
 * Fixed events in the week of Sunday, May 31 2026. The e2e spec freezes the
 * clock on Thursday, June 4 in America/New_York, so the week view opens on
 * this week and the agenda on June 4.
 */
const EVENTS: DetailedCalendarEvent[] = [
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
  {
    // Links and a file whose addresses must never reach an href
    id: "link-check",
    title: "Link Check",
    start: new Date("2026-06-05T13:00:00-04:00"),
    end: new Date("2026-06-05T14:00:00-04:00"),
    color: "orange",
    links: [
      { url: "javascript:alert(document.domain)", title: "Script link" },
      { url: "data:text/html,<script>alert(1)</script>", title: "Data link" },
      { url: "https://example.com/brief", title: "Brief" },
    ],
    attachments: [
      { name: "payload.html", url: "data:text/html,<script>alert(1)</script>" },
    ],
  },
]

export default function Page() {
  return (
    <main className="h-svh">
      <Calendar defaultEvents={EVENTS} />
    </main>
  )
}
