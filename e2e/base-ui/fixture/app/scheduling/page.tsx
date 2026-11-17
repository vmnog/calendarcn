"use client"

import * as React from "react"
import { enUS } from "date-fns/locale"

import { CalendarApp } from "@/components/calendar-app"
import type { SchedulingLinkRequest } from "@/components/calendar-types"
import { ThemeProvider } from "@/components/theme-provider"
import { formatAvailabilityText } from "@/lib/availability"
import { DEMO_CALENDARS, generateMockEvents } from "@/lib/mock-events"

/**
 * Calendar App with scheduling links: `onCreateSchedulingLink` writes each
 * request it gets, and the text a booking page's link would be shared with,
 * into an output the tests read. The way an app with a booking backend
 * wires the scheduling links.
 */
export default function SchedulingPage() {
  // The app reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => generateMockEvents())
  const [requests, setRequests] = React.useState<SchedulingLinkRequest[]>([])

  const lastRequest = requests[requests.length - 1]
  const sharedText = lastRequest
    ? formatAvailabilityText(lastRequest.ranges, {
        durationMinutes: lastRequest.durationMinutes,
        hourCycle: 12,
        locale: enUS,
        link: "https://example.com/meet/you",
      })
    : ""

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <CalendarApp
        defaultEvents={initialEvents}
        calendars={DEMO_CALENDARS}
        onCreateSchedulingLink={(request) =>
          setRequests((current) => [...current, request])
        }
      >
        <output
          data-testid="scheduling-requests"
          className="sr-only"
          aria-label="Scheduling link requests"
        >
          {JSON.stringify(
            requests.map((request) => ({
              ...request,
              ranges: request.ranges.map((range) => ({
                start: range.start.toISOString(),
                end: range.end.toISOString(),
              })),
            }))
          )}
        </output>
        <output data-testid="scheduling-text" className="sr-only">
          {sharedText}
        </output>
      </CalendarApp>
    </ThemeProvider>
  )
}
