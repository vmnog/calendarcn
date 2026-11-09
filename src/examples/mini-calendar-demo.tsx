"use client";

import * as React from "react";
import { addDays, format, startOfWeek } from "date-fns";

import { MiniCalendar } from "@/components/mini-calendar";

/** Days in the highlighted week */
const DAYS_PER_WEEK = 7;

/** The week that contains `date`, Sunday first */
function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: DAYS_PER_WEEK }, (_, index) =>
    addDays(start, index),
  );
}

export function MiniCalendarDemo() {
  // Picked day, shown as the week around it. `null` until the first pick,
  // so the server and the browser render the same markup
  const [picked, setPicked] = React.useState<Date | null>(null);
  const visibleDays = React.useMemo(
    () => (picked ? getWeekDays(picked) : undefined),
    [picked],
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="w-60 rounded-lg bg-sidebar py-2 shadow-xs ring-1 ring-black/5 dark:ring-white/10">
        <MiniCalendar
          currentDate={picked ?? undefined}
          visibleDays={visibleDays}
          onDateSelect={setPicked}
        />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {picked
          ? `Week of ${format(visibleDays?.[0] ?? picked, "MMM d")}`
          : "Pick a day"}
      </p>
    </div>
  );
}
