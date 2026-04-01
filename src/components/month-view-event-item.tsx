"use client";

import { format } from "date-fns";
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

const dotColorStyles: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
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

export function MonthViewEventItem({
  event,
  isSelected,
  onClick,
  onContextMenu,
  onDragMouseDown,
  className,
}: MonthViewEventItemProps) {
  const color = event.color ?? "blue";
  const dotClass = dotColorStyles[color];

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
        "flex items-center gap-1 px-1 py-0.5 rounded-sm",
        "text-xs cursor-pointer select-none overflow-hidden",
        "hover:bg-accent/50 focus:outline-none focus-visible:outline-none",
        isSelected && "bg-primary/20 ring-1 ring-primary/40",
        className,
      )}
    >
      <span
        className={cn("size-1.5 rounded-full shrink-0", dotClass)}
        aria-hidden
      />
      <span className="truncate text-foreground/80">
        <span className="shrink-0">{formatEventTime(event.start)}&nbsp;</span>
        <span>{event.title}</span>
      </span>
    </div>
  );
}
