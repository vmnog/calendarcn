"use client";

import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, PanelLeftIcon } from "lucide-react";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { CalendarSidebar } from "@/components/calendar-sidebar";
import type { CalendarInfo } from "@/components/calendar-types";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { createSampleEvents } from "@/lib/sample-events";

/** The calendars the sidebar lists, in two accounts */
const CALENDARS: CalendarInfo[] = [
  {
    id: "you@example.com",
    name: "you@example.com",
    color: "red",
    email: "you@example.com",
  },
  {
    id: "personal",
    name: "Personal",
    color: "purple",
    email: "you@example.com",
  },
  {
    id: "holidays",
    name: "Holidays in Brazil",
    color: "green",
    email: "you@example.com",
    isSubscribed: true,
  },
  {
    id: "work",
    name: "Work",
    color: "blue",
    email: "you@work.example.com",
  },
];

export function CalendarSidebarDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      defaultNumberOfDays={3}
      calendars={CALENDARS}
    >
      {/* The inline sidebar is position: fixed; the transform keeps it in this frame */}
      <SidebarProvider className="h-full min-h-0 [transform:translateZ(0)]">
        <CalendarWithSidebar />
      </SidebarProvider>
    </CalendarProvider>
  );
}

function CalendarWithSidebar() {
  // Phones get the sidebar as an overlay, closed until opened
  const { isMobile } = useSidebar();
  const { monthName, year, goToPrev, goToNext } = useCalendar();
  const [open, setOpen] = React.useState(true);
  const [overlayOpen, setOverlayOpen] = React.useState(false);

  const toggleSidebar = () => {
    if (isMobile) {
      setOverlayOpen((prev) => !prev);
      return;
    }
    setOpen((prev) => !prev);
  };

  return (
    <>
      <CalendarSidebar
        open={isMobile ? overlayOpen : open}
        onOpenChange={setOverlayOpen}
        overlay={isMobile}
        className="h-full"
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={toggleSidebar}
          >
            <PanelLeftIcon />
            <span className="sr-only">Toggle calendar sidebar</span>
          </Button>
          <h2 className="flex-1 truncate text-base font-extrabold">
            {monthName} {year}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={goToPrev}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous days</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={goToNext}
          >
            <ChevronRightIcon />
            <span className="sr-only">Next days</span>
          </Button>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          <WeekView scrollToHour={8} />
        </div>
      </div>
    </>
  );
}
