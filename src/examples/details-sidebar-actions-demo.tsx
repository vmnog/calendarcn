"use client";

import * as React from "react";

import { CalendarProvider } from "@/components/calendar-provider";
import {
  CONTEXT_PANEL_WIDTH,
  DetailsSidebar,
} from "@/components/details-sidebar";
import type { DetailsSidebarShortcut } from "@/components/details-sidebar";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import type { DetailsSidebarActions } from "@/components/week-view-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Your app's keys, listed while no event is selected */
const SHORTCUTS: DetailsSidebarShortcut[] = [
  { label: "Search events", keys: ["⌘", "F"] },
  { label: "New event", keys: ["C"] },
  // A key your app doesn't handle yet gets a "Soon" badge
  { label: "Print the week", keys: ["⌘", "P"], soon: true },
];

export function DetailsSidebarActionsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider defaultEvents={initialEvents} defaultNumberOfDays={3}>
      {/* The inline panel is position: fixed; the transform keeps it in this box */}
      <SidebarProvider
        className="h-[600px] min-h-0 [transform:translateZ(0)]"
        style={
          { "--sidebar-width": CONTEXT_PANEL_WIDTH } as React.CSSProperties
        }
      >
        <Layout />
      </SidebarProvider>
    </CalendarProvider>
  );
}

function Layout() {
  const { isMobile, open } = useSidebar();
  // The panel's actions, for your own buttons, commands and keys
  const panelActions = React.useRef<DetailsSidebarActions>(null);

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Button
            variant="outline"
            size="sm"
            // Opens the panel on event search, with "review" typed in
            onClick={() => panelActions.current?.searchEvents("review")}
          >
            Search &quot;review&quot;
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => panelActions.current?.showAllShortcuts()}
          >
            All shortcuts
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          {/* With the panel open, an event's details show there instead */}
          <WeekView scrollToHour={8} showEventPopover={isMobile || !open} />
        </div>
      </div>
      <DetailsSidebar
        overlay={isMobile}
        shortcuts={SHORTCUTS}
        actionsRef={panelActions}
        className="h-full"
      />
    </>
  );
}
