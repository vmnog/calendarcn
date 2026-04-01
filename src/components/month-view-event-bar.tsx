"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "./calendar-types";

export interface MonthViewEventBarProps {
  event: CalendarEvent;
  colSpan: number;
  roundedLeft: boolean;
  roundedRight: boolean;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
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
  onClick,
  onContextMenu,
  onDragMouseDown,
  className,
}: MonthViewEventBarProps) {
  const color = event.color ?? "blue";
  const styles = barColorStyles[color];

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
        "relative h-5 flex items-center overflow-hidden",
        "cursor-pointer select-none",
        "focus:outline-none focus-visible:outline-none",
        roundedLeft && "rounded-l-sm",
        roundedRight && "rounded-r-sm",
        isSelected && "z-20",
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
          "relative text-[0.625rem] font-medium leading-tight truncate",
          roundedLeft ? "pl-2" : "pl-1",
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
