"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startOfDay } from "date-fns";

import type { CalendarEvent } from "@/components/calendar-types";

/** Minimum cursor movement before entering resize mode */
const DRAG_THRESHOLD_PX = 4;

export interface MonthResizeState {
  eventId: string;
  event: CalendarEvent;
  edge: "left" | "right";
  /** Whether the drag threshold has been met */
  isResizing: boolean;
  /** The new start date during resize */
  currentStart: Date;
  /** The new end date during resize */
  currentEnd: Date;
}

interface ResizeInfo {
  eventId: string;
  event: CalendarEvent;
  edge: "left" | "right";
  startClientX: number;
  isResizing: boolean;
}

interface UseMonthEventResizeOptions {
  /** Ref to the grid container (used for hit-testing cells via data-date) */
  gridRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  onEventChange?: (event: CalendarEvent) => void;
}

interface UseMonthEventResizeReturn {
  resizeState: MonthResizeState | null;
  handleResizeMouseDown: (
    e: React.MouseEvent,
    event: CalendarEvent,
    edge: "left" | "right",
  ) => void;
}

/**
 * Finds the date of the grid cell under the given viewport coordinates.
 * Uses data-date attributes on day cells via elementFromPoint.
 */
function getDateAtPoint(
  gridEl: HTMLElement,
  clientX: number,
  clientY: number,
): Date | null {
  // Use elementsFromPoint to find the cell under the cursor
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    const dateAttr = el.getAttribute("data-date");
    if (dateAttr && gridEl.contains(el)) {
      return new Date(dateAttr);
    }
  }
  return null;
}

export function useMonthEventResize({
  gridRef,
  events,
  onEventChange,
}: UseMonthEventResizeOptions): UseMonthEventResizeReturn {
  const [resizeState, setResizeState] = useState<MonthResizeState | null>(null);

  const resizeRef = useRef<ResizeInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const eventsRef = useRef(events);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const handleMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null);
  const handleMouseUpRef = useRef<(() => void) | null>(null);

  const cleanup = useCallback(() => {
    if (handleMouseMoveRef.current) {
      window.removeEventListener("mousemove", handleMouseMoveRef.current);
    }
    if (handleMouseUpRef.current) {
      window.removeEventListener("mouseup", handleMouseUpRef.current);
    }
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    handleMouseMoveRef.current = (e: MouseEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;

      const deltaX = Math.abs(e.clientX - resize.startClientX);
      if (!resize.isResizing && deltaX < DRAG_THRESHOLD_PX) return;

      if (!resize.isResizing) {
        resize.isResizing = true;
        document.body.style.cursor = "ew-resize";
      }

      const grid = gridRef.current;
      if (!grid) return;

      const targetDate = getDateAtPoint(grid, e.clientX, e.clientY);
      if (!targetDate) return;

      const event = resize.event;
      let newStart = event.start;
      let newEnd = event.end;

      if (resize.edge === "right") {
        // Right edge: extend/shrink end date. End must be >= start.
        const targetDay = startOfDay(targetDate);
        const startDay = startOfDay(event.start);
        if (targetDay >= startDay) {
          // For all-day events, end stores the last visible day (inclusive).
          // The layout adds +1 for span calculation, so we just use targetDay.
          // For timed events, preserve the time-of-day from the original end.
          newEnd = event.isAllDay
            ? targetDay
            : new Date(
                targetDay.getTime() +
                  (event.end.getTime() - startOfDay(event.end).getTime()),
              );
        }
      } else {
        // Left edge: extend/shrink start date. Start must be <= end.
        const targetDay = startOfDay(targetDate);
        const endDay = startOfDay(event.end);
        if (targetDay <= endDay) {
          newStart = new Date(
            targetDay.getTime() +
              (event.start.getTime() - startOfDay(event.start).getTime()),
          );
        }
      }

      setResizeState({
        eventId: resize.eventId,
        event: resize.event,
        edge: resize.edge,
        isResizing: true,
        currentStart: newStart,
        currentEnd: newEnd,
      });
    };

    handleMouseUpRef.current = () => {
      const resize = resizeRef.current;
      if (!resize) return;

      cleanup();

      if (resize.isResizing) {
        setResizeState((prev) => {
          if (!prev) return null;

          const event = eventsRef.current.find((e) => e.id === resize.eventId);
          if (!event) return null;

          onEventChangeRef.current?.({
            ...event,
            start: prev.currentStart,
            end: prev.currentEnd,
          });

          return null;
        });
      } else {
        setResizeState(null);
      }

      resizeRef.current = null;
    };
  }, [gridRef, cleanup]);

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, event: CalendarEvent, edge: "left" | "right") => {
      if (e.button !== 0) return;
      e.stopPropagation();

      resizeRef.current = {
        eventId: event.id,
        event,
        edge,
        startClientX: e.clientX,
        isResizing: false,
      };

      setResizeState({
        eventId: event.id,
        event,
        edge,
        isResizing: false,
        currentStart: event.start,
        currentEnd: event.end,
      });

      if (handleMouseMoveRef.current) {
        window.addEventListener("mousemove", handleMouseMoveRef.current);
      }
      if (handleMouseUpRef.current) {
        window.addEventListener("mouseup", handleMouseUpRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { resizeState, handleResizeMouseDown };
}
