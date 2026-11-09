"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { useCalendarShortcuts } from "@/hooks/use-calendar-shortcuts";
import { AgendaView } from "@/components/agenda-view";
import { CalendarHeader } from "@/components/calendar-header";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { MonthView } from "@/components/month-view";
import { TimeGrid } from "@/components/time-grid";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarHeaderDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <CalendarLayout />
    </CalendarProvider>
  );
}

/** Your app's panels around the calendar, with the header on top */
function CalendarLayout() {
  const { view } = useCalendar();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [contextPanelOpen, setContextPanelOpen] = React.useState(false);

  const toggleSidebar = () => setSidebarOpen((open) => !open);
  const toggleContextPanel = () => setContextPanelOpen((open) => !open);

  // T, J/K, D/W/M/A and the panels' keys: ⌘/ for the sidebar, / for the context panel
  useCalendarShortcuts({
    onToggleSidebar: toggleSidebar,
    onToggleContextPanel: toggleContextPanel,
  });

  return (
    <div className="flex h-full">
      {sidebarOpen && (
        <aside className="w-44 shrink-0 border-r p-3 text-sm text-muted-foreground">
          Sidebar
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <CalendarHeader
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          contextPanelOpen={contextPanelOpen}
          onToggleContextPanel={toggleContextPanel}
        >
          <Avatar className="size-7">
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        </CalendarHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          {view === "month" && <MonthView />}
          {view === "agenda" && <AgendaView />}
          {(view === "day" || view === "week") && (
            <TimeGrid view={view} scrollToHour={8} />
          )}
        </div>
      </div>
      {contextPanelOpen && (
        <aside className="flex w-56 shrink-0 items-start justify-between border-l p-3 text-sm text-muted-foreground">
          Context panel
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={toggleContextPanel}
          >
            <XIcon />
            <span className="sr-only">Close context panel</span>
          </Button>
        </aside>
      )}
    </div>
  );
}
