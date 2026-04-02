"use client";

import {
  isToday,
  isSameMonth,
  isSameDay,
  format,
  differenceInCalendarDays,
  addDays,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent, EventColor } from "./calendar-types";
import type { MonthCellSlot } from "@/lib/event-utils";
import { isMultiDayEvent } from "@/lib/event-utils";
import { Popover, PopoverAnchor } from "@/components/ui/popover";
import { EventDetailPopover } from "./event-detail-popover";
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
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  selectedEventId?: string;
  dragEventId?: string;
  dragTargetDate?: Date;
  dragEvent?: CalendarEvent;
  isSidebarOpen?: boolean;
  onEventChange?: (event: CalendarEvent) => void;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  className?: string;
}

/** Returns the full month name for first-of-month labels */
function getMonthName(date: Date): string {
  return format(date, "MMMM");
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
  onDragMouseDown,
  selectedEventId,
  dragEventId,
  dragTargetDate,
  dragEvent,
  isSidebarOpen,
  onEventChange,
  onDockToSidebar,
  onClosePopover,
  className,
}: MonthViewDayCellProps) {
  const dayNumber = date.getDate();
  const todayDate = isToday(date);
  const isAdjacentMonth = !isSameMonth(date, currentMonth);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isFirstOfMonth = dayNumber === 1;

  // Find the selected event in this cell's slots (for cell-level popover).
  // For multi-day bars that span across week rows, only show the popover
  // on the cell matching the event's true start date to avoid duplicates.
  const selectedCellEvent =
    selectedEventId && isSidebarOpen === false && !dragEventId
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

  const cellContent = (
    <div
      data-date={date.toISOString()}
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
            <span className="font-semibold">{getMonthName(date)}</span>
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
                        isSelected={selectedEventId === slot.event.id}
                        isGhost={dragEventId === slot.event.id}
                        onClick={onEventClick}
                        onContextMenu={onContextMenu}
                        onDragMouseDown={onDragMouseDown}
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
                      onClick={onEventClick}
                      onContextMenu={onContextMenu}
                      onDragMouseDown={onDragMouseDown}
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
                onClick={onEventClick}
                onContextMenu={onContextMenu}
                onDragMouseDown={onDragMouseDown}
              />
            );
            return itemEl;
          }

          if (slot.type === "more") {
            return (
              <button
                key={`more-${index}`}
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

  if (!selectedCellEvent) return cellContent;

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClosePopover?.();
      }}
    >
      <PopoverAnchor asChild>{cellContent}</PopoverAnchor>
      <EventDetailPopover
        event={selectedCellEvent}
        onEventChange={onEventChange}
        onClose={() => onClosePopover?.()}
        onDockToSidebar={() => onDockToSidebar?.()}
        side="right"
        align="start"
      />
    </Popover>
  );
}
