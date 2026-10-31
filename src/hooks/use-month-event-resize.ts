"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startOfDay } from "date-fns";

import {
  isPrimaryPress,
  suppressNextClick,
  usePointerGesture,
} from "@/hooks/use-pointer-gesture";
import { parseCellDate } from "@/lib/event-utils";
import type {
  CalendarEvent,
  PointerGestureStart,
} from "@/components/calendar-types";

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
  /** Pointer driving the resize; moves from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  edge: "left" | "right";
  startClientX: number;
  isResizing: boolean;
  /** Latest start date, committed to the parent on pointerup */
  currentStart: Date;
  /** Latest end date, committed to the parent on pointerup */
  currentEnd: Date;
}

interface UseMonthEventResizeOptions {
  /** Ref to the grid container (used for hit-testing cells via data-date) */
  gridRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  onEventChange?: (event: CalendarEvent) => void;
}

interface UseMonthEventResizeReturn {
  resizeState: MonthResizeState | null;
  handleResizePointerDown: (
    e: React.PointerEvent<HTMLElement>,
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
      return parseCellDate(dateAttr);
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
  const { startGesture } = usePointerGesture({ containerRef: gridRef });

  const resizeRef = useRef<ResizeInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const eventsRef = useRef(events);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );

  const cleanup = useCallback(() => {
    if (handlePointerMoveRef.current) {
      window.removeEventListener("pointermove", handlePointerMoveRef.current);
    }
    if (handlePointerUpRef.current) {
      window.removeEventListener("pointerup", handlePointerUpRef.current);
    }
    if (handlePointerCancelRef.current) {
      window.removeEventListener(
        "pointercancel",
        handlePointerCancelRef.current,
      );
    }
    document.body.style.removeProperty("--cursor");
  }, []);

  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;

      const deltaX = Math.abs(e.clientX - resize.startClientX);
      if (!resize.isResizing && deltaX < DRAG_THRESHOLD_PX) return;

      if (!resize.isResizing) {
        resize.isResizing = true;
        document.body.style.setProperty("--cursor", "col-resize");
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

      resize.currentStart = newStart;
      resize.currentEnd = newEnd;

      setResizeState({
        eventId: resize.eventId,
        event: resize.event,
        edge: resize.edge,
        isResizing: true,
        currentStart: newStart,
        currentEnd: newEnd,
      });
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;

      cleanup();
      resizeRef.current = null;
      setResizeState(null);

      if (!resize.isResizing) return;
      suppressNextClick(resize.pointerType);

      // Commit from the handler, never from inside a state updater:
      // updaters run during render, and calling the parent's setState
      // there triggers "Cannot update a component while rendering".
      const event = eventsRef.current.find((e) => e.id === resize.eventId);
      if (!event) return;

      onEventChangeRef.current?.({
        ...event,
        start: resize.currentStart,
        end: resize.currentEnd,
      });
    };

    // The browser took the pointer over (e.g. for a system gesture): drop
    // the resize without committing it
    handlePointerCancelRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;

      cleanup();
      resizeRef.current = null;
      setResizeState(null);
    };
  }, [gridRef, cleanup]);

  const beginResize = useCallback(
    (
      { clientX, pointerId, pointerType }: PointerGestureStart,
      event: CalendarEvent,
      edge: "left" | "right",
    ) => {
      resizeRef.current = {
        eventId: event.id,
        event,
        pointerId,
        pointerType,
        edge,
        startClientX: clientX,
        isResizing: false,
        currentStart: event.start,
        currentEnd: event.end,
      };

      setResizeState({
        eventId: event.id,
        event,
        edge,
        isResizing: false,
        currentStart: event.start,
        currentEnd: event.end,
      });

      if (handlePointerMoveRef.current) {
        window.addEventListener("pointermove", handlePointerMoveRef.current);
      }
      if (handlePointerUpRef.current) {
        window.addEventListener("pointerup", handlePointerUpRef.current);
      }
      if (handlePointerCancelRef.current) {
        window.addEventListener(
          "pointercancel",
          handlePointerCancelRef.current,
        );
      }
    },
    [],
  );

  const handleResizePointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      event: CalendarEvent,
      edge: "left" | "right",
    ) => {
      if (!isPrimaryPress(e)) return;
      e.stopPropagation();
      startGesture(e, (start) => beginResize(start, event, edge));
    },
    [startGesture, beginResize],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { resizeState, handleResizePointerDown };
}
