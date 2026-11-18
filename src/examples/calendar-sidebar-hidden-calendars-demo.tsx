"use client";

import * as React from "react";
import { PanelLeftIcon } from "lucide-react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CalendarSidebar } from "@/components/calendar-sidebar";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { filterShownEvents, mergeShownEvents } from "@/lib/event-utils";
import { DEMO_CALENDARS, generateMockEvents } from "@/lib/mock-events";

export function CalendarSidebarHiddenCalendarsDemo() {
  // Every event, those of hidden calendars included
  const [events, setEvents] = React.useState(() => generateMockEvents());
  const [hiddenCalendarIds, setHiddenCalendarIds] = React.useState<string[]>(
    [],
  );

  return (
    <CalendarProvider
      // The views get the shown calendars' events only
      events={filterShownEvents(events, hiddenCalendarIds)}
      // The provider reports the shown events: put the hidden ones back
      onEventsChange={(shown) =>
        setEvents(mergeShownEvents(events, shown, hiddenCalendarIds))
      }
      calendars={DEMO_CALENDARS}
      defaultNumberOfDays={3}
    >
      {/* The inline sidebar is position: fixed; the transform keeps it in this box */}
      <SidebarProvider className="h-[600px] min-h-0 [transform:translateZ(0)]">
        <Layout
          hiddenCalendarIds={hiddenCalendarIds}
          onHiddenCalendarIdsChange={setHiddenCalendarIds}
        />
      </SidebarProvider>
    </CalendarProvider>
  );
}

interface LayoutProps {
  hiddenCalendarIds: string[];
  onHiddenCalendarIdsChange: (hiddenCalendarIds: string[]) => void;
}

function Layout({ hiddenCalendarIds, onHiddenCalendarIdsChange }: LayoutProps) {
  // Phones get the sidebar as a sheet, closed until its button opens it
  const { isMobile } = useSidebar();
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  return (
    <>
      <CalendarSidebar
        open={isMobile ? overlayOpen : true}
        onOpenChange={setOverlayOpen}
        overlay={isMobile}
        // Hover a calendar in the list and click its eye
        hiddenCalendarIds={hiddenCalendarIds}
        onHiddenCalendarIdsChange={onHiddenCalendarIdsChange}
        className="h-full"
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="m-2 size-7 shrink-0"
            onClick={() => setOverlayOpen(true)}
          >
            <PanelLeftIcon />
            <span className="sr-only">Open calendar sidebar</span>
          </Button>
        )}
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={8} />
        </div>
      </div>
    </>
  );
}
