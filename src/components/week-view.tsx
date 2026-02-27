"use client";

import { addDays, eachDayOfInterval, format, getWeek } from "date-fns";

import { cn } from "@/lib/utils";
import { useCalendarView } from "@/hooks/use-calendar-view";
import type { WeekViewProps } from "./week-view-types";
import { WeekViewAllDayRow } from "./week-view-all-day-row";
import { WeekViewDayColumns } from "./week-view-day-columns";
import { WeekViewGrid } from "./week-view-grid";
import { WeekViewTimeAxis } from "./week-view-time-axis";
import { WeekViewTimeIndicator } from "./week-view-time-indicator";

const VISIBLE_DAYS = 7;

export function getCalendarHeaderInfo(
  currentDate: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6
) {
  return {
    monthName: format(currentDate, "MMMM"),
    year: format(currentDate, "yyyy"),
    weekNumber: getWeek(currentDate, { weekStartsOn }),
  };
}

export function getVisibleDays(currentDate: Date): Date[] {
  const end = addDays(currentDate, VISIBLE_DAYS - 1);
  return eachDayOfInterval({ start: currentDate, end });
}

export function WeekView({
  currentDate = new Date(),
  events = [],
  onEventClick,
  selectedEventId,
  onBackgroundClick,
  onDateChange,
  onVisibleDaysChange,
  onEventChange,
  dirtyEventIds,
  className,
}: WeekViewProps) {
  const {
    scrollContainerRef,
    days,
    bufferedDays,
    hours,
    hourHeight,
    allDayEvents,
    timedEvents,
    dragState,
    handleEventMouseDown,
    scrollStyle,
  } = useCalendarView({
    visibleDaysCount: VISIBLE_DAYS,
    bufferDays: 7,
    bufferStep: 7,
    currentDate,
    events,
    onEventClick,
    onDateChange,
    onVisibleDaysChange,
    onEventChange,
  });

  return (
    <div className={cn("flex h-full flex-col", className)} onClick={onBackgroundClick}>
      <div className="shrink-0">
        <div className="overflow-hidden">
          <div className="flex bg-background">
            <div className="text-muted-foreground flex w-16 shrink-0 items-center justify-end pr-2 text-xxs">
              {new Date()
                .toLocaleTimeString("en-US", { timeZoneName: "short" })
                .match(/\s([A-Z]{2,5})$/)?.[1] ?? ""}
            </div>
            <div className="flex-1 overflow-hidden">
              <div style={scrollStyle}>
                <WeekViewDayColumns days={bufferedDays} standalone />
              </div>
            </div>
          </div>
        </div>
        <div className="overflow-hidden">
          <WeekViewAllDayRow
            days={bufferedDays}
            allDayEvents={allDayEvents}
            onEventClick={onEventClick}
            selectedEventId={selectedEventId}
            scrollStyle={scrollStyle}
          />
        </div>
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-auto scrollbar-hide">
        <div className="relative flex" style={{ height: hours.length * hourHeight }}>
          <WeekViewTimeAxis hours={hours} hourHeight={hourHeight} />
          <div className="relative flex-1 overflow-hidden">
            <div style={scrollStyle}>
              <WeekViewGrid
                days={bufferedDays}
                hours={hours}
                hourHeight={hourHeight}
                events={timedEvents}
                onEventClick={onEventClick}
                selectedEventId={selectedEventId}
                dragState={dragState ?? undefined}
                onEventDragMouseDown={handleEventMouseDown}
                onEventChange={onEventChange}
                dirtyEventIds={dirtyEventIds}
              />
            </div>
          </div>
          <WeekViewTimeIndicator
            days={days}
            hourHeight={hourHeight}
            scrollDays={bufferedDays}
            scrollStyle={scrollStyle}
            behindSelection={!!selectedEventId}
          />
        </div>
      </div>
    </div>
  );
}
