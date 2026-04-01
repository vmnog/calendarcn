"use client";

import { isToday, isSameMonth, format } from "date-fns";
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

/** Returns the abbreviated month name for first-of-month labels */
function getMonthName(date: Date): string {
  return format(date, "MMMM");
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
  const isFirstOfMonth = dayNumber === 1;

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
        "flex flex-col border-b border-r border-border",
        isAdjacentMonth && "opacity-50",
        isWeekend && "bg-calendar-weekend",
        className,
      )}
    >
      {/* Day number — right-aligned like Notion Calendar */}
      <div className="flex justify-end px-2 pt-1 pb-0.5">
        {todayDate ? (
          <span className="inline-flex items-center gap-1">
            {isFirstOfMonth && (
              <span className="text-xs font-bold text-primary">
                {getMonthName(date)}
              </span>
            )}
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-medium">
              {dayNumber}
            </span>
          </span>
        ) : isFirstOfMonth ? (
          <span className="text-xs py-0.5">
            <span
              className={cn(
                "font-bold",
                isAdjacentMonth ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {getMonthName(date)}
            </span>{" "}
            <span
              className={cn(
                isAdjacentMonth ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {dayNumber}
            </span>
          </span>
        ) : (
          <span
            className={cn(
              "text-xs py-0.5",
              isAdjacentMonth ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {dayNumber}
          </span>
        )}
      </div>

      {/* Slots list — overflow-visible so multi-day bars can extend across columns */}
      <div className="flex flex-col gap-px px-0.5 pb-0.5 overflow-visible">
        {slots.map((slot, index) => {
          if (slot.type === "event-bar") {
            if (slot.isStart) {
              if (slot.colSpan > 1) {
                return (
                  <div
                    key={`${slot.event.id}-${index}`}
                    className="relative"
                    style={{ width: `${slot.colSpan * 100}%`, zIndex: 1 }}
                  >
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
