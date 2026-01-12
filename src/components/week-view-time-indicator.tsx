"use client";

import { format } from "date-fns";
import * as React from "react";

import { cn } from "@/lib/utils";
import type { WeekViewTimeIndicatorProps } from "./week-view-types";

/**
 * Current time indicator showing time badge and horizontal lines
 * - Time badge with current time (e.g., "5:48PM") on the left
 * - Thick line on today's column
 * - Thin line on other day columns
 * Updates position every minute
 */
export function WeekViewTimeIndicator({
  days,
  hourHeight,
  className,
}: WeekViewTimeIndicatorProps) {
  const [currentTime, setCurrentTime] = React.useState(() => new Date());

  // Check if today is visible in the current week
  const todayIndex = days.findIndex((day) => day.isToday);
  const isTodayVisible = todayIndex !== -1;

  // Update time every minute
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!isTodayVisible) {
    return null;
  }

  // Calculate position based on current time
  const minutesSinceMidnight =
    currentTime.getHours() * 60 + currentTime.getMinutes();
  const totalMinutesInDay = 24 * 60;
  const totalGridHeight = hourHeight * 24;
  const topPosition =
    (minutesSinceMidnight / totalMinutesInDay) * totalGridHeight;

  // Format time as "H:MMAM/PM" (e.g., "5:48PM")
  const formattedTime = format(currentTime, "h:mma").toUpperCase();

  return (
    <div
      className={cn("pointer-events-none absolute left-0 right-0 z-20", className)}
      style={{ top: topPosition }}
    >
      <div className="flex -translate-y-1/2 items-center">
        {/* Time badge - positioned in the time axis area */}
        <div className="flex w-16 flex-shrink-0 items-center justify-end pr-1">
          <span className="bg-primary text-primary-foreground rounded-xs px-1 py-0.5 text-xxs font-medium">
            {formattedTime}
          </span>
        </div>

        {/* Vertical line at start of grid */}
        <div className="bg-primary h-3 w-0.5 flex-shrink-0 translate-y-[0.5px]" />

        {/* Horizontal lines across day columns */}
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={cn(
              "flex-1 bg-primary",
              day.isToday ? "h-[3px]" : "h-[0.5px]"
            )}
          />
        ))}
      </div>
    </div>
  );
}
