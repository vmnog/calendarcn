"use client";

import { isToday, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./calendar-types";
import type { MonthCellSlot } from "@/lib/event-utils";
import { MonthViewEventItem } from "./month-view-event-item";
import { MonthViewEventBar } from "./month-view-event-bar";

export interface MonthViewDayCellProps {
  date: Date;
  currentMonth: Date;
  slots: MonthCellSlot[];
  totalEvents: number;
  onEventClick?: (event: CalendarEvent) => void;
  onContextMenu?: (e: React.MouseEvent, event: CalendarEvent) => void;
  onMoreClick?: (date: Date) => void;
  onBackgroundClick?: () => void;
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  selectedEventId?: string;
  className?: string;
}

export function MonthViewDayCell({
  date,
  currentMonth,
  slots,
  onEventClick,
  onContextMenu,
  onMoreClick,
  onBackgroundClick,
  onDragMouseDown,
  selectedEventId,
  className,
}: MonthViewDayCellProps) {
  const dayNumber = date.getDate();
  const todayDate = isToday(date);
  const isAdjacentMonth = !isSameMonth(date, currentMonth);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  function handleBackgroundClick(e: React.MouseEvent) {
    if (
      (e.target as HTMLElement).closest("[role=button]") ||
      (e.target as HTMLElement).closest("button")
    )
      return;
    onBackgroundClick?.();
  }

  return (
    <div
      data-date={date.toISOString()}
      onClick={handleBackgroundClick}
      className={cn(
        "flex flex-col overflow-hidden border-b border-r border-border",
        isAdjacentMonth && "opacity-50",
        isWeekend && "bg-calendar-weekend",
        className,
      )}
    >
      {/* Day number header */}
      <div className="flex justify-center pt-1 pb-0.5">
        <span
          className={cn(
            "flex size-6 items-center justify-center text-xs",
            todayDate &&
              "rounded-full bg-primary text-primary-foreground font-medium",
          )}
        >
          {dayNumber}
        </span>
      </div>

      {/* Slots list */}
      <div className="flex flex-col gap-0.5 px-0.5 pb-1">
        {slots.map((slot, index) => {
          if (slot.type === "event-bar") {
            if (slot.isStart) {
              return (
                <MonthViewEventBar
                  key={`${slot.event.id}-${index}`}
                  event={slot.event}
                  colSpan={slot.colSpan}
                  roundedLeft={slot.roundedLeft}
                  roundedRight={slot.roundedRight}
                  isSelected={selectedEventId === slot.event.id}
                  onClick={onEventClick}
                  onContextMenu={onContextMenu}
                  onDragMouseDown={onDragMouseDown}
                />
              );
            }
            return (
              <div key={`bar-placeholder-${index}`} className="h-5 shrink-0" />
            );
          }

          if (slot.type === "event-item") {
            return (
              <MonthViewEventItem
                key={`${slot.event.id}-${index}`}
                event={slot.event}
                isSelected={selectedEventId === slot.event.id}
                onClick={onEventClick}
                onContextMenu={onContextMenu}
                onDragMouseDown={onDragMouseDown}
              />
            );
          }

          if (slot.type === "more") {
            return (
              <button
                key={`more-${index}`}
                onClick={() => onMoreClick?.(date)}
                className="px-1 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-sm text-left cursor-pointer select-none"
              >
                {slot.count} more
              </button>
            );
          }

          // spacer
          return <div key={`spacer-${index}`} className="h-5 shrink-0" />;
        })}
      </div>
    </div>
  );
}
