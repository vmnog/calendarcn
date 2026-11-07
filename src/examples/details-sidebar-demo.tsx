"use client";

import * as React from "react";
import { PanelRightIcon } from "lucide-react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import {
  CONTEXT_PANEL_WIDTH,
  DetailsSidebar,
} from "@/components/details-sidebar";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { createSampleEvents } from "@/lib/sample-events";

export function DetailsSidebarDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={3}>
      {/* The inline panel is position: fixed; the transform keeps it in this frame */}
      <SidebarProvider
        className="h-full min-h-0 [transform:translateZ(0)]"
        style={
          { "--sidebar-width": CONTEXT_PANEL_WIDTH } as React.CSSProperties
        }
      >
        <CalendarWithDetails />
      </SidebarProvider>
    </CalendarProvider>
  );
}

function CalendarWithDetails() {
  // Phones get the panel as an overlay; the open state is the SidebarProvider's
  const { isMobile, open, openMobile, setOpenMobile, toggleSidebar } =
    useSidebar();
  const { monthName, year } = useCalendar();
  const panelOpen = isMobile ? openMobile : open;

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 px-4">
          <h2 className="flex-1 truncate text-base font-extrabold">
            {monthName} {year}
          </h2>
          {!panelOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              onClick={toggleSidebar}
            >
              <PanelRightIcon />
              <span className="sr-only">Open context panel</span>
            </Button>
          )}
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* With the panel open, an event's details show there instead of a popover */}
          <WeekView
            scrollToHour={8}
            showEventPopover={!panelOpen}
            onEventPopoverExpand={() =>
              isMobile ? setOpenMobile(true) : toggleSidebar()
            }
          />
        </div>
      </div>
      <DetailsSidebar overlay={isMobile} className="h-full" />
    </>
  );
}
