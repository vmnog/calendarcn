"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CalendarEvent, EventDragState } from "@/components/week-view-types";

interface UseEventDragOptions {
  hourHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

interface UseEventDragReturn {
  dragState: EventDragState | null;
  handleEventMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void;
}

const DRAG_THRESHOLD_PX = 4;
const SNAP_MINUTES = 15;

function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function addMinutesToDate(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutes);
  return result;
}

interface DragInfo {
  eventId: string;
  event: CalendarEvent;
  startClientY: number;
  offsetWithinEvent: number;
  offsetWithinEventX: number;
  isDragging: boolean;
  durationMinutes: number;
}

export function useEventDrag({
  hourHeight,
  scrollContainerRef,
  events,
  onEventChange,
  onEventClick,
}: UseEventDragOptions): UseEventDragReturn {
  const [dragState, setDragState] = useState<EventDragState | null>(null);

  const dragRef = useRef<DragInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const eventsRef = useRef(events);
  const hourHeightRef = useRef(hourHeight);

  useEffect(() => { onEventChangeRef.current = onEventChange; }, [onEventChange]);
  useEffect(() => { onEventClickRef.current = onEventClick; }, [onEventClick]);
  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { hourHeightRef.current = hourHeight; }, [hourHeight]);

  // Store handlers in refs to break the circular dependency
  const handleMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleMouseUpRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    if (handleMouseMoveRef.current) {
      window.removeEventListener("mousemove", handleMouseMoveRef.current);
    }
    if (handleMouseUpRef.current) {
      window.removeEventListener("mouseup", handleMouseUpRef.current);
    }
  }, []);

  // Initialize the handlers once (stable references via refs)
  useEffect(() => {
    handleMouseMoveRef.current = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaY = Math.abs(e.clientY - drag.startClientY);
      if (!drag.isDragging && deltaY < DRAG_THRESHOLD_PX) return;

      if (!drag.isDragging) {
        drag.isDragging = true;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const absoluteY = e.clientY - containerRect.top + scrollTop - drag.offsetWithinEvent;
      const absoluteX = e.clientX - containerRect.left - drag.offsetWithinEventX;
      const rawMinutes = (absoluteY / hourHeightRef.current) * 60;
      const snappedStartMinutes = snapToGrid(rawMinutes);
      const clampedStart = Math.max(0, Math.min(snappedStartMinutes, 1440 - drag.durationMinutes));

      const dayDate = drag.event.start;
      const currentStart = addMinutesToDate(dayDate, clampedStart);
      const currentEnd = addMinutesToDate(dayDate, clampedStart + drag.durationMinutes);

      setDragState({
        eventId: drag.eventId,
        originalStart: drag.event.start,
        originalEnd: drag.event.end,
        currentStart,
        currentEnd,
        isDragging: true,
        cursorY: absoluteY,
        cursorX: absoluteX,
        clientX: e.clientX - drag.offsetWithinEventX,
        clientY: e.clientY - drag.offsetWithinEvent,
      });
    };

    handleMouseUpRef.current = () => {
      const drag = dragRef.current;
      if (!drag) return;

      cleanup();

      if (drag.isDragging) {
        setDragState((prev) => {
          if (!prev) return null;

          const event = eventsRef.current.find((e) => e.id === drag.eventId);
          if (!event) return null;

          onEventChangeRef.current?.({
            ...event,
            start: prev.currentStart,
            end: prev.currentEnd,
          });

          return null;
        });
      } else {
        setDragState(null);
      }

      dragRef.current = null;
    };
  }, [scrollContainerRef, cleanup]);

  const handleEventMouseDown = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      if (e.button !== 0) return;

      // Select the event immediately
      onEventClickRef.current?.(event);

      const container = scrollContainerRef.current;
      if (!container) return;

      // Compute offset within the event element
      const target = e.currentTarget as HTMLElement;
      const targetRect = target.getBoundingClientRect();
      const offsetWithinEvent = e.clientY - targetRect.top;
      const offsetWithinEventX = e.clientX - targetRect.left;

      const startMinutes = event.start.getHours() * 60 + event.start.getMinutes();
      const endMinutes = event.end.getHours() * 60 + event.end.getMinutes();
      const durationMinutes = endMinutes - startMinutes;

      dragRef.current = {
        eventId: event.id,
        event,
        startClientY: e.clientY,
        offsetWithinEvent,
        offsetWithinEventX,
        isDragging: false,
        durationMinutes,
      };

      setDragState({
        eventId: event.id,
        originalStart: event.start,
        originalEnd: event.end,
        currentStart: event.start,
        currentEnd: event.end,
        isDragging: false,
        cursorY: 0,
        cursorX: 0,
        clientX: 0,
        clientY: 0,
      });

      if (handleMouseMoveRef.current) {
        window.addEventListener("mousemove", handleMouseMoveRef.current);
      }
      if (handleMouseUpRef.current) {
        window.addEventListener("mouseup", handleMouseUpRef.current);
      }
    },
    [scrollContainerRef],
  );

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { dragState, handleEventMouseDown };
}
