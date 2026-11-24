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
  DECLINED_EVENT_OUTLINE_CLASS,
  DECLINED_EVENT_TEXT_CLASS,
  EVENT_COLOR_CLASSES,
  EVENT_FOCUS_RING_CLASS,
} from "./calendar-event-item";
import {
  getEventLabel,
  isDeclinedByViewer,
  resolveEventColorStyle,
} from "@/lib/event-utils";
import type { CalendarEvent } from "./calendar-types";
import type { EventDetailsTriggerProps } from "./week-view-types";

/** Width in pixels of the resize hotzone at each edge */
const RESIZE_HOTZONE_PX = 6;

/**
 * Box for custom `renderEventContent` output: above the background layers,
 * filling the bar (side insets match the default title's)
 */
const MONTH_BAR_SLOT_CLASS =
  "relative flex h-full min-w-0 flex-1 items-center overflow-hidden";

export interface MonthViewEventBarProps {
  event: CalendarEvent;
  colSpan: number;
  roundedLeft: boolean;
  roundedRight: boolean;
  isSelected?: boolean;
  isGhost?: boolean;
  /** Whether this is the copy following the pointer during a drag */
  isDragging?: boolean;
  /** Whether the bar's edges are being dragged (passed to `renderEventContent`) */
  isResizing?: boolean;
  /** ARIA for opening the event's details in a popover */
  detailsTriggerProps?: EventDetailsTriggerProps;
  onClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onDragPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
  onResizePointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
    edge: "left" | "right",
  ) => void;
  className?: string;
}

export function MonthViewEventBar({
  event,
  roundedLeft,
  roundedRight,
  isSelected: isSelectedProp = false,
  isGhost,
  detailsTriggerProps,
  isDragging = false,
  isResizing = false,
  onClick,
  onContextMenu,
  onDragPointerDown,
  onResizePointerDown,
  className,
}: MonthViewEventBarProps) {
  // One of several selected events looks selected too
  const isInSelection =
    useIsEventInSelection(event.id) && !isGhost && !isDragging;
  const isSelected = isSelectedProp || isInSelection;
  const { calendars, hourCycle, locale, timeZone } = useCalendarConfig();
  const colorStyle = resolveEventColorStyle(event, calendars);
  const styles = EVENT_COLOR_CLASSES;
  /** Declined by the viewer: an outline only, struck-through text */
  const isDeclined = isDeclinedByViewer(event);
  const showsDeclined = isDeclined && !isSelected;
  // `false` on the server and during hydration, so the markup matches
  const eventIsPast = useIsPast(event.end, timeZone);

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
    if (!onResizePointerDown) return;
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (roundedLeft && offsetX <= RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "col-resize");
      return;
    }
    if (roundedRight && offsetX >= width - RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "col-resize");
      return;
    }
    target.style.removeProperty("--cursor");
  }

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    if (!isPrimaryPress(e)) return;
    e.stopPropagation();

    if (onResizePointerDown) {
      const rect = e.currentTarget.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const width = rect.width;

      if (roundedLeft && offsetX <= RESIZE_HOTZONE_PX) {
        onResizePointerDown(e, event, "left");
        return;
      }
      if (roundedRight && offsetX >= width - RESIZE_HOTZONE_PX) {
        onResizePointerDown(e, event, "right");
        return;
      }
    }

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
      onMouseMove={handleBarMouseMove}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-5 flex items-center overflow-hidden",
        "cursor-default select-none",
        "focus:outline-none",
        EVENT_FOCUS_RING_CLASS,
        roundedLeft && "rounded-l-sm",
        roundedRight && "rounded-r-sm",
        showsDeclined && DECLINED_EVENT_OUTLINE_CLASS,
        showsDeclined && !roundedLeft && "border-l-0",
        showsDeclined && !roundedRight && "border-r-0",
        isSelected && "z-20",
        eventIsPast && !isGhost && "opacity-50",
        isGhost && "opacity-30 pointer-events-none",
        className,
      )}
      style={colorStyle}
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-background",
          roundedLeft && "rounded-l-sm",
          roundedRight && "rounded-r-sm",
        )}
      />

      {/* Colored background layer - uses border color when selected, none when declined */}
      {!showsDeclined && (
        <div
          className={cn(
            "absolute inset-0",
            roundedLeft && "rounded-l-sm",
            roundedRight && "rounded-r-sm",
            isSelected ? styles.border : cn(styles.bg, styles.bgHover),
          )}
        />
      )}

      {/* Left border accent - only when roundedLeft, not selected or declined */}
      {roundedLeft && !isSelected && !isDeclined && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[3px] dark:bg-event-foreground dark:mix-blend-overlay",
            "rounded-l-sm",
            styles.border,
          )}
        />
      )}

      {/* Event title */}
      <EventContentSlot
        event={event}
        view="month"
        placement="month-bar"
        isSelected={isSelected}
        isPast={eventIsPast}
        isDragging={isDragging}
        isResizing={isResizing}
        isCompact
        timeLabel=""
        className={cn(
          MONTH_BAR_SLOT_CLASS,
          roundedLeft ? "pl-1.5" : "pl-1",
          roundedRight ? "pr-1" : "pr-0",
        )}
        fallback={
          <span
            className={cn(
              "relative text-[0.6875rem] font-medium leading-tight truncate",
              roundedLeft ? "pl-1.5" : "pl-1",
              roundedRight ? "pr-1" : "pr-0",
              isSelected
                ? "text-event-foreground dark:text-event-foreground"
                : cn(styles.text, "dark:text-event-foreground/80"),
              isDeclined && "line-through",
              showsDeclined && DECLINED_EVENT_TEXT_CLASS,
            )}
          >
            <SeriesChangeDot eventId={event.id} />
            {event.title}
          </span>
        }
      />
    </div>
  );
}
