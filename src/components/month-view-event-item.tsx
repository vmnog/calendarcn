"use client";

import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "./calendar-types";

export interface MonthViewEventItemProps {
  event: CalendarEvent;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  className?: string;
}

/** Color styles matching the event bar palette */
const itemColorStyles: Record<
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
 * Formats a time as "9 AM" or "2:30 PM" — no leading zero, abbreviated period.
 */
function formatEventTime(date: Date): string {
  const minutes = date.getMinutes();
  if (minutes === 0) {
    return format(date, "h a");
  }
  return format(date, "h:mm a");
}

/**
 * Timed event rendered as a colored bar (matching all-day style) in a month day cell.
 * Shows: [left border] [time] [title] — same visual treatment as all-day bars.
 */
export function MonthViewEventItem({
  event,
  isSelected,
  onClick,
  onContextMenu,
  onDragMouseDown,
  className,
}: MonthViewEventItemProps) {
  const color = event.color ?? "blue";
  const styles = itemColorStyles[color];
  const eventIsPast = isPast(event.end);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick?.(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, event);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    onDragMouseDown?.(e, event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick?.(event);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-5 flex items-center overflow-hidden rounded-sm",
        "cursor-pointer select-none",
        "focus:outline-none focus-visible:outline-none",
        isSelected && "z-20",
        className,
      )}
    >
      {/* Solid background layer */}
      <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />

      {/* Colored background layer */}
      <div
        className={cn(
          "absolute inset-0 rounded-sm",
          isSelected ? styles.border : cn(styles.bg, styles.bgHover),
          eventIsPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border accent */}
      {!isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-sm dark:bg-white dark:mix-blend-overlay",
            styles.border,
            eventIsPast && "opacity-60",
          )}
        />
      )}

      {/* Time + Title */}
      <span
        className={cn(
          "relative text-xs leading-tight truncate pl-1.5 pr-1",
          isSelected
            ? "text-white dark:text-white"
            : cn(styles.text, "dark:text-white/80"),
          eventIsPast && !isSelected && "opacity-60",
        )}
      >
        {formatEventTime(event.start)} {event.title}
      </span>
    </div>
  );
}
