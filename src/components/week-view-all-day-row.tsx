"use client";

import { cn } from "@/lib/utils";
import { isPast, isSameDay } from "date-fns";
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
        <div style={scrollStyle}>
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
              {eventRows.map(({ event, startColumn, endColumn, row }) => (
                <AllDayEventRow
                  key={event.id}
                  event={event}
                  startColumn={startColumn}
                  endColumn={endColumn}
                  row={row}
                  totalColumns={days.length}
                  days={days}
                  onEventClick={onEventClick}
                  isSelected={event.id === selectedEventId}
                />
              ))}
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
}: AllDayEventRowProps) {
  const left = (startColumn / totalColumns) * 100;
  // Subtract ~1.2% for right gap (same 8% gap as regular events, scaled to column width)
  const columnWidth = 100 / totalColumns;
  const rightGap = columnWidth * 0.08;
  const width = ((endColumn - startColumn + 1) / totalColumns) * 100 - rightGap;
  const top = row * (ALL_DAY_EVENT_HEIGHT + ALL_DAY_ROW_GAP);

  const spanStart = isSameDay(event.start, days[startColumn].date);
  const spanEnd = isSameDay(event.end, days[endColumn].date);

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
      />
    </div>
  );
}
