"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./calendar-types";
import type { MonthWeekRow } from "@/lib/event-utils";
import { calculateMonthCellLayout, getMonthSlotCount } from "@/lib/event-utils";
import { MonthViewDayCell } from "./month-view-day-cell";

/** Default cell height in px before ResizeObserver measures the real height */
const DEFAULT_CELL_HEIGHT = 120;

export interface MonthViewGridProps {
  weekRows: MonthWeekRow[];
  events: CalendarEvent[];
  currentMonth: Date;
  showWeekNumbers?: boolean;
  showWeekends?: boolean;
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
  /** ID of the event currently being dragged (renders as ghost) */
  dragEventId?: string;
  /** ID of the event currently being resized (renders as selected) */
  resizeEventId?: string;
  /** Target date for drag placeholder */
  dragTargetDate?: Date;
  /** The event being dragged (for placeholder rendering) */
  dragEvent?: CalendarEvent;
  /** Whether the selected event shows its details popover */
  showEventPopover?: boolean;
  onEventChange?: (event: CalendarEvent) => void;
  /** Callback for the popover's expand button (hidden when absent) */
  onEventPopoverExpand?: () => void;
  /** Callback to close the popover (clears the selection) */
  /** Closes the given event's popover (clears it only while it is still selected) */
  onEventPopoverClose?: (eventId: string) => void;
  /** Number of rows visible in the viewport (for row height calculation) */
  visibleRowCount?: number;
  /** Index in `weekRows` of the first on-screen row (the rest are scroll buffer) */
  visibleRowStart?: number;
  /** CSS style for scroll transform */
  scrollStyle?: React.CSSProperties;
  /** Forwarded ref for the grid container (used by drag hook) */
  gridRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
}

export function MonthViewGrid({
  weekRows,
  events,
  currentMonth,
  showWeekNumbers = false,
  showWeekends = true,
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
  visibleRowCount,
  visibleRowStart = 0,
  scrollStyle,
  gridRef,
  className,
}: MonthViewGridProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = gridRef ?? localRef;

  const [cellHeight, setCellHeight] = useState(DEFAULT_CELL_HEIGHT);
  const rowCountForHeight = visibleRowCount ?? weekRows.length;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (rowCountForHeight === 0) return;
      setCellHeight(el.clientHeight / rowCountForHeight);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [containerRef, rowCountForHeight]);

  const maxSlots = getMonthSlotCount(cellHeight);

  const cellLayouts = useMemo(
    () => calculateMonthCellLayout(weekRows, events, maxSlots),
    [weekRows, events, maxSlots],
  );

  const columnCount = showWeekends ? 7 : 5;

  return (
    <div
      ref={containerRef}
      // Clip, not hide: a hidden box can still be scrolled by script or the
      // browser (e.g. scrollIntoView), shifting the rows. They only move by
      // scrollStyle.
      className={cn("relative h-full overflow-clip", className)}
    >
      <div style={scrollStyle}>
        <div
          className="grid"
          style={{
            gridTemplateRows: `repeat(${weekRows.length}, ${cellHeight || 0}px)`,
          }}
        >
          {weekRows.map((weekRow, rowIndex) => {
            // Rows above and below the screen are scroll buffer: inert, so
            // their events can't be tabbed to or read out
            const isOnScreen =
              rowIndex >= visibleRowStart &&
              rowIndex < visibleRowStart + (visibleRowCount ?? weekRows.length);
            const visibleDays = showWeekends
              ? weekRow.days
              : weekRow.days.filter(
                  (d) => d.date.getDay() !== 0 && d.date.getDay() !== 6,
                );

            const weekNumberCol = showWeekNumbers ? "2rem " : "";
            const dayCols = `repeat(${columnCount}, minmax(0, 1fr))`;
            const gridTemplateColumns = `${weekNumberCol}${dayCols}`;

            return (
              <div
                key={weekRow.days[0].date.toISOString()}
                inert={!isOnScreen}
                className="grid min-h-0"
                style={{ gridTemplateColumns }}
              >
                {showWeekNumbers && (
                  <div className="flex items-start justify-center pt-1.5 text-[10px] text-muted-foreground border-b border-r border-border">
                    {weekRow.weekNumber}
                  </div>
                )}

                {visibleDays.map((day) => {
                  const key = startOfDay(day.date).toISOString();
                  const layout = cellLayouts.get(key);

                  return (
                    <MonthViewDayCell
                      key={key}
                      date={day.date}
                      currentMonth={currentMonth}
                      barSlots={layout?.barSlots ?? []}
                      eventSlots={layout?.eventSlots ?? []}
                      totalEvents={layout?.totalEvents ?? 0}
                      onEventClick={onEventClick}
                      onContextMenu={onContextMenu}
                      onMoreClick={onMoreClick}
                      onDayNumberClick={onDayNumberClick}
                      onBackgroundClick={onBackgroundClick}
                      onDragPointerDown={onDragPointerDown}
                      onResizePointerDown={onResizePointerDown}
                      selectedEventId={selectedEventId}
                      dragEventId={dragEventId}
                      resizeEventId={resizeEventId}
                      dragTargetDate={dragTargetDate}
                      dragEvent={dragEvent}
                      showEventPopover={showEventPopover}
                      onEventChange={onEventChange}
                      onEventPopoverExpand={onEventPopoverExpand}
                      onEventPopoverClose={onEventPopoverClose}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
