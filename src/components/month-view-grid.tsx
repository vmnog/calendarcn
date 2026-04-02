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
  onDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  selectedEventId?: string;
  /** ID of the event currently being dragged (renders as ghost) */
  dragEventId?: string;
  /** Target date for drag placeholder */
  dragTargetDate?: Date;
  /** The event being dragged (for placeholder rendering) */
  dragEvent?: CalendarEvent;
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
  onDragMouseDown,
  selectedEventId,
  dragEventId,
  dragTargetDate,
  dragEvent,
  gridRef,
  className,
}: MonthViewGridProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const containerRef = gridRef ?? localRef;

  const [cellHeight, setCellHeight] = useState(DEFAULT_CELL_HEIGHT);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      if (weekRows.length === 0) return;
      setCellHeight(el.clientHeight / weekRows.length);
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [containerRef, weekRows.length]);

  const maxSlots = getMonthSlotCount(cellHeight);

  const cellLayouts = useMemo(
    () => calculateMonthCellLayout(weekRows, events, maxSlots),
    [weekRows, events, maxSlots],
  );

  const columnCount = showWeekends ? 7 : 5;

  return (
    <div
      ref={containerRef}
      className={cn("grid h-full", className)}
      style={{
        gridTemplateRows: `repeat(${weekRows.length}, 1fr)`,
      }}
    >
      {weekRows.map((weekRow) => {
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
            key={weekRow.weekNumber}
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
                  onDragMouseDown={onDragMouseDown}
                  selectedEventId={selectedEventId}
                  dragEventId={dragEventId}
                  dragTargetDate={dragTargetDate}
                  dragEvent={dragEvent}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
