import { CalendarProvider } from "@/components/calendar-provider"
import { EventDetailPanel } from "@/components/event-detail-panel"
import type {
  ConferenceProviderOption,
  DetailedCalendarEvent,
  EventContact,
  EventRoom,
} from "@/components/calendar-types"

/** Contacts and rooms the field would suggest, were it editable */
const CONTACTS: EventContact[] = [
  { name: "Recent Person", email: "recent@example.com", recent: true },
]
const ROOMS: EventRoom[] = [{ id: "room-2@example.com", name: "Room 2" }]

/** A service the call's menu would offer, were it editable */
const CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [
  {
    provider: "other",
    label: "Video call",
    createConference: () => ({
      provider: "other",
      url: "https://example.com/call/new",
    }),
  },
]

/** An event with guests, a room, a call and a place, all on example.com */
const EVENT: DetailedCalendarEvent = {
  id: "read-only",
  title: "Read-only review",
  start: new Date("2026-06-04T10:00:00-04:00"),
  end: new Date("2026-06-04T11:00:00-04:00"),
  color: "blue",
  calendarEmail: "owner@example.com",
  participants: [
    {
      email: "owner@example.com",
      organizer: true,
      response: "accepted",
    },
    { name: "Guest One", email: "guest@example.com" },
  ],
  rooms: [{ id: "room@example.com", name: "Room 1", capacity: 4 }],
  conference: {
    provider: "other",
    url: "https://example.com/call/abc-defg-hij",
    meetingId: "abc-defg-hij",
  },
  location: "Central Park",
}

/**
 * The details panel without `onEventChange`, in a provider with contacts,
 * rooms and conferencing: everything is shown, nothing edits
 */
export default function ReadOnlyPage() {
  return (
    <CalendarProvider
      contacts={CONTACTS}
      rooms={ROOMS}
      conferenceProviders={CONFERENCE_PROVIDERS}
    >
      <main className="w-[320px]">
        <EventDetailPanel event={EVENT} />
      </main>
    </CalendarProvider>
  )
}
