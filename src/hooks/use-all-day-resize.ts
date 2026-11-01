"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isPrimaryPress,
  suppressNextClick,
  usePointerGesture,
} from "@/hooks/use-pointer-gesture";
import type {
  AllDayResizeState,
  CalendarEvent,
  PointerGestureStart,
} from "@/components/week-view-types";

interface UseAllDayResizeOptions {
  days: Date[];
  dayColumnWidth: number;
  allDayContainerRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

interface UseAllDayResizeReturn {
  allDayResizeState: AllDayResizeState | null;
  handleAllDayResizePointerDown: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
    edge: "left" | "right" | "move",
    startColumn: number,
    endColumn: number,
  ) => void;
}

const DRAG_THRESHOLD_PX = 4;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

interface ResizeInfo {
  eventId: string;
  event: CalendarEvent;
  /** Pointer driving the gesture; moves from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  edge: "left" | "right" | "move";
  startClientX: number;
  isResizing: boolean;
  originalStartColumn: number;
  originalEndColumn: number;
  /** Column index where the gesture started (used for move delta) */
  startColumnIndex: number;
  /** Offset from cursor to event left edge when the gesture started (px) */
  cursorOffsetX: number;
  /** Offset from cursor to event top edge when the gesture started (px) */
  cursorOffsetY: number;
  /** Latest start column, committed to the parent on pointerup */
  currentStartColumn: number;
  /** Latest end column, committed to the parent on pointerup */
  currentEndColumn: number;
}

export function useAllDayResize({
  days,
  dayColumnWidth,
  allDayContainerRef,
  events,
  onEventChange,
  onEventClick,
}: UseAllDayResizeOptions): UseAllDayResizeReturn {
  const [allDayResizeState, setAllDayResizeState] =
    useState<AllDayResizeState | null>(null);
  const { startGesture } = usePointerGesture({
    containerRef: allDayContainerRef,
  });

  const resizeRef = useRef<ResizeInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const eventsRef = useRef(events);
  const daysRef = useRef(days);
  const dayColumnWidthRef = useRef(dayColumnWidth);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    onEventClickRef.current = onEventClick;
  }, [onEventClick]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);
  useEffect(() => {
    dayColumnWidthRef.current = dayColumnWidth;
  }, [dayColumnWidth]);

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
        document.body.style.setProperty(
          "--cursor",
          resize.edge === "move" ? "grabbing" : "col-resize",
        );
      }

      const container = allDayContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const colWidth = dayColumnWidthRef.current;
      const currentDays = daysRef.current;
      const columnIndex = clamp(
        Math.floor((e.clientX - rect.left) / colWidth),
        0,
        currentDays.length - 1,
      );

      let newStartColumn = resize.originalStartColumn;
      let newEndColumn = resize.originalEndColumn;

      if (resize.edge === "move") {
        const span = resize.originalEndColumn - resize.originalStartColumn;
        const delta = columnIndex - resize.startColumnIndex;
        newStartColumn = clamp(
          resize.originalStartColumn + delta,
          0,
          currentDays.length - 1 - span,
        );
        newEndColumn = newStartColumn + span;
      } else if (resize.edge === "right") {
        newEndColumn = Math.max(columnIndex, resize.originalStartColumn);
      } else {
        newStartColumn = Math.min(columnIndex, resize.originalEndColumn);
      }

      resize.currentStartColumn = newStartColumn;
      resize.currentEndColumn = newEndColumn;

      setAllDayResizeState({
        eventId: resize.eventId,
        event: resize.event,
        originalStartColumn: resize.originalStartColumn,
        originalEndColumn: resize.originalEndColumn,
        currentStartColumn: newStartColumn,
        currentEndColumn: newEndColumn,
        edge: resize.edge,
        isResizing: true,
        ...(resize.edge === "move"
          ? {
              clientX: e.clientX,
              clientY: e.clientY,
              cursorOffsetX: resize.cursorOffsetX,
              cursorOffsetY: resize.cursorOffsetY,
            }
          : {}),
      });
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;

      cleanup();
      resizeRef.current = null;
      setAllDayResizeState(null);

      // Touch selects on release, after the gesture, rather than on press
      if (resize.pointerType === "touch") {
        onEventClickRef.current?.(resize.event);
      }
      if (!resize.isResizing) return;
      // A move swaps the pressed bar for a ghost, so the browser's click
      // lands on the row and would clear the selection
      suppressNextClick(resize.pointerType);

      // Commit from the handler, never from inside a state updater:
      // updaters run during render, and calling the parent's setState
      // there triggers "Cannot update a component while rendering".
      const event = eventsRef.current.find((e) => e.id === resize.eventId);
      if (!event) return;

      const currentDays = daysRef.current;
      const newStartDate = currentDays[resize.currentStartColumn];
      const newEndDate = currentDays[resize.currentEndColumn];

      if (!newStartDate || !newEndDate) return;

      // Preserve time-of-day from original event
      const newStart = new Date(newStartDate);
      newStart.setHours(
        event.start.getHours(),
        event.start.getMinutes(),
        event.start.getSeconds(),
        event.start.getMilliseconds(),
      );

      const newEnd = new Date(newEndDate);
      newEnd.setHours(
        event.end.getHours(),
        event.end.getMinutes(),
        event.end.getSeconds(),
        event.end.getMilliseconds(),
      );

      // Move preserves the original isAllDay flag (duration unchanged).
      // Resize determines isAllDay by whether the span exceeds 24h.
      const isMove = resize.edge === "move";
      const MS_IN_24H = 24 * 60 * 60 * 1000;
      const isLongerThan24h = newEnd.getTime() - newStart.getTime() > MS_IN_24H;
      const isAllDay = isMove ? event.isAllDay === true : isLongerThan24h;

      onEventChangeRef.current?.({
        ...event,
        start: newStart,
        end: newEnd,
        isAllDay,
      });
    };

    // The browser took the pointer over (e.g. for a system gesture): drop
    // the gesture without committing it
    handlePointerCancelRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;

      cleanup();
      resizeRef.current = null;
      setAllDayResizeState(null);
    };
  }, [allDayContainerRef, cleanup]);

  const beginResize = useCallback(
    (
      { clientX, pointerId, pointerType }: PointerGestureStart,
      event: CalendarEvent,
      edge: "left" | "right" | "move",
      startColumn: number,
      endColumn: number,
    ) => {
      // Mouse and pen select the event immediately
      if (pointerType !== "touch") onEventClickRef.current?.(event);

      // Compute the column under the cursor at the start for move delta
      const container = allDayContainerRef.current;
      let startColumnIndex = startColumn;
      let cursorOffsetX = 0;
      const cursorOffsetY = 0;
      if (container) {
        const rect = container.getBoundingClientRect();
        const colWidth = dayColumnWidthRef.current;
        startColumnIndex = clamp(
          Math.floor((clientX - rect.left) / colWidth),
          0,
          daysRef.current.length - 1,
        );
        // Compute offset from cursor to the event element's top-left
        const eventLeft = rect.left + startColumn * colWidth;
        cursorOffsetX = clientX - eventLeft;
      }

      resizeRef.current = {
        eventId: event.id,
        event,
        pointerId,
        pointerType,
        edge,
        startClientX: clientX,
        isResizing: false,
        originalStartColumn: startColumn,
        originalEndColumn: endColumn,
        startColumnIndex,
        cursorOffsetX,
        cursorOffsetY,
        currentStartColumn: startColumn,
        currentEndColumn: endColumn,
      };

      setAllDayResizeState({
        eventId: event.id,
        event,
        originalStartColumn: startColumn,
        originalEndColumn: endColumn,
        currentStartColumn: startColumn,
        currentEndColumn: endColumn,
        edge,
        isResizing: false,
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
    [allDayContainerRef],
  );

  const handleAllDayResizePointerDown = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      event: CalendarEvent,
      edge: "left" | "right" | "move",
      startColumn: number,
      endColumn: number,
    ) => {
      if (!isPrimaryPress(e)) return;
      e.stopPropagation();
      startGesture(e, (start) =>
        beginResize(start, event, edge, startColumn, endColumn),
      );
    },
    [startGesture, beginResize],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { allDayResizeState, handleAllDayResizePointerDown };
}
