"use client";

import { cn } from "@/lib/utils";
import { useIsPast } from "@/hooks/use-now";
import { isPrimaryPress } from "@/hooks/use-pointer-gesture";
import {
  EventContentSlot,
  useCalendarConfig,
  useIsEventInSelection,
} from "./calendar-provider";
import { SeriesChangeDot } from "./event-series-scope-dialog";
import {
  DECLINED_EVENT_TEXT_CLASS,
  EVENT_FOCUS_RING_CLASS,
} from "./calendar-event-item";
import {
  formatTime,
  getEventLabel,
  isDeclinedByViewer,
  resolveEventColorStyle,
} from "@/lib/event-utils";
import type { CalendarEvent } from "./calendar-types";
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

/** Left border of the event, in its color */
const BORDER_COLOR_CLASS = "bg-event-border";

/** The start time: the color's muted text shade (`--event-<color>-muted`) */
const TIME_COLOR_CLASS = "text-event-muted";

/** The title: the color's strong text shade (`--event-<color>-strong`) */
const TITLE_COLOR_CLASS = "text-event-strong";

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
  isSelected: isSelectedProp = false,
  isGhost,
  detailsTriggerProps,
  isDragging = false,
  onClick,
  onContextMenu,
  onDragPointerDown,
  className,
}: MonthViewEventItemProps) {
  // One of several selected events looks selected too
  const isInSelection =
    useIsEventInSelection(event.id) && !isGhost && !isDragging;
  const isSelected = isSelectedProp || isInSelection;
  const { calendars, hourCycle, locale, timeZone } = useCalendarConfig();
  const colorStyle = resolveEventColorStyle(event, calendars);
  // `false` on the server and during hydration, so the markup matches
  const eventIsPast = useIsPast(event.end, timeZone);
  // "9 AM" / "2:30 PM", or "09:00" / "14:30" on a 24-hour clock
  const startTimeLabel = formatTime(event.start, hourCycle, locale);
  /** Declined by the viewer: no color accent, struck-through text */
  const isDeclined = isDeclinedByViewer(event);

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
      style={colorStyle}
    >
      {/* Colored left border, kept as a gap when declined */}
      <div
        className={cn(
          "w-[3px] self-stretch shrink-0 rounded-l-sm",
          isDeclined ? "bg-transparent" : BORDER_COLOR_CLASS,
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
            <span
              className={cn(
                TIME_COLOR_CLASS,
                isDeclined && DECLINED_EVENT_TEXT_CLASS,
              )}
            >
              {startTimeLabel}
            </span>{" "}
            <span
              className={cn(
                "font-bold",
                TITLE_COLOR_CLASS,
                isDeclined && DECLINED_EVENT_TEXT_CLASS,
              )}
            >
              <SeriesChangeDot eventId={event.id} />
              {event.title}
            </span>
          </span>
        }
      />
    </div>
  );
}
