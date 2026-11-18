"use client";

import * as React from "react";
import { PanelLeftIcon } from "lucide-react";

import { CalendarProvider } from "@/components/calendar-provider";
import { CalendarSidebar } from "@/components/calendar-sidebar";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { DEMO_CONTACTS, generateContactEvents } from "@/lib/mock-events";
import { createSampleEvents } from "@/lib/sample-events";

export function CalendarSidebarMeetWithDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  // Other people's events, by email: the sample data's
  const [contactEvents] = React.useState(() => generateContactEvents());

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      defaultNumberOfDays={3}
      // With contacts, the sidebar's "Meet with..." field has people to offer
      contacts={DEMO_CONTACTS}
      contactEvents={contactEvents}
      // Start in a meeting with Priya: she is listed under the field
      defaultMeetWith={["priya@example.com"]}
    >
      {/* The inline sidebar is position: fixed; the transform keeps it in this box */}
      <SidebarProvider className="h-[600px] min-h-0 [transform:translateZ(0)]">
        <Layout />
      </SidebarProvider>
    </CalendarProvider>
  );
}

function Layout() {
  // Phones get the sidebar as a sheet, closed until its button opens it
  const { isMobile } = useSidebar();
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  return (
    <>
      <CalendarSidebar
        open={isMobile ? overlayOpen : true}
        onOpenChange={setOverlayOpen}
        overlay={isMobile}
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
