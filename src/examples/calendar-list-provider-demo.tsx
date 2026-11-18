"use client";

import { cn } from "@/lib/utils";
import { CalendarList } from "@/components/calendar-list";
import { CalendarProvider } from "@/components/calendar-provider";
import { CALENDAR_SIDEBAR_COLORS_CLASS } from "@/components/sidebar-overlay";
import { SidebarProvider } from "@/components/ui/sidebar";
import type { CalendarInfo } from "@/components/calendar-types";

/** The app's calendars, in two accounts */
const CALENDARS: CalendarInfo[] = [
  {
    id: "personal",
    name: "Personal",
    color: "purple",
    email: "you@example.com",
  },
  { id: "family", name: "Family", color: "orange", email: "you@example.com" },
  {
    id: "holidays",
    name: "Holidays",
    color: "green",
    email: "you@example.com",
    isSubscribed: true,
  },
  { id: "work", name: "Work", color: "blue", email: "you@work.example.com" },
  {
    id: "on-call",
    name: "On call",
    color: "red",
    email: "you@work.example.com",
  },
];

export function CalendarListProviderDemo() {
  return (
    // The list shows the provider's calendars, the same ones the event
    // details' calendar picker offers
    <CalendarProvider calendars={CALENDARS}>
      {/* The list is built from shadcn/ui sidebar parts, which need a SidebarProvider */}
      <SidebarProvider className="h-full min-h-0 items-center justify-center">
        <div
          className={cn(
            // The calendar sidebars' colors, here outside a sidebar
            CALENDAR_SIDEBAR_COLORS_CLASS,
            "w-60 rounded-lg bg-sidebar py-2 text-sidebar-foreground shadow-xs ring-1 ring-black/5 dark:ring-white/10",
          )}
        >
          {/* Uncontrolled: the list keeps the hidden ids itself, starting with these */}
          <CalendarList defaultHiddenCalendarIds={["holidays", "on-call"]} />
        </div>
      </SidebarProvider>
    </CalendarProvider>
  );
}
