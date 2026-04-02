"use client";

import { isPast } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "./calendar-types";

/** Width in pixels of the resize hotzone at each edge */
const RESIZE_HOTZONE_PX = 6;

export interface MonthViewEventBarProps {
  event: CalendarEvent;
  colSpan: number;
  roundedLeft: boolean;
  roundedRight: boolean;
  isSelected?: boolean;
  isGhost?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onResizeMouseDown?: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "left" | "right",
  ) => void;
  className?: string;
}

const barColorStyles: Record<
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

export function MonthViewEventBar({
  event,
  roundedLeft,
  roundedRight,
  isSelected,
  isGhost,
  onClick,
  onContextMenu,
  onDragMouseDown,
  onResizeMouseDown,
  className,
}: MonthViewEventBarProps) {
  const color = event.color ?? "blue";
  const styles = barColorStyles[color];
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

  function handleBarMouseMove(e: React.MouseEvent) {
    if (!onResizeMouseDown) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (roundedLeft && offsetX <= RESIZE_HOTZONE_PX) {
      target.style.cursor = "ew-resize";
      return;
    }
    if (roundedRight && offsetX >= width - RESIZE_HOTZONE_PX) {
      target.style.cursor = "ew-resize";
      return;
    }
    target.style.cursor = "";
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (onResizeMouseDown) {
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const width = rect.width;

      if (roundedLeft && offsetX <= RESIZE_HOTZONE_PX) {
        onResizeMouseDown(e, event, "left");
        return;
      }
      if (roundedRight && offsetX >= width - RESIZE_HOTZONE_PX) {
        onResizeMouseDown(e, event, "right");
        return;
      }
    }

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
      onMouseMove={handleBarMouseMove}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-5 flex items-center overflow-hidden",
        "cursor-default select-none",
        "focus:outline-none focus-visible:outline-none",
        roundedLeft && "rounded-l-sm",
        roundedRight && "rounded-r-sm",
        isSelected && "z-20",
        eventIsPast && !isGhost && "opacity-50",
        isGhost && "opacity-30 pointer-events-none",
        className,
      )}
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          roundedLeft && "rounded-l-sm",
          roundedRight && "rounded-r-sm",
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          roundedLeft && "rounded-l-sm",
          roundedRight && "rounded-r-sm",
          isSelected ? styles.border : cn(styles.bg, styles.bgHover),
        )}
      />

      {/* Left border accent - only when roundedLeft and not selected */}
      {roundedLeft && !isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] dark:bg-white dark:mix-blend-overlay",
            "rounded-l-sm",
            styles.border,
          )}
        />
      )}

      {/* Event title */}
      <span
        className={cn(
          "relative text-[0.6875rem] font-medium leading-tight truncate",
          roundedLeft ? "pl-1.5" : "pl-1",
          roundedRight ? "pr-1" : "pr-0",
          isSelected
            ? "text-white dark:text-white"
            : cn(styles.text, "dark:text-white/80"),
        )}
      >
        {event.title}
      </span>
    </div>
  );
}
