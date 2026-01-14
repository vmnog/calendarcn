"use client";

import { cn } from "@/lib/utils";
import type { WeekViewGridProps } from "./week-view-types";

/**
 * Main grid displaying hour/day intersection cells
 * Each cell represents one hour in one day
 */
export function WeekViewGrid({
  days,
  hours,
  hourHeight,
  className,
}: WeekViewGridProps) {
  return (
    <div
      className={cn("grid grid-cols-7", className)}
      style={{ gridTemplateRows: `repeat(${hours.length}, ${hourHeight}px)` }}
    >
      {hours.map((hourSlot) =>
        days.map((day) => {
          const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
          return (
            <div
              key={`${day.date.toISOString()}-${hourSlot.hour}`}
              className={cn(
                "border-border border-b border-l",
                isWeekend && "bg-calendar-weekend"
              )}
            />
          );
        })
      )}
    </div>
  );
}
