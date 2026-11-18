"use client";

import * as React from "react";
import { format } from "date-fns";

import { MiniCalendar } from "@/components/mini-calendar";

export function MiniCalendarMondayDemo() {
  // The picked day. `null` until the first pick, so the server and the
  // browser render the same markup
  const [picked, setPicked] = React.useState<Date | null>(null);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="w-60 rounded-lg bg-sidebar py-2 shadow-xs ring-1 ring-black/5 dark:ring-white/10">
        <MiniCalendar
          currentDate={picked ?? undefined}
          onDateSelect={setPicked}
          // Weeks start on Monday (Sunday by default)
          weekStartsOn={1}
          // No week numbers down the side
          showWeekNumber={false}
        />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {picked ? format(picked, "EEEE, MMMM d") : "Pick a day"}
      </p>
    </div>
  );
}
