"use client";

import type React from "react";
import { cn } from "@/lib/utils";
import { isPast, isSameDay } from "date-fns";
import { useCallback } from "react";
import { calculateAllDayEventRows } from "@/lib/event-utils";
import { AllDayEventItem } from "./calendar-event-item";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
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
  onContextMenuOpenChange,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
  visibleStartIndex,
  visibleCount,
  className,
}: WeekViewAllDayRowProps) {
  const allEventRows = calculateAllDayEventRows(allDayEvents, days);

  // Filter out events entirely within buffer columns so they don't peek
  // through due to sub-pixel rendering at the scroll boundary.
  const visibleEnd =
    visibleStartIndex != null && visibleCount != null
      ? visibleStartIndex + visibleCount - 1
      : days.length - 1;
  const eventRows =
    visibleStartIndex != null
      ? allEventRows.filter(
          ({ startColumn, endColumn }) =>
            endColumn >= visibleStartIndex && startColumn <= visibleEnd,
        )
      : allEventRows;
  const maxRow =
    eventRows.length > 0 ? Math.max(...eventRows.map((r) => r.row)) + 1 : 0;
  const contentHeight =
    maxRow > 0 ? maxRow * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP) + 8 : 32;

  return (
    <div
      className={cn(
        "border-border flex border-t border-b bg-background",
        className,
      )}
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
                const isWeekend =
                  day.date.getDay() === 0 || day.date.getDay() === 6;
                return (
                  <div
                    key={day.date.toISOString()}
                    className={cn(
                      "border-border border-l first:border-l-0 h-full",
                      isWeekend && "bg-calendar-weekend",
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
                    onEventChange={onEventChange}
                    onContextMenuOpenChange={onContextMenuOpenChange}
                    isSidebarOpen={isSidebarOpen}
                    onDockToSidebar={onDockToSidebar}
                    onClosePopover={onClosePopover}
                    onPrevWeek={onPrevWeek}
                    onNextWeek={onNextWeek}
                    visibleStartIndex={visibleStartIndex}
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
  /** Callback when an event is changed (e.g. color change from context menu) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback when context menu open state changes */
  onContextMenuOpenChange?: (open: boolean) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  /** Index of the first visible column (for sticky-title offset) */
  visibleStartIndex?: number;
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
  onEventChange,
  onContextMenuOpenChange,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  onPrevWeek,
  onNextWeek,
  visibleStartIndex,
}: AllDayEventRowProps) {
  const { view } = useCalendarPopoverBoundary();
  const isDayView = view === "day";

  const left = (startColumn / totalColumns) * 100;
  // Day view uses a smaller right gap than week view so events nearly fill
  // the column but still show a sliver of the grid \u2014 matching Notion Calendar.
  const columnWidth = 100 / totalColumns;
  const rightGap = isDayView ? columnWidth * 0.02 : columnWidth * 0.08;
  const width = ((endColumn - startColumn + 1) / totalColumns) * 100 - rightGap;
  const top = row * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP);

  // During resize, both edges are always visible so force rounding on both sides
  const spanStart =
    isBeingResized || isSameDay(event.start, days[startColumn].date);
  const spanEnd = isBeingResized || isSameDay(event.end, days[endColumn].date);

  /**
   * In day view with buffer days (3 columns: buffer | visible | buffer),
   * the visible column is index 1. Multi-day events that start in the left
   * buffer (column 0) have their title off-screen. Calculate the percentage
   * offset needed to push the title into the visible area.
   *
   * CSS `padding-left` percentages are relative to the **containing block's
   * width** (the wrapper div), not the grid container. We must convert from
   * container-relative coordinates to wrapper-relative coordinates:
   *   offset = (visibleStart% - left%) \u00D7 (100 / width%)
   */
  const visibleColumnIndex = visibleStartIndex ?? 1;
  const visibleStartPercent = (visibleColumnIndex / totalColumns) * 100;
  const hiddenContainerPercent = isDayView
    ? Math.max(0, visibleStartPercent - left)
    : 0;
  /** Small extra nudge (in container %) so the title doesn't sit flush
   *  against the visible column edge \u2014 gives it a bit of breathing room. */
  const TITLE_NUDGE_PERCENT = 0.1;
  const titleOffsetPercent =
    hiddenContainerPercent > 0 && width > 0
      ? ((hiddenContainerPercent + TITLE_NUDGE_PERCENT) / width) * 100
      : 0;

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
        onEventChange={onEventChange}
        onContextMenuOpenChange={onContextMenuOpenChange}
        isSidebarOpen={isSidebarOpen}
        onDockToSidebar={onDockToSidebar}
        onClosePopover={onClosePopover}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
        titleOffsetPercent={titleOffsetPercent}
      />
    </div>
  );
}
