"use client"

import * as React from "react"

import { CalendarApp } from "@/components/calendar-app"
import { ThemeProvider } from "@/components/theme-provider"
import { DEMO_CALENDARS, generateMockEvents } from "@/lib/mock-events"

/**
 * `@calendarcn/calendar-app` with its account and app controls on: the
 * settings dialog, and "Add calendar account" adding an .ics file as a
 * calendar, as the live demo does
 */
export default function SettingsPage() {
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
        settingsDialog
        onAddCalendarAccount={({ importIcsCalendar }) => importIcsCalendar()}
      />
    </ThemeProvider>
  )
}
