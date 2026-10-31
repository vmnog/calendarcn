"use client";

import { cn } from "@/lib/utils";
import type { WeekViewTimeAxisProps } from "./week-view-types";

/**
 * Left sidebar displaying hourly time labels using CSS Grid
 * Uses same grid row structure as main grid for guaranteed alignment
 * Width matches the timezone/all-day label column (4rem)
 */
export function WeekViewTimeAxis({
  hours,
  hourHeight,
  className,
}: WeekViewTimeAxisProps) {
  return (
    // Hour labels are visual only: each event's label already reads its time
    <div
      aria-hidden
      className={cn("grid w-16 flex-shrink-0", className)}
      style={{
        gridTemplateRows: `repeat(${hours.length}, ${hourHeight}px)`,
        gridTemplateColumns: "1fr",
      }}
    >
      {hours.map((hourSlot, index) => (
        <div
          key={hourSlot.hour}
          className="text-muted-foreground relative pr-2 text-right text-xxs"
        >
          {/* Show label at top of each cell, skip the first row (it would sit on the grid's top edge) */}
          {index > 0 && (
            <span className="absolute top-0 right-2 -translate-y-[55%] leading-none">
              {hourSlot.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
