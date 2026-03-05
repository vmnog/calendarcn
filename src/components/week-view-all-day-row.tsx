"use client";

import type React from "react";
import { cn } from "@/lib/utils";
import { isPast, isSameDay } from "date-fns";
import { useCallback } from "react";
import { calculateAllDayEventRows } from "@/lib/event-utils";
import { AllDayEventItem } from "./calendar-event-item";
import type { CalendarEvent, WeekViewAllDayRowProps } from "./week-view-types";

const ALL_DAY_EVENT_HEIGHT = 24;
const ALL_DAY_ROW_GAP = 2;

/**
 * All-day row for displaying all-day events
 * Shows "All-day" label on the left with day columns
 */
export function WeekViewAllDayRow({
  days,
  allDayEvents = [],
  onEventClick,
  selectedEventId,
  scrollStyle,
  allDayResizeState,
  onAllDayResizeMouseDown,
  allDayScrollContentRef,
  onEventChange,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
  className,
}: WeekViewAllDayRowProps) {
  const eventRows = calculateAllDayEventRows(allDayEvents, days);
  const maxRow = eventRows.length > 0 ? Math.max(...eventRows.map((r) => r.row)) + 1 : 0;
  const contentHeight = maxRow > 0 ? maxRow * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP) + 8 : 32;

  return (
    <div
      className={cn("border-border flex border-t border-b bg-background", className)}
    >
      {/* All-day label */}
      <div className="border-border text-muted-foreground flex w-16 flex-shrink-0 items-start justify-end border-r px-2 py-2 text-xxs">
        All-day
      </div>

      {/* Day columns for all-day events - wrapped for scroll sync */}
      <div className="flex-1 overflow-hidden">
        <div ref={allDayScrollContentRef} style={scrollStyle}>
          <div className="relative" style={{ minHeight: `${contentHeight}px` }}>
            {/* Background grid */}
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
            >
              {days.map((day) => {
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
                return (
                  <div
                    key={day.date.toISOString()}
                    className={cn(
                      "border-border border-l first:border-l-0 h-full",
                      isWeekend && "bg-calendar-weekend"
                    )}
                  />
                );
              })}
            </div>

            {/* Events */}
            <div className="relative py-1 px-0.5">
              {eventRows.map(({ event, startColumn, endColumn, row }) => {
                const isBeingResized =
                  allDayResizeState?.eventId === event.id &&
                  allDayResizeState.isResizing;
                const displayStartColumn = isBeingResized
                  ? allDayResizeState.currentStartColumn
                  : startColumn;
                const displayEndColumn = isBeingResized
                  ? allDayResizeState.currentEndColumn
                  : endColumn;

                return (
                  <AllDayEventRow
                    key={event.id}
                    event={event}
                    startColumn={displayStartColumn}
                    endColumn={displayEndColumn}
                    row={row}
                    totalColumns={days.length}
                    days={days}
                    onEventClick={onEventClick}
                    isSelected={event.id === selectedEventId}
                    onAllDayResizeMouseDown={onAllDayResizeMouseDown}
                    originalStartColumn={startColumn}
                    originalEndColumn={endColumn}
                    isBeingResized={isBeingResized}
                    isSidebarOpen={isSidebarOpen}
                    onDockToSidebar={onDockToSidebar}
                    onClosePopover={onClosePopover}
                    onPrevWeek={onPrevWeek}
                    onNextWeek={onNextWeek}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AllDayEventRowProps {
  event: CalendarEvent;
  startColumn: number;
  endColumn: number;
  row: number;
  totalColumns: number;
  days: WeekViewAllDayRowProps["days"];
  onEventClick?: (event: CalendarEvent) => void;
  isSelected?: boolean;
  onAllDayResizeMouseDown?: WeekViewAllDayRowProps["onAllDayResizeMouseDown"];
  originalStartColumn: number;
  originalEndColumn: number;
  isBeingResized?: boolean;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}

function AllDayEventRow({
  event,
  startColumn,
  endColumn,
  row,
  totalColumns,
  days,
  onEventClick,
  isSelected,
  onAllDayResizeMouseDown,
  originalStartColumn,
  originalEndColumn,
  isBeingResized,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
}: AllDayEventRowProps) {
  const left = (startColumn / totalColumns) * 100;
  // Subtract ~1.2% for right gap (same 8% gap as regular events, scaled to column width)
  const columnWidth = 100 / totalColumns;
  const rightGap = columnWidth * 0.08;
  const width = ((endColumn - startColumn + 1) / totalColumns) * 100 - rightGap;
  const top = row * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP);

  // During resize, both edges are always visible so force rounding on both sides
  const spanStart = isBeingResized || isSameDay(event.start, days[startColumn].date);
  const spanEnd = isBeingResized || isSameDay(event.end, days[endColumn].date);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, ev: CalendarEvent, edge: "left" | "right") => {
      onAllDayResizeMouseDown?.(
        e,
        ev,
        edge,
        originalStartColumn,
        originalEndColumn,
      );
    },
    [onAllDayResizeMouseDown, originalStartColumn, originalEndColumn],
  );

  return (
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${top}px`,
        paddingLeft: "2px",
        paddingRight: "2px",
      }}
    >
      <AllDayEventItem
        event={event}
        isPast={isPast(event.end)}
        isSelected={isSelected}
        onClick={onEventClick}
        spanStart={spanStart}
        spanEnd={spanEnd}
        onResizeMouseDown={handleResizeMouseDown}
        isSidebarOpen={isSidebarOpen}
        onDockToSidebar={onDockToSidebar}
        onClosePopover={onClosePopover}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
      />
    </div>
  );
}
