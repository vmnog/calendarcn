"use client";

import { isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useTimeZoneLabel } from "@/hooks/use-timezone-label";
import type { WeekViewDayColumnsProps } from "./week-view-types";

/**
 * Day column headers showing day names and date numbers
 * Includes timezone label on the left (unless standalone mode)
 * Highlights the current day
 */
export function CalendarDayHeaders({
  days,
  standalone,
  highlightedDate,
  className,
}: WeekViewDayColumnsProps) {
  // Empty on the server and during hydration, the viewer's zone afterwards
  const timezone = useTimeZoneLabel();

  // Standalone mode: just render the day columns (used inside scroll container)
  if (standalone) {
    return (
      <div
        className={cn("grid", className)}
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={cn(
              "flex items-center justify-center py-2 text-sm",
              day.isToday ? "gap-0.5 " : "gap-0",
              highlightedDate &&
                isSameDay(day.date, highlightedDate) &&
                "column-highlight",
            )}
          >
            <span
              className={cn(
                day.isToday
                  ? "text-foreground font-medium"
                  : "text-muted-foreground font-normal",
              )}
            >
              {day.dayName}
            </span>
            <span
              className={cn(
                "flex h-5 w-[1.2rem] items-center justify-center rounded-xs text-sm",
                day.isToday
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {day.dayNumber}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("grid bg-background", className)}
      style={{ gridTemplateColumns: "4rem 1fr" }}
    >
      {/* Timezone label */}
      <div className="text-muted-foreground flex items-center justify-end pr-2 text-xxs">
        {timezone}
      </div>

      {/* Day columns */}
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={cn(
              "flex items-center justify-center py-2 text-sm",
              day.isToday ? "gap-0.5 " : "gap-0",
              highlightedDate &&
                isSameDay(day.date, highlightedDate) &&
                "column-highlight",
            )}
          >
            <span
              className={cn(
                day.isToday
                  ? "text-foreground font-medium"
                  : "text-muted-foreground font-normal",
              )}
            >
              {day.dayName}
            </span>
            <span
              className={cn(
                "flex h-5 w-[1.2rem] items-center justify-center rounded-xs text-sm",
                day.isToday
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground",
              )}
            >
              {day.dayNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
