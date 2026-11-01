"use client";

import { format } from "date-fns";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";
import { useCalendarConfig } from "./calendar-provider";
import type { WeekViewTimeIndicatorProps } from "./week-view-types";

/**
 * Current time indicator showing time badge and horizontal lines
 * - Time badge with current time (e.g., "5:48PM", or "17:48" on a 24-hour clock) on the left
 * - Thick line on today's column
 * - Thin line on other day columns
 * Moves on every minute boundary via the shared `useNow` clock. Renders
 * nothing on the server and during hydration, where the time is unknown,
 * and outside the visible hours (`dayStartHour` to `dayEndHour`).
 */
export function WeekViewTimeIndicator({
  days,
  hourHeight,
  scrollDays,
  scrollStyle,
  behindSelection,
  className,
}: WeekViewTimeIndicatorProps) {
  const currentTime = useNow();
  const { dayStartHour, dayEndHour, hourCycle, locale } = useCalendarConfig();

  // Check if today is visible in the current week
  const isTodayVisible = days.some((day) => day.isToday);

  if (!currentTime || !isTodayVisible) {
    return null;
  }

  // Calculate position based on current time, from the grid's top edge
  const minutesSinceMidnight =
    currentTime.getHours() * 60 + currentTime.getMinutes();
  const visibleStartMinutes = dayStartHour * 60;
  if (
    minutesSinceMidnight < visibleStartMinutes ||
    minutesSinceMidnight >= dayEndHour * 60
  ) {
    return null;
  }
  const topPosition =
    ((minutesSinceMidnight - visibleStartMinutes) / 60) * hourHeight;

  // "5:48PM" on a 12-hour clock, "17:48" on a 24-hour clock
  const formattedTime =
    hourCycle === 24
      ? format(currentTime, "HH:mm", { locale })
      : format(currentTime, "h:mma", { locale }).toUpperCase();

  const lineDays = scrollDays ?? days;
  const lineTodayIndex = lineDays.findIndex((d) => d.isToday);

  const linesContent = (
    <div className="flex items-center">
      {lineDays.map((day, index) => (
        <React.Fragment key={day.date.toISOString()}>
          {index === lineTodayIndex && (
            <div className="relative flex-shrink-0">
              <div className="bg-primary h-3 w-[3px] translate-y-[0.5px] rounded-full shadow-[0_0_0_1px_white] dark:shadow-[0_0_0_1px_black]" />
              <div className="absolute top-[6.5px] left-[2px] bg-primary h-[1px] w-[2px] z-10" />
              <div className="absolute top-[5.5px] left-[2px] bg-primary h-[1px] w-[2px] z-10" />
              <div className="absolute top-[4.5px] left-[2px] bg-primary h-[1px] w-[2px] z-10" />
            </div>
          )}
          <div
            className={cn(
              "flex-1 bg-primary",
              day.isToday
                ? "h-[3px] rounded-r-full shadow-[0_0_0_1px_white] dark:shadow-[0_0_0_1px_black]"
                : "h-[0.5px]",
            )}
          />
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-0 right-0",
        behindSelection ? "z-10" : "z-20",
        className,
      )}
      style={{ top: topPosition }}
    >
      <div className="flex -translate-y-1/2 items-center">
        {/* Time badge - positioned in the time axis area */}
        <div className="flex w-16 flex-shrink-0 items-center justify-end pr-1">
          <span className="bg-primary text-primary-foreground rounded-xs px-1 py-0.5 text-xxs font-medium">
            {formattedTime}
          </span>
        </div>

        {/* Horizontal lines across day columns */}
        {scrollStyle ? (
          <div className="flex-1 overflow-hidden">
            <div style={scrollStyle}>{linesContent}</div>
          </div>
        ) : (
          linesContent
        )}
      </div>
    </div>
  );
}
