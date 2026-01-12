"use client";

import { cn } from "@/lib/utils";
import type { WeekViewAllDayRowProps } from "./week-view-types";

/**
 * All-day row for displaying all-day events
 * Shows "All-day" label on the left with 7 day columns
 */
export function WeekViewAllDayRow({ days, className }: WeekViewAllDayRowProps) {
  return (
    <div
      className={cn("border-border grid border-t border-b bg-background", className)}
      style={{ gridTemplateColumns: "4rem 1fr" }}
    >
      {/* All-day label */}
      <div className="border-border text-muted-foreground flex items-center justify-end border-r px-2 py-2 text-xxs">
        All-day
      </div>

      {/* Day columns for all-day events */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          return (
            <div
              key={day.date.toISOString()}
              className={cn(
                "border-border min-h-[2rem] border-l first:border-l-0",
                isWeekend && "bg-calendar-weekend",
                day.isToday && "bg-accent/30"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
