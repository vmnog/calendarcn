"use client";

import { cn } from "@/lib/utils";
import { isPast } from "date-fns";
import { calculatePositionedEvents } from "@/lib/event-utils";
import { CalendarEventItem } from "./calendar-event-item";
import type { CalendarEvent, WeekViewGridProps } from "./week-view-types";

/**
 * Main grid displaying hour/day intersection cells with events
 * Each cell represents one hour in one day
 */
export function WeekViewGrid({
  days,
  hours,
  hourHeight,
  events = [],
  onEventClick,
  className,
}: WeekViewGridProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Background grid */}
      <div
        className="grid grid-cols-7"
        style={{ gridTemplateRows: `repeat(${hours.length}, ${hourHeight}px)` }}
      >
        {hours.map((hourSlot) =>
          days.map((day) => {
            const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
            return (
              <div
                key={`${day.date.toISOString()}-${hourSlot.hour}`}
                className={cn(
                  "border-border border-b border-l",
                  isWeekend && "bg-calendar-weekend"
                )}
              />
            );
          })
        )}
      </div>

      {/* Events layer */}
      <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
        {days.map((day) => {
          const positionedEvents = calculatePositionedEvents(events, day);

          return (
            <DayEventsColumn
              key={day.date.toISOString()}
              events={positionedEvents}
              hourHeight={hourHeight}
              onEventClick={onEventClick}
            />
          );
        })}
      </div>
    </div>
  );
}

interface DayEventsColumnProps {
  events: ReturnType<typeof calculatePositionedEvents>;
  hourHeight: number;
  onEventClick?: (event: CalendarEvent) => void;
}

function DayEventsColumn({
  events,
  hourHeight,
  onEventClick,
}: DayEventsColumnProps) {
  return (
    <div className="relative h-full pointer-events-auto">
      {events.map((positionedEvent) => (
        <CalendarEventItem
          key={positionedEvent.event.id}
          positionedEvent={positionedEvent}
          hourHeight={hourHeight}
          isPast={isPast(positionedEvent.event.end)}
          onClick={onEventClick}
        />
      ))}
    </div>
  );
}
