"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsPast } from "@/hooks/use-now";
import { EventDetailPopover } from "./event-detail-popover";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import { EventContentSlot, useCalendarConfig } from "./calendar-provider";
import {
  formatTime,
  formatTimeRange,
  getEventLabel,
  resolveEventColor,
} from "@/lib/event-utils";
import type {
  CalendarEvent,
  CalendarEventItemProps,
  EventColor,
  EventContentProps,
  EventDetailsTriggerProps,
  EventItemPopoverProps,
  PopoverAnchorRect,
} from "./week-view-types";
import { EventContextMenu } from "./event-context-menu";

export const eventColorStyles: Record<
  EventColor,
  {
    bg: string;
    bgHover: string;
    border: string;
    borderLine: string;
    text: string;
  }
> = {
  red: {
    bg: "bg-event-red-bg",
    bgHover: "hover:bg-event-red-bg/70",
    border: "bg-event-red-border",
    borderLine: "border-event-red-border",
    text: "text-event-red",
  },
  orange: {
    bg: "bg-event-orange-bg",
    bgHover: "hover:bg-event-orange-bg/70",
    border: "bg-event-orange-border",
    borderLine: "border-event-orange-border",
    text: "text-event-orange",
  },
  yellow: {
    bg: "bg-event-yellow-bg",
    bgHover: "hover:bg-event-yellow-bg/70",
    border: "bg-event-yellow-border",
    borderLine: "border-event-yellow-border",
    text: "text-event-yellow",
  },
  green: {
    bg: "bg-event-green-bg",
    bgHover: "hover:bg-event-green-bg/70",
    border: "bg-event-green-border",
    borderLine: "border-event-green-border",
    text: "text-event-green",
  },
  blue: {
    bg: "bg-event-blue-bg",
    bgHover: "hover:bg-event-blue-bg/70",
    border: "bg-event-blue-border",
    borderLine: "border-event-blue-border",
    text: "text-event-blue",
  },
  purple: {
    bg: "bg-event-purple-bg",
    bgHover: "hover:bg-event-purple-bg/70",
    border: "bg-event-purple-border",
    borderLine: "border-event-purple-border",
    text: "text-event-purple",
  },
  gray: {
    bg: "bg-event-gray-bg",
    bgHover: "hover:bg-event-gray-bg/70",
    border: "bg-event-gray-border",
    borderLine: "border-event-gray-border",
    text: "text-event-gray",
  },
};

/**
 * Positions a block from explicit start/end times (drag and resize
 * previews), clipped to the visible hours and measured from the grid's top
 * edge (`dayStartHour`)
 */
function computeOverrideStyle(
  positionedEvent: CalendarEventItemProps["positionedEvent"],
  hourHeight: number,
  overrideStart: Date,
  overrideEnd: Date,
  dayStartHour: number,
  dayEndHour: number,
) {
  const startMinutes =
    overrideStart.getHours() * 60 + overrideStart.getMinutes();
  let endMinutes = overrideEnd.getHours() * 60 + overrideEnd.getMinutes();
  // If end is midnight and on a different day than start, treat as 1440 (end of day)
  if (endMinutes === 0 && overrideEnd.getDate() !== overrideStart.getDate()) {
    endMinutes = 1440;
  }
  const visibleStart = dayStartHour * 60;
  const visibleEnd = dayEndHour * 60;
  const topMinutes =
    Math.min(Math.max(startMinutes, visibleStart), visibleEnd) - visibleStart;
  const bottomMinutes =
    Math.min(Math.max(endMinutes, visibleStart), visibleEnd) - visibleStart;
  const topPx = (topMinutes / 60) * hourHeight;
  const heightPx = ((bottomMinutes - topMinutes) / 60) * hourHeight;

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: `${positionedEvent.left}%`,
    width: `${positionedEvent.width}%`,
    minHeight: "20px",
  };
}

const RESIZE_HOTZONE_PX = 8;

/**
 * Keyboard focus ring for events: a border on an `::after` overlay, painted
 * above the event's absolutely positioned background layers (which cover an
 * outline) and inside its box (so clipping and neighbors don't hide it).
 * Shown only for keyboard focus (`focus-visible`), never on click. The
 * event must be positioned.
 */
export const EVENT_FOCUS_RING_CLASS =
  "focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-0 focus-visible:after:rounded-[inherit] focus-visible:after:border-2 focus-visible:after:border-ring";

/**
 * Box for custom `renderEventContent` output in a time-grid block: above the
 * background layers, filling the block, inset like the default text
 */
const TIME_GRID_SLOT_CLASS = "relative h-full min-w-0 overflow-hidden pl-1";

interface EventDetailsTriggerOptions {
  /** Whether the event opens its details in a popover at all */
  showEventPopover: boolean;
  /** Whether the event's details popover is open */
  showPopover: boolean;
  /** The popover panel's id */
  detailsId: string;
}

/**
 * ARIA for an event element that opens the event's details in a popover:
 * what it opens, whether that is open now, and the panel it controls.
 */
export function getEventDetailsTriggerProps({
  showEventPopover,
  showPopover,
  detailsId,
}: EventDetailsTriggerOptions): EventDetailsTriggerProps {
  if (!showEventPopover) return {};
  return {
    "aria-haspopup": "dialog",
    "aria-expanded": showPopover,
    "aria-controls": showPopover ? detailsId : undefined,
  };
}

interface EventDetailsToggleOptions {
  /** Whether the event's details popover is open */
  showPopover: boolean;
  /** Whether the event opens its details in a popover at all */
  showEventPopover: boolean;
  close: () => void;
}

/**
 * An event opens and closes its details popover. Gives the event element the
 * popup's ARIA and keeps its click a toggle: a mouse press selects the event,
 * and so opens the details, before its click arrives, so the click closes
 * them only when they were already open at the press.
 */
function useEventDetailsToggle({
  showPopover,
  showEventPopover,
  close,
}: EventDetailsToggleOptions) {
  const detailsId = React.useId();
  /** Whether the details were open when the current press began */
  const openOnPressRef = React.useRef<boolean | null>(null);

  return {
    detailsId,
    /** For the event element, which opens the details, a dialog */
    triggerProps: getEventDetailsTriggerProps({
      showEventPopover,
      showPopover,
      detailsId,
    }),
    /** Call when a press on the event begins */
    notePress() {
      openOnPressRef.current = showPopover;
    },
    /** Call from the event's click, after it selected the event */
    closeIfToggled() {
      // A click with no press before it (assistive technology) toggles too
      const wasOpen = openOnPressRef.current ?? showPopover;
      openOnPressRef.current = null;
      if (wasOpen && showPopover) close();
    },
  };
}

export function CalendarEventItem({
  positionedEvent,
  hourHeight,
  isPast: isPastProp,
  isSelected,
  onClick,
  dragVariant = "default",
  isResizing = false,
  overrideStart,
  overrideEnd,
  onDragPointerDown,
  onResizePointerDown,
  onEventChange,
  cursorY,
  cursorX,
  fixedWidth,
  fixedHeight,
  onContextMenuOpenChange,
  showEventPopover,
  onEventPopoverExpand,
  onEventPopoverClose,
  onPrevWeek,
  onNextWeek,
  className,
}: CalendarEventItemProps) {
  const { event, segmentPosition = "full" } = positionedEvent;
  const { calendars, dayStartHour, dayEndHour, hourCycle, locale } =
    useCalendarConfig();
  const color = resolveEventColor(event, calendars);
  const styles = eventColorStyles[color];
  // `false` on the server and during hydration, so the markup matches
  const endIsPast = useIsPast(event.end);
  const eventIsPast = isPastProp ?? endIsPast;
  const { view, boundaryRight, headerBottom } = useCalendarPopoverBoundary();
  const isDayView = view === "day";

  /** Ref to the event button element, used to measure its viewport rect. */
  const eventRef = React.useRef<HTMLDivElement>(null);

  /**
   * Viewport-relative top & height of the event element.
   * Used to vertically align the day-view popover anchor with the event
   * so the popover appears beside the event rather than at a fixed position.
   */
  const [anchorRect, setAnchorRect] = React.useState<{
    top: number;
    height: number;
  } | null>(null);

  const showPopover = isSelected && showEventPopover;
  const detailsToggle = useEventDetailsToggle({
    showPopover: showPopover ?? false,
    showEventPopover: showEventPopover ?? false,
    close: () => onEventPopoverClose?.(event.id),
  });

  // Measure the event element's viewport position when the popover opens in
  // day view. useLayoutEffect ensures the measurement happens before paint so
  // the popover anchor is positioned correctly on first frame.
  React.useLayoutEffect(() => {
    if (!showPopover || !isDayView || !eventRef.current) {
      setAnchorRect(null);
      return;
    }
    const rect = eventRef.current.getBoundingClientRect();
    setAnchorRect({ top: rect.top, height: rect.height });
  }, [showPopover, isDayView]);

  /**
   * In day view the event spans the full grid width, so there is no room for
   * the popover beside it. Anchor it to a zero-width line at the RIGHT edge
   * of the calendar boundary, level with the event, and open it leftward
   * (side="left") — matching Notion Calendar.
   */
  const dayViewAnchor = React.useMemo<PopoverAnchorRect>(
    () => ({
      getBoundingClientRect: () =>
        new DOMRect(
          boundaryRight,
          anchorRect?.top ?? 0,
          0,
          anchorRect?.height ?? 0,
        ),
    }),
    [boundaryRight, anchorRect],
  );

  const hasTopRounding =
    segmentPosition === "start" || segmentPosition === "full";
  const hasBottomRounding =
    segmentPosition === "end" || segmentPosition === "full";
  const showTopResize =
    segmentPosition === "start" || segmentPosition === "full";
  const showBottomResize =
    segmentPosition === "end" || segmentPosition === "full";

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    onContextMenuOpenChange?.(false);
  }, [onContextMenuOpenChange]);

  const displayStart = overrideStart ?? event.start;
  const displayEnd = overrideEnd ?? event.end;

  const displayEvent: CalendarEvent =
    overrideStart && overrideEnd
      ? { ...event, start: displayStart, end: displayEnd }
      : event;

  const defaultStyle = {
    top: `${positionedEvent.top}%`,
    height: `${positionedEvent.height}%`,
    left: `${positionedEvent.left}%`,
    width: `${positionedEvent.width}%`,
    minHeight: "20px",
    zIndex: isSelected ? 20 : positionedEvent.column,
  };

  const posStyle =
    overrideStart && overrideEnd
      ? computeOverrideStyle(
          positionedEvent,
          hourHeight,
          overrideStart,
          overrideEnd,
          dayStartHour,
          dayEndHour,
        )
      : defaultStyle;

  const heightInPixels =
    overrideStart && overrideEnd
      ? Number.parseFloat(String(posStyle.height))
      : (positionedEvent.height / 100) *
        (dayEndHour - dayStartHour) *
        hourHeight;
  const isCompact = heightInPixels < 40;
  /**
   * A resize preview drawn next to the real event (its anchor or another
   * day's segment), not an event the user can focus
   */
  const isPreview = isResizing || Boolean(overrideStart && overrideEnd);
  const timeRangeLabel = formatTimeRange(
    displayEvent.start,
    displayEvent.end,
    hourCycle,
    locale,
  );

  const contentProps: EventContentProps = {
    event: displayEvent,
    view,
    placement: "time-grid",
    isSelected: isSelected ?? false,
    isPast: eventIsPast,
    isDragging: dragVariant === "dragging",
    isResizing,
    isCompact,
    timeLabel: timeRangeLabel,
  };

  if (dragVariant === "ghost") {
    return (
      <div
        aria-hidden
        className={cn(
          "absolute rounded-sm px-2 py-1 pointer-events-none opacity-30 overflow-hidden",
          className,
        )}
        style={{
          top: `${positionedEvent.top}%`,
          height: `${positionedEvent.height}%`,
          left: `${positionedEvent.left}%`,
          width: `${positionedEvent.width}%`,
          minHeight: "20px",
          zIndex: 15,
        }}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <EventContentSlot
          {...contentProps}
          className={TIME_GRID_SLOT_CLASS}
          fallback={
            <div
              className={cn(
                "relative flex flex-col h-full pl-1 overflow-hidden",
                isCompact && "flex-row items-center gap-1",
              )}
            >
              <span
                className={cn(
                  "font-medium text-[0.625rem] leading-tight break-words",
                  styles.text,
                  "dark:text-white/80",
                )}
              >
                {event.title}
              </span>
              {!isCompact && (
                <span
                  className={cn(
                    "text-[0.625rem] whitespace-nowrap",
                    styles.text,
                    "dark:text-white dark:mix-blend-overlay",
                  )}
                >
                  {formatTimeRange(event.start, event.end, hourCycle, locale)}
                </span>
              )}
            </div>
          }
        />
      </div>
    );
  }

  if (dragVariant === "placeholder") {
    return (
      <div
        aria-hidden
        className={cn(
          "absolute rounded-sm pointer-events-none border-2",
          styles.borderLine,
          className,
        )}
        style={{
          ...posStyle,
          left: "0%",
          width: "100%",
          zIndex: 25,
        }}
      />
    );
  }

  const isDraggingCopy = dragVariant === "dragging";

  if (isDraggingCopy) {
    const durationMinutes =
      (displayEnd.getTime() - displayStart.getTime()) / 60000;
    const heightPx = fixedHeight ?? (durationMinutes / 60) * hourHeight;

    const useFixed = cursorX != null && cursorY != null;

    const draggingStyle: React.CSSProperties = useFixed
      ? {
          position: "fixed",
          top: `${cursorY}px`,
          left: `${cursorX}px`,
          height: `${heightPx}px`,
          width: fixedWidth != null ? `${fixedWidth}px` : "200px",
          minHeight: "20px",
          zIndex: 30,
        }
      : {
          top: posStyle.top,
          height: `${heightPx}px`,
          left: `${positionedEvent.left}%`,
          width: `${positionedEvent.width}%`,
          minHeight: "20px",
          zIndex: 30,
        };

    return (
      <div
        tabIndex={-1}
        aria-hidden
        className={cn(
          "absolute rounded-sm px-2 py-1",
          "pointer-events-none cursor-grabbing",
          "overflow-hidden select-none opacity-80 shadow-lg",
          className,
        )}
        style={draggingStyle}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <EventContentSlot
          {...contentProps}
          isCompact={heightPx < 40}
          className={TIME_GRID_SLOT_CLASS}
          fallback={
            <div
              className={cn(
                "relative flex flex-col h-full pl-1 overflow-hidden",
                heightPx < 40 && "flex-row items-center gap-1",
              )}
            >
              <span className="font-medium text-[0.625rem] leading-tight break-words text-white dark:text-white flex items-center gap-0.5">
                {event.title}
              </span>
              {heightPx >= 40 && (
                <span className="text-[0.625rem] whitespace-nowrap text-white dark:text-white">
                  {timeRangeLabel}
                </span>
              )}
            </div>
          }
        />
      </div>
    );
  }

  function handleMouseMove(e: React.MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (showTopResize && showBottomResize && height < RESIZE_HOTZONE_PX * 2) {
      target.style.setProperty("--cursor", "row-resize");
      return;
    }

    if (showTopResize && offsetY <= RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "row-resize");
      return;
    }

    if (showBottomResize && offsetY >= height - RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "row-resize");
      return;
    }

    target.style.removeProperty("--cursor");
  }

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    e.stopPropagation();
    detailsToggle.notePress();

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (showTopResize && showBottomResize && height < RESIZE_HOTZONE_PX * 2) {
      const edge = offsetY < height / 2 ? "top" : "bottom";
      onResizePointerDown?.(e, event, edge);
      return;
    }

    if (showTopResize && offsetY <= RESIZE_HOTZONE_PX) {
      onResizePointerDown?.(e, event, "top");
      return;
    }

    if (showBottomResize && offsetY >= height - RESIZE_HOTZONE_PX) {
      onResizePointerDown?.(e, event, "bottom");
      return;
    }

    onDragPointerDown?.(e, event);
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick?.(event);
    detailsToggle.closeIfToggled();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onClick?.(event);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    onContextMenuOpenChange?.(true);
  }

  const eventElement = (
    <div
      ref={eventRef}
      role="button"
      tabIndex={isPreview ? -1 : 0}
      aria-hidden={isPreview || undefined}
      aria-label={getEventLabel(event, hourCycle, locale)}
      aria-pressed={isSelected ?? false}
      {...(!isPreview && detailsToggle.triggerProps)}
      data-event-id={isPreview ? undefined : event.id}
      onPointerDown={handlePointerDown}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      className={cn(
        "absolute px-2 py-1",
        hasTopRounding && "rounded-t-md",
        hasBottomRounding && "rounded-b-md",
        "cursor-default hover:z-10 focus:outline-none",
        EVENT_FOCUS_RING_CLASS,
        "overflow-hidden select-none",
        isSelected && "z-20",
        className,
      )}
      style={{
        ...posStyle,
        zIndex: isSelected ? 20 : positionedEvent.column,
      }}
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          hasTopRounding && "rounded-t-md",
          hasBottomRounding && "rounded-b-md",
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          hasTopRounding && "rounded-t-md",
          hasBottomRounding && "rounded-b-md",
          isSelected ? styles.border : styles.bg,
          eventIsPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border - hidden when selected (merges with bg) */}
      {!isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
            hasTopRounding && "rounded-tl-md",
            hasBottomRounding && "rounded-bl-md",
            styles.border,
            eventIsPast && "opacity-60",
          )}
        />
      )}
      <EventContentSlot
        {...contentProps}
        className={TIME_GRID_SLOT_CLASS}
        fallback={
          <div
            className={cn(
              "relative flex flex-col h-full pl-1 overflow-hidden",
              isCompact && "flex-row items-center gap-1",
            )}
          >
            <span
              className={cn(
                "font-medium text-[0.625rem] leading-tight break-words flex items-center gap-0.5",
                isSelected
                  ? "text-white dark:text-white"
                  : cn(
                      styles.text,
                      "dark:text-white/80",
                      eventIsPast && "opacity-60",
                    ),
              )}
            >
              {event.title}
            </span>
            {!isCompact && (
              <span
                className={cn(
                  "text-[0.625rem] whitespace-nowrap",
                  isSelected
                    ? "text-white dark:text-white"
                    : cn(
                        styles.text,
                        "dark:text-white dark:mix-blend-overlay",
                        eventIsPast && "opacity-60 dark:opacity-100",
                      ),
                )}
              >
                {timeRangeLabel}
              </span>
            )}
          </div>
        }
      />
    </div>
  );

  return (
    <>
      {eventElement}
      {showPopover && (
        <EventDetailPopover
          event={event}
          id={detailsToggle.detailsId}
          anchor={isDayView ? dayViewAnchor : eventRef}
          triggerRef={eventRef}
          onEventChange={onEventChange}
          onClose={() => onEventPopoverClose?.(event.id)}
          onExpand={onEventPopoverExpand}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
          side={isDayView ? "left" : "right"}
          collisionPaddingTop={isDayView ? headerBottom : undefined}
        />
      )}
      {contextMenu && (
        <EventContextMenu
          event={event}
          position={contextMenu}
          onClose={closeContextMenu}
          onEventChange={onEventChange}
        />
      )}
    </>
  );
}

/** Drag visual variant for all-day events */
export type AllDayDragVariant = "ghost" | "placeholder" | "dragging";

export interface AllDayEventItemProps extends EventItemPopoverProps {
  event: CalendarEvent;
  /** Overrides whether the event renders as past (defaults to `useIsPast`) */
  isPast?: boolean;
  isSelected?: boolean;
  onClick?: (event: CalendarEvent) => void;
  className?: string;
  /** For multi-day events: position info */
  spanStart?: boolean;
  spanEnd?: boolean;
  /** Pointerdown handler to initiate horizontal resize or drag */
  onResizePointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
    edge: "left" | "right" | "move",
  ) => void;
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  /**
   * Percentage of the event's width that is hidden off-screen to the left.
   * Used in day view to offset the title into the visible area so multi-day
   * events always show their title \u2014 \u201csticky title\u201d effect.
   */
  titleOffsetPercent?: number;
  /** Visual variant during drag operations */
  dragVariant?: AllDayDragVariant;
  /** Whether the event's edges are being dragged (passed to `renderEventContent`) */
  isResizing?: boolean;
}

const ALL_DAY_RESIZE_HOTZONE_PX = 6;

/**
 * Box for custom `renderEventContent` output in an all-day bar: above the
 * background layers, filling the bar (`pl-1` is added beside the left accent)
 */
const ALL_DAY_SLOT_CLASS =
  "relative flex h-full min-w-0 flex-1 items-center overflow-hidden";

export function AllDayEventItem({
  event,
  isPast: isPastProp,
  isSelected,
  onClick,
  className,
  spanStart = true,
  spanEnd = true,
  onResizePointerDown,
  onEventChange,
  onContextMenuOpenChange,
  showEventPopover,
  onEventPopoverExpand,
  onEventPopoverClose,
  onPrevWeek,
  onNextWeek,
  titleOffsetPercent = 0,
  dragVariant,
  isResizing = false,
}: AllDayEventItemProps) {
  const { calendars, hourCycle, locale } = useCalendarConfig();
  const color = resolveEventColor(event, calendars);
  const styles = eventColorStyles[color];
  const { view, boundaryRight, headerBottom } = useCalendarPopoverBoundary();
  const isDayView = view === "day";
  // `false` on the server and during hydration, so the markup matches
  const endIsPast = useIsPast(event.end);
  const eventIsPast = isPastProp ?? endIsPast;

  /** The event element: anchors and toggles its details popover */
  const eventRef = React.useRef<HTMLDivElement>(null);
  const showPopover = isSelected && showEventPopover;
  const detailsToggle = useEventDetailsToggle({
    showPopover: showPopover ?? false,
    showEventPopover: showEventPopover ?? false,
    close: () => onEventPopoverClose?.(event.id),
  });

  /**
   * In day view, all-day events span the full width. Anchor the popover to
   * the calendar boundary's right edge (a zero-width line the height of the
   * viewport) so it always appears at the visible right edge — even when the
   * event wrapper extends into off-screen buffer days.
   */
  const dayViewAnchor = React.useMemo<PopoverAnchorRect>(
    () => ({
      getBoundingClientRect: () =>
        new DOMRect(boundaryRight, 0, 0, window.innerHeight),
    }),
    [boundaryRight],
  );

  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  const closeContextMenu = React.useCallback(() => {
    setContextMenu(null);
    onContextMenuOpenChange?.(false);
  }, [onContextMenuOpenChange]);

  // Check if event has a specific start time (not midnight)
  const hasStartTime =
    event.start.getHours() !== 0 || event.start.getMinutes() !== 0;
  // "8:45 AM" / "4 PM", or "08:45" / "16:00" on a 24-hour clock
  const startTimeLabel = hasStartTime
    ? formatTime(event.start, hourCycle, locale)
    : "";

  const contentProps: EventContentProps = {
    event,
    view,
    placement: "all-day",
    isSelected: isSelected ?? false,
    isPast: eventIsPast,
    isDragging: dragVariant === "dragging",
    isResizing,
    isCompact: true,
    timeLabel: startTimeLabel,
  };
  const slotClassName = cn(ALL_DAY_SLOT_CLASS, spanStart && "pl-1");

  // Ghost: faded version at original position during move
  if (dragVariant === "ghost") {
    return (
      <div
        aria-hidden
        className={cn(
          "relative h-6 px-2 py-0.5 pointer-events-none opacity-30",
          "overflow-hidden select-none flex items-center gap-1",
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
          className,
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-white dark:bg-[#191919]",
            spanStart && "rounded-l-md",
            spanEnd && "rounded-r-md",
          )}
        />
        <div
          className={cn(
            "absolute inset-0",
            styles.bg,
            spanStart && "rounded-l-md",
            spanEnd && "rounded-r-md",
          )}
        />
        {spanStart && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
              spanStart && "rounded-l-md",
              styles.border,
            )}
          />
        )}
        <EventContentSlot
          {...contentProps}
          className={slotClassName}
          fallback={
            <span
              className={cn(
                "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap",
                spanStart && "pl-1",
                styles.text,
                "dark:text-white/80",
              )}
            >
              {event.title}
            </span>
          }
        />
      </div>
    );
  }

  // Placeholder: border-only outline at target position
  if (dragVariant === "placeholder") {
    return (
      <div
        aria-hidden
        className={cn(
          "relative h-6 pointer-events-none border-2 rounded-sm",
          styles.borderLine,
          className,
        )}
      />
    );
  }

  // Dragging copy: floating replica following cursor
  if (dragVariant === "dragging") {
    return (
      <div
        aria-hidden
        className={cn(
          "h-6 px-2 py-0.5 pointer-events-none cursor-grabbing",
          "overflow-hidden select-none flex items-center gap-1",
          "rounded-sm opacity-80 shadow-lg",
          className,
        )}
      >
        <div className="absolute inset-0 rounded-sm bg-white dark:bg-[#191919]" />
        <div className={cn("absolute inset-0 rounded-sm", styles.bg)} />
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] rounded-l-md dark:bg-white dark:mix-blend-overlay",
            styles.border,
          )}
        />
        <EventContentSlot
          {...contentProps}
          className={slotClassName}
          fallback={
            <span
              className={cn(
                "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap pl-1",
                styles.text,
                "dark:text-white/80",
              )}
            >
              {event.title}
            </span>
          }
        />
      </div>
    );
  }

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onClick?.(event);
    detailsToggle.closeIfToggled();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" && e.key !== " ") {
      return;
    }
    e.preventDefault();
    onClick?.(event);
  }

  function handleAllDayMouseMove(e: React.MouseEvent) {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (spanStart && offsetX <= ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "col-resize");
      return;
    }

    if (spanEnd && offsetX >= width - ALL_DAY_RESIZE_HOTZONE_PX) {
      target.style.setProperty("--cursor", "col-resize");
      return;
    }

    target.style.removeProperty("--cursor");
  }

  function handleAllDayPointerDown(e: React.PointerEvent<HTMLElement>) {
    detailsToggle.notePress();
    if (!onResizePointerDown) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const width = rect.width;

    if (spanStart && offsetX <= ALL_DAY_RESIZE_HOTZONE_PX) {
      e.stopPropagation();
      onResizePointerDown(e, event, "left");
      return;
    }

    if (spanEnd && offsetX >= width - ALL_DAY_RESIZE_HOTZONE_PX) {
      e.stopPropagation();
      onResizePointerDown(e, event, "right");
      return;
    }

    // Middle area: initiate drag (move)
    e.stopPropagation();
    onResizePointerDown(e, event, "move");
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
    onContextMenuOpenChange?.(true);
  }

  const eventElement = (
    <div
      ref={eventRef}
      role="button"
      tabIndex={0}
      aria-label={getEventLabel(event, hourCycle, locale)}
      aria-pressed={isSelected ?? false}
      {...detailsToggle.triggerProps}
      data-event-id={event.id}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenu}
      onMouseMove={handleAllDayMouseMove}
      onPointerDown={handleAllDayPointerDown}
      className={cn(
        "relative h-6 px-2 py-0.5 cursor-default",
        "hover:z-10 focus:outline-none",
        EVENT_FOCUS_RING_CLASS,
        "overflow-hidden select-none flex items-center gap-1",
        spanStart && "rounded-l-md",
        spanEnd && "rounded-r-md",
        isSelected && "z-20",
        className,
      )}
      style={
        titleOffsetPercent > 0
          ? { paddingLeft: `${titleOffsetPercent}%` }
          : undefined
      }
    >
      {/* Solid background layer to prevent transparency bleed-through */}
      <div
        className={cn(
          "absolute inset-0 bg-white dark:bg-[#191919]",
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
        )}
      />

      {/* Colored background layer - uses border color when selected */}
      <div
        className={cn(
          "absolute inset-0",
          isSelected ? styles.border : styles.bg,
          spanStart && "rounded-l-md",
          spanEnd && "rounded-r-md",
          eventIsPast && !isSelected && "opacity-60",
        )}
      />

      {/* Left border - hidden when selected (merges with bg) */}
      {spanStart && !isSelected && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-[4px] dark:bg-white dark:mix-blend-overlay",
            spanStart && "rounded-l-md",
            styles.border,
            eventIsPast && "opacity-60",
          )}
        />
      )}
      <EventContentSlot
        {...contentProps}
        className={slotClassName}
        fallback={
          <>
            <span
              className={cn(
                "relative font-medium text-[0.625rem] leading-tight whitespace-nowrap",
                spanStart && "pl-1",
                isSelected
                  ? "text-white dark:text-white"
                  : cn(
                      styles.text,
                      "dark:text-white/80",
                      eventIsPast && "opacity-60",
                    ),
              )}
            >
              {event.title}
            </span>
            {hasStartTime && (
              <span
                className={cn(
                  "relative text-[0.625rem] leading-tight whitespace-nowrap shrink-0",
                  isSelected
                    ? "text-white dark:text-white"
                    : cn(
                        styles.text,
                        "dark:text-white dark:mix-blend-overlay",
                        eventIsPast && "opacity-60",
                      ),
                )}
              >
                {startTimeLabel}
              </span>
            )}
          </>
        }
      />
    </div>
  );

  return (
    <>
      {eventElement}
      {showPopover && (
        <EventDetailPopover
          event={event}
          id={detailsToggle.detailsId}
          anchor={isDayView ? dayViewAnchor : eventRef}
          triggerRef={eventRef}
          onEventChange={onEventChange}
          onClose={() => onEventPopoverClose?.(event.id)}
          onExpand={onEventPopoverExpand}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
          side={isDayView ? "left" : "right"}
          align="start"
          collisionPaddingTop={isDayView ? headerBottom : undefined}
        />
      )}
      {contextMenu && (
        <EventContextMenu
          event={event}
          position={contextMenu}
          onClose={closeContextMenu}
          onEventChange={onEventChange}
        />
      )}
    </>
  );
}
