"use client";

import React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { isPast } from "date-fns";
import { calculatePositionedEvents } from "@/lib/event-utils";
import { CalendarEventItem } from "./calendar-event-item";
import type {
  CalendarEvent,
  EventDragState,
  PositionedEvent,
  WeekViewGridProps,
} from "./week-view-types";

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
  selectedEventId,
  dragState,
  onEventDragMouseDown,
  dirtyEventIds,
  className,
}: WeekViewGridProps) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = React.useState(0);

  React.useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={gridRef} className={cn("relative", className)}>
      {/* Background grid */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${days.length}, 1fr)`,
          gridTemplateRows: `repeat(${hours.length}, ${hourHeight}px)`,
        }}
      >
        {hours.map((hourSlot) =>
          days.map((day) => {
            const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
            return (
              <div
                key={`${day.date.toISOString()}-${hourSlot.hour}`}
                className={cn(
                  "border-border border-b border-l",
                  isWeekend && "bg-calendar-weekend",
                )}
              />
            );
          }),
        )}
      </div>

      {/* Events layer */}
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((day) => {
          const positionedEvents = calculatePositionedEvents(events, day);

          return (
            <DayEventsColumn
              key={day.date.toISOString()}
              events={positionedEvents}
              hourHeight={hourHeight}
              onEventClick={onEventClick}
              selectedEventId={selectedEventId}
              dragState={dragState}
              onEventDragMouseDown={onEventDragMouseDown}
              dirtyEventIds={dirtyEventIds}
            />
          );
        })}
      </div>

      {/* Floating dragging copy — rendered at grid level so it can move freely */}
      {dragState?.isDragging && (
        <FloatingDragCopy
          days={days}
          events={events}
          hourHeight={hourHeight}
          dragState={dragState}
          dirtyEventIds={dirtyEventIds}
          gridWidth={gridWidth}
        />
      )}
    </div>
  );
}

interface FloatingDragCopyProps {
  days: WeekViewGridProps["days"];
  events: CalendarEvent[];
  hourHeight: number;
  dragState: EventDragState;
  dirtyEventIds?: Set<string>;
  gridWidth: number;
}

function FloatingDragCopy({
  days,
  events,
  hourHeight,
  dragState,
  dirtyEventIds,
  gridWidth,
}: FloatingDragCopyProps) {
  for (const day of days) {
    const positionedEvents = calculatePositionedEvents(events, day);
    const match = positionedEvents.find((pe) => pe.event.id === dragState.eventId);
    if (!match) continue;

    const isDirty = dirtyEventIds?.has(dragState.eventId);
    const durationMinutes =
      (dragState.currentEnd.getTime() - dragState.currentStart.getTime()) / 60000;
    const heightPx = (durationMinutes / 60) * hourHeight;
    const columnWidthPx = (days.length > 0 ? gridWidth / days.length : 200) * 0.92;

    return createPortal(
      <div
        className="pointer-events-none"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 9999,
        }}
      >
        <CalendarEventItem
          key={`${dragState.eventId}-dragging`}
          positionedEvent={match}
          hourHeight={hourHeight}
          dragVariant="dragging"
          isDirty={isDirty}
          overrideStart={dragState.currentStart}
          overrideEnd={dragState.currentEnd}
          cursorY={dragState.clientY}
          cursorX={dragState.clientX}
          fixedWidth={columnWidthPx}
          fixedHeight={heightPx}
        />
      </div>,
      document.body,
    );
  }

  return null;
}

interface DayEventsColumnProps {
  events: ReturnType<typeof calculatePositionedEvents>;
  hourHeight: number;
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  dragState?: EventDragState;
  onEventDragMouseDown?: (e: React.MouseEvent, event: CalendarEvent) => void;
  dirtyEventIds?: Set<string>;
}

function renderColumnDragElements(
  positionedEvent: PositionedEvent,
  hourHeight: number,
  dragState: EventDragState,
) {
  const eventId = positionedEvent.event.id;

  return (
    <React.Fragment key={eventId}>
      {/* Ghost at original position */}
      <CalendarEventItem
        key={`${eventId}-ghost`}
        positionedEvent={positionedEvent}
        hourHeight={hourHeight}
        dragVariant="ghost"
      />
      {/* Snap placeholder at drop target */}
      <CalendarEventItem
        key={`${eventId}-placeholder`}
        positionedEvent={positionedEvent}
        hourHeight={hourHeight}
        dragVariant="placeholder"
        overrideStart={dragState.currentStart}
        overrideEnd={dragState.currentEnd}
      />
    </React.Fragment>
  );
}

function DayEventsColumn({
  events,
  hourHeight,
  onEventClick,
  selectedEventId,
  dragState,
  onEventDragMouseDown,
  dirtyEventIds,
}: DayEventsColumnProps) {
  return (
    <div className="relative h-full pointer-events-auto">
      {events.map((positionedEvent) => {
        const eventId = positionedEvent.event.id;
        const isBeingDragged = dragState?.isDragging && dragState.eventId === eventId;

        if (isBeingDragged) {
          return renderColumnDragElements(
            positionedEvent,
            hourHeight,
            dragState,
          );
        }

        return (
          <CalendarEventItem
            key={eventId}
            positionedEvent={positionedEvent}
            hourHeight={hourHeight}
            isPast={isPast(positionedEvent.event.end)}
            isSelected={eventId === selectedEventId}
            onClick={onEventClick}
            onDragMouseDown={onEventDragMouseDown}
            isDirty={dirtyEventIds?.has(eventId)}
          />
        );
      })}
    </div>
  );
}
