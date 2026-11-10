"use client"

import * as React from "react"

import { useCalendarShortcuts } from "@/hooks/use-calendar-shortcuts"
import { AgendaView } from "@/components/agenda-view"
import { CalendarHeader } from "@/components/calendar-header"
import { CalendarProvider, useCalendar } from "@/components/calendar-provider"
import type { CalendarEvent } from "@/components/calendar-types"
import { CommandMenu } from "@/components/command-menu"
import { MonthView } from "@/components/month-view"
import { TimeGrid } from "@/components/time-grid"

/** One event on Thursday, June 4 2026, the frozen test date */
const EVENTS: CalendarEvent[] = [
  {
    id: "design-review",
    title: "Design Review",
    start: new Date("2026-06-04T10:00:00-04:00"),
    end: new Date("2026-06-04T11:00:00-04:00"),
    color: "blue",
  },
]

/**
 * The live demo's chrome as a user would put it together: CalendarHeader
 * and CommandMenu around the views, with the app keys from
 * useCalendarShortcuts. The panels are plain asides, and the theme command
 * counts its runs.
 */
export default function HeaderPage() {
  return (
    <CalendarProvider defaultEvents={EVENTS}>
      <AppShell />
    </CalendarProvider>
  )
}

function AppShell() {
  const { view } = useCalendar()
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const [contextPanelOpen, setContextPanelOpen] = React.useState(false)
  const [commandMenuOpen, setCommandMenuOpen] = React.useState(false)
  const [themeChanges, setThemeChanges] = React.useState(0)

  const toggleSidebar = () => setSidebarOpen((open) => !open)
  const toggleContextPanel = () => setContextPanelOpen((open) => !open)
  const cycleTheme = () => setThemeChanges((count) => count + 1)

  useCalendarShortcuts({
    onToggleCommandMenu: () => setCommandMenuOpen((open) => !open),
    onToggleSidebar: toggleSidebar,
    onToggleContextPanel: toggleContextPanel,
    onCycleTheme: cycleTheme,
  })

  return (
    <div className="flex h-svh">
      {sidebarOpen && (
        <aside aria-label="Sidebar" className="w-48 border-r p-3 text-sm">
          Sidebar
        </aside>
      )}
      <main className="flex min-w-0 flex-1 flex-col">
        <CalendarHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          contextPanelOpen={contextPanelOpen}
          onToggleContextPanel={toggleContextPanel}
        >
          <span aria-label="Theme changes">{themeChanges}</span>
        </CalendarHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          {view === "month" && <MonthView />}
          {view === "agenda" && <AgendaView />}
          {(view === "day" || view === "week") && <TimeGrid view={view} />}
        </div>
      </main>
      {contextPanelOpen && (
        <aside aria-label="Context panel" className="w-56 border-l p-3 text-sm">
          Context panel
        </aside>
      )}
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onToggleSidebar={toggleSidebar}
        onToggleContextPanel={toggleContextPanel}
        onCycleTheme={cycleTheme}
      />
    </div>
  )
}
