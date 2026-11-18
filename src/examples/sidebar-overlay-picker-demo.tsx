"use client";

import * as React from "react";
import { format } from "date-fns";

import { MiniCalendar } from "@/components/mini-calendar";
import { SidebarOverlay } from "@/components/sidebar-overlay";
import { Button } from "@/components/ui/button";

export function SidebarOverlayPickerDemo() {
  const [open, setOpen] = React.useState(false);
  // The picked day, or `null` before the first pick
  const [day, setDay] = React.useState<Date | null>(null);

  const pickDay = (date: Date) => {
    setDay(date);
    // You own the open state: close the sheet once a day is picked
    setOpen(false);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        {day ? format(day, "EEEE, MMMM d") : "Pick a day"}
      </Button>
      <SidebarOverlay
        open={open}
        onOpenChange={setOpen}
        side="right"
        title="Pick a day"
        description="A month to pick a day from."
        // The sheet is this wide, up to 85% of the screen
        style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      >
        <div className="flex h-14 shrink-0 items-center px-4 text-sm font-semibold text-sidebar-primary">
          Pick a day
        </div>
        {/* Anything can go in the sheet. It is drawn in the calendar sidebars' colors */}
        <MiniCalendar currentDate={day ?? undefined} onDateSelect={pickDay} />
      </SidebarOverlay>
    </div>
  );
}
