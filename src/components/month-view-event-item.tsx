"use client";

import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "./calendar-types";

export interface MonthViewEventItemProps {
  event: CalendarEvent;
  isSelected?: boolean;
  isGhost?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  className?: string;
}

/** Left border color for each event color */
const borderColorStyles: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
};

/** Darker, more saturated color for event start time */
const timeColorStyles: Record<EventColor, string> = {
  red: "text-[#8C3030] dark:text-[#CC8585]",
  orange: "text-[#8C4420] dark:text-[#CC9575]",
  yellow: "text-[#8C6A1A] dark:text-[#CCAB65]",
  green: "text-[#2A6640] dark:text-[#75A090]",
  blue: "text-[#2A5080] dark:text-[#75A5CC]",
  purple: "text-[#5A3080] dark:text-[#A585CC]",
  gray: "text-[#505050] dark:text-[#AAAAAA]",
};

/** Light tinted title color — near-white with a hint of the event color */
const titleColorStyles: Record<EventColor, string> = {
  red: "text-[#5C1A1A] dark:text-[#F0C4C4]",
  orange: "text-[#5C2E14] dark:text-[#F0D4BE]",
  yellow: "text-[#5C4410] dark:text-[#F0E0A8]",
  green: "text-[#1A4D26] dark:text-[#C4E8D0]",
  blue: "text-[#1A3A5C] dark:text-[#C4DAF0]",
  purple: "text-[#3D1F5C] dark:text-[#DCC8F0]",
  gray: "text-[#3A3A3A] dark:text-[#D8D8D8]",
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
 * Timed event in month view — transparent bg with colored dot, like Notion Calendar.
 * Hover shows muted gray background.
 */
export function MonthViewEventItem({
  event,
  isSelected,
  isGhost,
  onClick,
  onContextMenu,
  onDragMouseDown,
  className,
}: MonthViewEventItemProps) {
  const color = event.color ?? "blue";
  const borderColor = borderColorStyles[color];
  const timeColor = timeColorStyles[color];
  const titleColor = titleColorStyles[color];
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
        "h-5 flex items-center overflow-hidden rounded-sm",
        "cursor-pointer select-none",
        "hover:bg-accent",
        "focus:outline-none focus-visible:outline-none",
        isSelected && "bg-accent z-20",
        eventIsPast && "opacity-50",
        isGhost && "opacity-30 pointer-events-none",
        className,
      )}
    >
      {/* Colored left border */}
      <div
        className={cn(
          "w-[3px] self-stretch shrink-0 rounded-l-sm",
          borderColor,
        )}
      />

      {/* Time + Title */}
      <span className="text-[0.6875rem] leading-tight truncate pl-1 pr-1">
        <span className={timeColor}>{formatEventTime(event.start)}</span>{" "}
        <span className={cn("font-bold", titleColor)}>{event.title}</span>
      </span>
    </div>
  );
}
