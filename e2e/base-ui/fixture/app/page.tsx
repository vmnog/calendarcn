"use client"

import { Calendar } from "@/components/calendar"
import type {
  CalendarEvent,
  ConferenceProviderOption,
  EventConference,
} from "@/components/calendar-types"

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

/**
 * Two made-up services of the same kind, one answering at once and one
 * after a wait, with calls on example.com
 */
const CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [
  {
    provider: "other",
    label: "Video call",
    createConference: () => ({
      provider: "other",
      url: "https://example.com/call/abc-defg-hij",
      meetingId: "abc-defg-hij",
    }),
  },
  {
    provider: "other",
    label: "Backup call",
    createConference: () =>
      new Promise<EventConference>((resolve) => {
        setTimeout(
          () =>
            resolve({
              provider: "other",
              url: "https://example.com/backup/klm-nopq-rst",
              meetingId: "klm-nopq-rst",
            }),
          300
        )
      }),
  },
]

export default function Page() {
  return (
    <main className="h-svh">
      <Calendar
        defaultEvents={EVENTS}
        conferenceProviders={CONFERENCE_PROVIDERS}
      />
    </main>
  )
}
