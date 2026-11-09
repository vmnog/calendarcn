"use client"

import * as React from "react"

import { CalendarApp } from "@/components/calendar-app"
import { ThemeProvider } from "@/components/theme-provider"
import { DEMO_CONFERENCE_PROVIDERS } from "@/lib/conference-providers"
import {
  DEMO_CALENDARS,
  DEMO_CONTACTS,
  DEMO_LOCATION_SUGGESTIONS,
  DEMO_ROOMS,
  generateMockEvents,
} from "@/lib/mock-events"

/**
 * The live demo installed as one block: `@calendarcn/calendar-app` with the
 * sample data it brings, as the Calendar App docs page renders it. The
 * fixture's layout has no ThemeProvider, so the page adds the block's.
 */
export default function CalendarAppPage() {
  // The app reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => generateMockEvents())

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <CalendarApp
        defaultEvents={initialEvents}
        defaultViewSettings={{ showWeekNumbers: true }}
        calendars={DEMO_CALENDARS}
        contacts={DEMO_CONTACTS}
        rooms={DEMO_ROOMS}
        conferenceProviders={DEMO_CONFERENCE_PROVIDERS}
        locationSuggestions={DEMO_LOCATION_SUGGESTIONS}
        showComingSoon
      />
    </ThemeProvider>
  )
}
