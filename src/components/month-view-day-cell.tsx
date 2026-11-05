"use client";

import { useId, useRef } from "react";
import {
  isSameMonth,
  isSameDay,
  format,
  differenceInCalendarDays,
  addDays,
  startOfDay,
} from "date-fns";
import type { Locale } from "date-fns";
import { cn } from "@/lib/utils";
import { useToday } from "@/hooks/use-now";
import type { CalendarEvent, EventColor } from "./calendar-types";
import type { MonthCellSlot } from "@/lib/event-utils";
import {
  formatCellDate,
  formatFullDate,
  isMultiDayEvent,
} from "@/lib/event-utils";
import { EventDetailPopover } from "./event-detail-popover";
import { getEventDetailsTriggerProps } from "./calendar-event-item";
import { useCalendarConfig } from "./calendar-provider";
import { MonthViewEventItem } from "./month-view-event-item";
import { MonthViewEventBar } from "./month-view-event-bar";

export interface MonthViewDayCellProps {
  date: Date;
  currentMonth: Date;
  barSlots: MonthCellSlot[];
  eventSlots: MonthCellSlot[];
  totalEvents: number;
  onEventClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onMoreClick?: (date: Date) => void;
  onDayNumberClick?: (date: Date) => void;
  onBackgroundClick?: () => void;
  onDragPointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
  onResizePointerDown?: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
    edge: "left" | "right",
  ) => void;
  selectedEventId?: string;
  dragEventId?: string;
  /** ID of the event currently being resized (renders as selected) */
  resizeEventId?: string;
  dragTargetDate?: Date;
  dragEvent?: CalendarEvent;
  /** Whether the selected event shows its details popover */
  showEventPopover?: boolean;
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback for the popover's expand button (hidden when absent) */
  onEventPopoverExpand?: () => void;
  /** Callback to close the popover (clears the selection) */
  /** Closes the given event's popover (clears it only while it is still selected) */
  onEventPopoverClose?: (eventId: string) => void;
  className?: string;
}

/** Returns the full month name for first-of-month labels */
function getMonthName(date: Date, locale: Locale): string {
  return format(date, "MMMM", { locale });
}

/** Border color for drag placeholder outline */
const placeholderBorderStyles: Record<EventColor, string> = {
  red: "border-event-red-border",
  orange: "border-event-orange-border",
  yellow: "border-event-yellow-border",
  green: "border-event-green-border",
  blue: "border-event-blue-border",
  purple: "border-event-purple-border",
  gray: "border-event-gray-border",
};

export function MonthViewDayCell({
  date,
  currentMonth,
  barSlots,
  eventSlots,
  onEventClick,
  onContextMenu,
  onMoreClick,
  onDayNumberClick,
  onBackgroundClick,
  onDragPointerDown,
  onResizePointerDown,
  selectedEventId,
  dragEventId,
  resizeEventId,
  dragTargetDate,
  dragEvent,
  showEventPopover,
  onEventChange,
  onEventPopoverExpand,
  onEventPopoverClose,
  className,
}: MonthViewDayCellProps) {
  const dayNumber = date.getDate();
  const { locale } = useCalendarConfig();
  /** The cell: the selected event's details popover opens beside it */
  const cellRef = useRef<HTMLDivElement>(null);
  /** The selected event's details popover, for its event's `aria-controls` */
  const detailsId = useId();
  // `null` on the server and during hydration, so no cell is marked as today
  const today = useToday();
  const todayDate = today !== null && isSameDay(date, today);
  const isAdjacentMonth = !isSameMonth(date, currentMonth);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFirstOfMonth = dayNumber === 1;

  // Find the selected event in this cell's slots (for cell-level popover).
  // For multi-day bars that span across week rows, only show the popover
  // on the cell matching the event's true start date to avoid duplicates.
  const selectedCellEvent =
    selectedEventId && showEventPopover && !dragEventId && !resizeEventId
      ? (() => {
          for (const slot of barSlots) {
            if (
              slot.type === "event-bar" &&
              slot.isStart &&
              slot.event.id === selectedEventId &&
              isSameDay(startOfDay(slot.event.start), date)
            )
              return slot.event;
          }
          for (const slot of eventSlots) {
            if (slot.type === "event-item" && slot.event.id === selectedEventId)
              return slot.event;
          }
          return null;
        })()
      : null;

  /** ARIA for an event in this cell: the selected one controls the popover */
  const detailsTriggerProps = (eventId: string) =>
    getEventDetailsTriggerProps({
      showEventPopover: showEventPopover ?? false,
      showPopover: selectedCellEvent?.id === eventId,
      detailsId,
    });

  const showPlaceholder =
    dragEventId &&
    dragTargetDate &&
    dragEvent &&
    isSameDay(date, dragTargetDate);
  const placeholderBorder = dragEvent
    ? placeholderBorderStyles[dragEvent.color ?? "blue"]
    : "border-event-blue-border";

  // Calculate placeholder span for multi-day events
  const isMultiDay = dragEvent
    ? dragEvent.isAllDay || isMultiDayEvent(dragEvent)
    : false;
  const placeholderSpan = dragEvent
    ? isMultiDay
      ? differenceInCalendarDays(
          dragEvent.isAllDay
            ? addDays(startOfDay(dragEvent.end), 1)
            : dragEvent.end,
          dragEvent.start,
        )
      : 1
    : 1;

  function handleBackgroundClick(e: React.MouseEvent) {
    if (
      (e.target as HTMLElement).closest("[role=button]") ||
      (e.target as HTMLElement).closest("button")
    )
      return;
    onBackgroundClick?.();
  }

  /** The cell's day in full ("Tuesday, October 31"), its accessible name */
  const fullDate = formatFullDate(date, locale);

  const cellContent = (
    <div
      ref={cellRef}
      data-date={formatCellDate(date)}
      role="group"
      aria-label={fullDate}
      onClick={handleBackgroundClick}
      className={cn(
        "flex flex-col border-b border-r border-border min-w-0",
        isWeekend && "bg-calendar-weekend",
        className,
      )}
    >
      {/* Day number — right-aligned like Notion Calendar */}
      <div className="flex justify-end items-center px-2 pt-0.5 pb-0.5">
        <button
          type="button"
          aria-label={fullDate}
          onClick={() => onDayNumberClick?.(date)}
          className={cn(
            "flex h-6 min-w-6 items-center justify-center rounded-sm px-1 text-[13px] font-medium leading-none cursor-pointer select-none gap-1",
            todayDate
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : cn(
                  "hover:bg-accent",
                  isAdjacentMonth ? "text-muted-foreground" : "text-foreground",
                ),
          )}
        >
          {isFirstOfMonth && (
            <span className="font-semibold">{getMonthName(date, locale)}</span>
          )}
          {dayNumber}
        </button>
      </div>

      {/* Spanning bars + multi-day drag placeholder */}
      {(barSlots.length > 0 || (showPlaceholder && isMultiDay)) && (
        <div className="relative flex flex-col gap-px pb-px">
          {/* Multi-day drag placeholder — absolute overlay */}
          {showPlaceholder && isMultiDay && (
            <div
              aria-hidden
              className={cn(
                "absolute top-0 left-0.5 right-0.5 h-5 rounded-sm border-2 pointer-events-none",
                placeholderBorder,
              )}
              style={{
                width: `calc(${placeholderSpan * 100}% - 4px)`,
                zIndex: 30,
              }}
            />
          )}
          {barSlots.map((slot, index) => {
            if (slot.type === "event-bar") {
              if (slot.isStart) {
                if (slot.colSpan > 1) {
                  const barEl = (
                    <div
                      key={`${slot.event.id}-${index}`}
                      className="relative pl-0.5 pr-0.5"
                      style={{ width: `${slot.colSpan * 100}%`, zIndex: 1 }}
                    >
                      <MonthViewEventBar
                        event={slot.event}
                        colSpan={slot.colSpan}
                        roundedLeft={slot.roundedLeft}
                        roundedRight={slot.roundedRight}
                        isSelected={
                          selectedEventId === slot.event.id ||
                          resizeEventId === slot.event.id
                        }
                        isGhost={dragEventId === slot.event.id}
                        isResizing={resizeEventId === slot.event.id}
                        detailsTriggerProps={detailsTriggerProps(slot.event.id)}
                        onClick={onEventClick}
                        onContextMenu={onContextMenu}
                        onDragPointerDown={onDragPointerDown}
                        onResizePointerDown={onResizePointerDown}
                      />
                    </div>
                  );
                  return barEl;
                }
                return (
                  <div key={`${slot.event.id}-${index}`} className="px-0.5">
                    <MonthViewEventBar
                      event={slot.event}
                      colSpan={slot.colSpan}
                      roundedLeft={slot.roundedLeft}
                      roundedRight={slot.roundedRight}
                      isSelected={selectedEventId === slot.event.id}
                      isResizing={resizeEventId === slot.event.id}
                      detailsTriggerProps={detailsTriggerProps(slot.event.id)}
                      onClick={onEventClick}
                      onContextMenu={onContextMenu}
                      onDragPointerDown={onDragPointerDown}
                      onResizePointerDown={onResizePointerDown}
                    />
                  </div>
                );
              }
              // Continuation cell — invisible placeholder (bar rendered from start cell)
              return (
                <div
                  key={`bar-placeholder-${index}`}
                  className="h-5 shrink-0"
                />
              );
            }

            // spacer — maintains vertical alignment with bars on other days
            return <div key={`spacer-${index}`} className="h-5 shrink-0" />;
          })}
        </div>
      )}

      {/* Timed events — overflow-hidden to clip excess */}
      <div className="relative flex flex-col gap-px px-0.5 pb-0.5 overflow-hidden min-h-0 flex-1">
        {/* Timed event drag placeholder — absolute overlay, doesn't push events */}
        {showPlaceholder && !isMultiDay && (
          <div
            aria-hidden
            className={cn(
              "absolute inset-x-0.5 top-0 h-5 rounded-sm border-2 pointer-events-none z-30",
              placeholderBorder,
            )}
          />
        )}
        {eventSlots.map((slot, index) => {
          if (slot.type === "event-item") {
            const itemEl = (
              <MonthViewEventItem
                key={`${slot.event.id}-${index}`}
                event={slot.event}
                isSelected={selectedEventId === slot.event.id}
                isGhost={dragEventId === slot.event.id}
                detailsTriggerProps={detailsTriggerProps(slot.event.id)}
                onClick={onEventClick}
                onContextMenu={onContextMenu}
                onDragPointerDown={onDragPointerDown}
              />
            );
            return itemEl;
          }

          if (slot.type === "more") {
            return (
              <button
                key={`more-${index}`}
                type="button"
                aria-label={`Show ${slot.count} more ${slot.count === 1 ? "event" : "events"} on ${fullDate}`}
                onClick={() => onMoreClick?.(date)}
                className="px-1 py-0.5 text-xs font-bold text-foreground rounded-sm text-left cursor-default select-none"
              >
                {slot.count} more
              </button>
            );
          }

          return null;
        })}
      </div>
    </div>
  );

  return (
    <>
      {cellContent}
      {selectedCellEvent && (
        <EventDetailPopover
          event={selectedCellEvent}
          id={detailsId}
          anchor={cellRef}
          onEventChange={onEventChange}
          onClose={() => onEventPopoverClose?.(selectedCellEvent.id)}
          onExpand={onEventPopoverExpand}
          side="right"
          align="start"
        />
      )}
    </>
  );
}
