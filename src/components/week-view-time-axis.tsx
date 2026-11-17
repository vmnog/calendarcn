"use client";

import { cn } from "@/lib/utils";
import type { WeekViewTimeAxisProps } from "./week-view-types";

/**
 * Column of hour labels beside the grid, using CSS Grid with the same rows
 * as the main grid for guaranteed alignment. One column (4rem), like the
 * time zone and all-day labels above it. `labels` replaces the slots' own
 * labels: the time grid draws a second axis for a second time zone.
 */
export function WeekViewTimeAxis({
  hours,
  hourHeight,
  labels,
  highlighted = false,
  className,
}: WeekViewTimeAxisProps) {
  return (
    // Hour labels are visual only: each event's label already reads its time
    <div
      aria-hidden
      className={cn(
        "grid w-16 flex-shrink-0",
        // The hours' own class sets their color: outrank it
        highlighted && "bg-primary [&>div]:text-primary-foreground",
        className,
      )}
      style={{
        gridTemplateRows: `repeat(${hours.length}, ${hourHeight}px)`,
        gridTemplateColumns: "1fr",
      }}
    >
      {hours.map((hourSlot, index) => {
        const label = labels ? labels[index] : hourSlot.label;
        return (
          <div
            key={hourSlot.hour}
            className="text-muted-foreground relative pr-2 text-right text-xxs"
          >
            {/* Show label at top of each cell, skip the first row (it would sit on the grid's top edge) */}
            {index > 0 && label && (
              <span className="absolute top-0 right-2 -translate-y-[55%] leading-none whitespace-nowrap">
                {label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
