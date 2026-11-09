"use client"

import * as React from "react"

import { useCalendarShortcuts } from "@/hooks/use-calendar-shortcuts"
import { CalendarProvider } from "@/components/calendar-provider"
import { CalendarSidebar } from "@/components/calendar-sidebar"
import type {
  CalendarInfo,
  DetailedCalendarEvent,
} from "@/components/calendar-types"
import {
  CONTEXT_PANEL_WIDTH,
  DetailsSidebar,
} from "@/components/details-sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { TimeGrid } from "@/components/time-grid"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"

/** Two accounts' calendars, one of them subscribed */
const CALENDARS: CalendarInfo[] = [
  {
    id: "you@example.com",
    name: "you@example.com",
    color: "red",
    email: "you@example.com",
  },
  {
    id: "holidays",
    name: "Holidays",
    color: "green",
    email: "you@example.com",
    isSubscribed: true,
  },
  { id: "work", name: "Work", color: "blue", email: "you@work.example.com" },
]

/** Events in the week of Sunday, May 31 2026, the frozen test week */
const EVENTS: DetailedCalendarEvent[] = [
  {
    id: "design-review",
    title: "Design Review",
    start: new Date("2026-06-04T10:00:00-04:00"),
    end: new Date("2026-06-04T11:00:00-04:00"),
    calendarId: "work",
    color: "blue",
  },
  {
    id: "lunch",
    title: "Lunch",
    start: new Date("2026-06-05T12:00:00-04:00"),
    end: new Date("2026-06-05T13:00:00-04:00"),
    calendarId: "you@example.com",
    color: "red",
  },
]

/**
 * The calendar sidebar and the details sidebar around the week's time grid
 * (the calendar block installs TimeGrid, not WeekView), the way
 * the CalendarCN demo lays them out: inline on wide screens, sheets on
 * phones
 */
export default function SidebarsPage() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <CalendarProvider defaultEvents={EVENTS} calendars={CALENDARS}>
        <SidebarProvider
          className="h-svh"
          style={
            { "--sidebar-width": CONTEXT_PANEL_WIDTH } as React.CSSProperties
          }
        >
          <Layout />
        </SidebarProvider>
      </CalendarProvider>
    </ThemeProvider>
  )
}

function Layout() {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar()
  const [overlayOpen, setOverlayOpen] = React.useState(false)
  const panelOpen = isMobile ? openMobile : open
  // Escape deselects, as in the demo
  useCalendarShortcuts()

  return (
    <>
      <CalendarSidebar
        open={isMobile ? overlayOpen : true}
        onOpenChange={setOverlayOpen}
        overlay={isMobile}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 px-2">
          <button type="button" onClick={() => setOverlayOpen(true)}>
            Open calendar sidebar
          </button>
          <button type="button" onClick={toggleSidebar}>
            Toggle context panel
          </button>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          <TimeGrid view="week" showEventPopover={!panelOpen} />
        </div>
      </main>
      <DetailsSidebar overlay={isMobile} />
    </>
  )
}
