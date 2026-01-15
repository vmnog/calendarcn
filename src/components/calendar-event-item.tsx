"use client";

import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";
import type {
  CalendarEvent,
  CalendarEventItemProps,
  EventColor,
} from "./week-view-types";

const eventColorStyles: Record<
  EventColor,
  { bg: string; bgHover: string; border: string; text: string }
> = {
  red: {
    bg: "bg-event-red-bg",
    bgHover: "hover:bg-event-red-bg/70",
    border: "bg-event-red-border",
    text: "text-event-red",
  },
  orange: {
    bg: "bg-event-orange-bg",
    bgHover: "hover:bg-event-orange-bg/70",
    border: "bg-event-orange-border",
    text: "text-event-orange",
  },
  yellow: {
    bg: "bg-event-yellow-bg",
    bgHover: "hover:bg-event-yellow-bg/70",
    border: "bg-event-yellow-border",
    text: "text-event-yellow",
  },
  green: {
    bg: "bg-event-green-bg",
    bgHover: "hover:bg-event-green-bg/70",
    border: "bg-event-green-border",
    text: "text-event-green",
  },
  blue: {
    bg: "bg-event-blue-bg",
    bgHover: "hover:bg-event-blue-bg/70",
    border: "bg-event-blue-border",
    text: "text-event-blue",
  },
  purple: {
    bg: "bg-event-purple-bg",
    bgHover: "hover:bg-event-purple-bg/70",
    border: "bg-event-purple-border",
    text: "text-event-purple",
  },
  gray: {
    bg: "bg-event-gray-bg",
    bgHover: "hover:bg-event-gray-bg/70",
    border: "bg-event-gray-border",
    text: "text-event-gray",
  },
};

/**
 * Formats time showing only minutes if not on the hour
 * e.g., "10" for 10:00, "2:45" for 2:45
 */
function formatTimeShort(date: Date): string {
  const minutes = date.getMinutes();
  if (minutes === 0) {
    return format(date, "h");
  }
  return format(date, "h:mm");
}

/**
 * Formats event time as a compact range like "10–11 AM" or "11 AM–2 PM"
 */
function formatEventTimeRange(event: CalendarEvent): string {
  const startTime = formatTimeShort(event.start);
  const endTime = formatTimeShort(event.end);
  const endPeriod = format(event.end, "a");
  const startPeriod = format(event.start, "a");

  // If same period (both AM or both PM), only show period at the end
  if (startPeriod === endPeriod) {
    return `${startTime}–${endTime} ${endPeriod}`;
  }

  // Different periods, show both
  return `${startTime} ${startPeriod}–${endTime} ${endPeriod}`;
}

export function CalendarEventItem({
  positionedEvent,
  hourHeight,
  isPast: isPastProp,
  onClick,
  className,
}: CalendarEventItemProps) {
  const { event, top, height, left, width } = positionedEvent;
  const color = event.color ?? "blue";
  const styles = eventColorStyles[color];
  const eventIsPast = isPastProp ?? isPast(event.end);

  const heightInPixels = (height / 100) * 24 * hourHeight;
  const isCompact = heightInPixels < 40;

  function handleClick() {
    if (!onClick) {
      return;
    }
    onClick(event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    handleClick();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute rounded-md px-2 py-1 cursor-pointer",
        "hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none",
        className
      )}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        left: `${left}%`,
        width: `${width}%`,
        minHeight: "20px",
        zIndex: positionedEvent.column,
      }}
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div className="absolute inset-0 rounded-md bg-white dark:bg-[#191919]" />

      {/* Colored background layer - opacity for past events */}
      <div
        className={cn(
          "absolute inset-0 rounded-md",
          styles.bg,
          eventIsPast && "opacity-50"
        )}
      />

      {/* Left border - curved outside, straight inside */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
          styles.border,
          eventIsPast && "opacity-50"
        )}
      />
      <div
        className={cn(
          "relative flex flex-col h-full pl-1 overflow-hidden",
          isCompact && "flex-row items-center gap-1",
          eventIsPast && "opacity-50"
        )}
      >
        <span
          className={cn(
            "font-medium text-[0.625rem] leading-tight break-words dark:text-white/80",
            styles.text
          )}
        >
          {event.title}
        </span>
        {!isCompact && (
          <span className={cn("text-[0.625rem] whitespace-nowrap dark:text-white dark:mix-blend-overlay", styles.text)}>
            {formatEventTimeRange(event)}
          </span>
        )}
      </div>
    </div>
  );
}

export interface AllDayEventItemProps {
  event: CalendarEvent;
  isPast?: boolean;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
  /** For multi-day events: position info */
  spanStart?: boolean;
  spanEnd?: boolean;
}

/**
 * Formats start time for all-day events like "8:45 AM" or "4 PM"
 */
function formatAllDayStartTime(date: Date): string {
  const minutes = date.getMinutes();
  if (minutes === 0) {
    return format(date, "h a");
  }
  return format(date, "h:mm a");
}

export function AllDayEventItem({
  event,
  isPast: isPastProp,
  onClick,
  className,
  spanStart = true,
  spanEnd = true,
}: AllDayEventItemProps) {
  const color = event.color ?? "blue";
  const styles = eventColorStyles[color];
  const eventIsPast = isPastProp ?? isPast(event.end);

  // Check if event has a specific start time (not midnight)
  const hasStartTime = event.start.getHours() !== 0 || event.start.getMinutes() !== 0;

  function handleClick() {
    if (!onClick) {
      return;
    }
    onClick(event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    handleClick();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-6 px-2 py-0.5 cursor-pointer",
        "hover:z-10 focus:outline-none focus-visible:outline-none",
        "overflow-hidden select-none flex items-center gap-1",
        spanStart && "rounded-l-md",
        spanEnd && "rounded-r-md",
        className
      )}
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md"
        )}
      />

      {/* Colored background layer - opacity for past events */}
      <div
        className={cn(
          "absolute inset-0",
          styles.bg,
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
          eventIsPast && "opacity-50"
        )}
      />

      {/* Left border - curved outside, straight inside */}
      {spanStart && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
            eventIsPast && "opacity-50"
          )}
        />
      )}
      <span
        className={cn(
          "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap dark:text-white",
          spanStart && "pl-1",
          styles.text,
          eventIsPast && "opacity-50"
        )}
      >
        {event.title}
      </span>
      {hasStartTime && (
        <span
          className={cn(
            "relative text-[0.625rem] leading-tight whitespace-nowrap shrink-0 dark:text-white dark:mix-blend-overlay",
            styles.text,
            eventIsPast && "opacity-50"
          )}
        >
          {formatAllDayStartTime(event.start)}
        </span>
      )}
    </div>
  );
}
