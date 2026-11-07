"use client";

import { cn } from "@/lib/utils";
import { useIsPast } from "@/hooks/use-now";
import { isPrimaryPress } from "@/hooks/use-pointer-gesture";
import { EventContentSlot, useCalendarConfig } from "./calendar-provider";
import { EVENT_FOCUS_RING_CLASS } from "./calendar-event-item";
import {
  formatTime,
  getEventLabel,
  resolveEventColor,
} from "@/lib/event-utils";
import type { CalendarEvent, EventColor } from "./calendar-types";
import type { EventDetailsTriggerProps } from "./week-view-types";

export interface MonthViewEventItemProps {
  event: CalendarEvent;
  isSelected?: boolean;
  isGhost?: boolean;
  /** Whether this is the copy following the pointer during a drag */
  isDragging?: boolean;
  /** ARIA for opening the event's details in a popover */
  detailsTriggerProps?: EventDetailsTriggerProps;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
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
 * Box for custom `renderEventContent` output: fills the line after the color
 * accent, inset like the default text
 */
const MONTH_ITEM_SLOT_CLASS =
  "flex h-full min-w-0 flex-1 items-center overflow-hidden px-1";

/**
 * Timed event in month view — transparent bg with colored dot, like Notion Calendar.
 * Hover shows muted gray background.
 */
export function MonthViewEventItem({
  event,
  isSelected = false,
  isGhost,
  detailsTriggerProps,
  isDragging = false,
  onClick,
  onContextMenu,
  onDragPointerDown,
  className,
}: MonthViewEventItemProps) {
  const { calendars, hourCycle, locale } = useCalendarConfig();
  const color = resolveEventColor(event, calendars);
  const borderColor = borderColorStyles[color];
  const timeColor = timeColorStyles[color];
  const titleColor = titleColorStyles[color];
  // `false` on the server and during hydration, so the markup matches
  const eventIsPast = useIsPast(event.end);
  // "9 AM" / "2:30 PM", or "09:00" / "14:30" on a 24-hour clock
  const startTimeLabel = formatTime(event.start, hourCycle, locale);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick?.(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu?.(e, event);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    if (!isPrimaryPress(e)) return;
    e.stopPropagation();
    onDragPointerDown?.(e, event);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick?.(event);
  }

  return (
    <div
      role="button"
      // Ghosts and the copy following the pointer are drag visuals, not events
      tabIndex={isGhost || isDragging ? -1 : 0}
      aria-hidden={isGhost || isDragging || undefined}
      aria-label={getEventLabel(event, hourCycle, locale)}
      aria-pressed={isSelected}
      {...(!isGhost && !isDragging && detailsTriggerProps)}
      data-event-id={isGhost || isDragging ? undefined : event.id}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-5 flex items-center overflow-hidden rounded-sm",
        "cursor-default select-none",
        "hover:bg-accent",
        "focus:outline-none",
        // Positioned only while focused, for the ring overlay
        "focus-visible:relative",
        EVENT_FOCUS_RING_CLASS,
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
      <EventContentSlot
        event={event}
        view="month"
        placement="month-item"
        isSelected={isSelected}
        isPast={eventIsPast}
        isDragging={isDragging}
        isResizing={false}
        isCompact
        timeLabel={startTimeLabel}
        className={MONTH_ITEM_SLOT_CLASS}
        fallback={
          <span className="text-[0.6875rem] leading-tight truncate pl-1 pr-1">
            <span className={timeColor}>{startTimeLabel}</span>{" "}
            <span className={cn("font-bold", titleColor)}>{event.title}</span>
          </span>
        }
      />
    </div>
  );
}
