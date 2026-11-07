"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { CalendarList } from "@/components/calendar-list";
import type { CalendarInfo } from "@/components/calendar-types";
import { CALENDAR_SIDEBAR_COLORS_CLASS } from "@/components/sidebar-overlay";
import { SidebarProvider } from "@/components/ui/sidebar";

/** Two accounts' calendars; a subscribed one gets a feed icon */
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

export function CalendarListDemo() {
  const [hiddenCalendarIds, setHiddenCalendarIds] = React.useState<string[]>(
    [],
  );
  const hiddenNames = CALENDARS.filter((calendar) =>
    hiddenCalendarIds.includes(calendar.id),
  ).map((calendar) => calendar.name);

  return (
    // The list is built from shadcn/ui sidebar parts, which need a SidebarProvider
    <SidebarProvider className="min-h-0 h-full flex-col items-center justify-center gap-3">
      <div
        className={cn(
          CALENDAR_SIDEBAR_COLORS_CLASS,
          "w-60 rounded-lg bg-sidebar py-2 text-sidebar-foreground shadow-xs ring-1 ring-black/5 dark:ring-white/10",
        )}
      >
        <CalendarList
          calendars={CALENDARS}
          hiddenCalendarIds={hiddenCalendarIds}
          onHiddenCalendarIdsChange={setHiddenCalendarIds}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {hiddenNames.length > 0
          ? `Hidden: ${hiddenNames.join(", ")}`
          : "Hover a calendar and click its eye to hide it"}
      </p>
    </SidebarProvider>
  );
}
