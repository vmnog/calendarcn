"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays } from "date-fns";

import type { CalendarEvent } from "@/components/calendar-types";

/**
 * State of an in-progress month-view event drag operation.
 * Simpler than the week-view drag state — only tracks day-level snapping.
 */
export interface MonthDragState {
  /** ID of the event being dragged */
  eventId: string;
  /** The original event being dragged */
  event: CalendarEvent;
  /** The date the event was originally on */
  originalDate: Date;
  /** The date the cursor is currently over */
  targetDate: Date;
  /** Whether the drag threshold has been met */
  isDragging: boolean;
}

interface UseMonthEventDragOptions {
  /** Ref to the grid container element (used for hit-testing cells) */
  gridRef: React.RefObject<HTMLDivElement | null>;
  /** Current list of events */
  events: CalendarEvent[];
  /** Called when an event is modified (date shifted) */
  onEventChange?: (event: CalendarEvent) => void;
  /** Called immediately on mousedown to select the event */
  onEventClick?: (event: CalendarEvent) => void;
  /** Number of visible columns in the grid (5 or 7) */
  columnCount: number;
  /** Number of week rows in the grid */
  rowCount: number;
}

interface UseMonthEventDragReturn {
  /** Current drag state, or null when not dragging */
  dragState: MonthDragState | null;
  /** Attach to event elements' onMouseDown */
  handleDragMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void;
}

/** Minimum pixel distance before a click becomes a drag */
const DRAG_THRESHOLD_PX = 4;

interface DragInfo {
  eventId: string;
  event: CalendarEvent;
  originalDate: Date;
  startClientX: number;
  startClientY: number;
  isDragging: boolean;
}

export function useMonthEventDrag({
  gridRef,
  events,
  onEventChange,
  onEventClick,
  columnCount,
  rowCount,
}: UseMonthEventDragOptions): UseMonthEventDragReturn {
  const [dragState, setDragState] = useState<MonthDragState | null>(null);

  const dragRef = useRef<DragInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const eventsRef = useRef(events);
  const columnCountRef = useRef(columnCount);
  const rowCountRef = useRef(rowCount);

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
    columnCountRef.current = columnCount;
  }, [columnCount]);
  useEffect(() => {
    rowCountRef.current = rowCount;
  }, [rowCount]);

  // Store handlers in refs to break circular dependency
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

  // Initialize handlers once (stable references via refs)
  useEffect(() => {
    handleMouseMoveRef.current = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const deltaX = Math.abs(e.clientX - drag.startClientX);
      const deltaY = Math.abs(e.clientY - drag.startClientY);
      if (
        !drag.isDragging &&
        deltaX < DRAG_THRESHOLD_PX &&
        deltaY < DRAG_THRESHOLD_PX
      )
        return;

      if (!drag.isDragging) {
        drag.isDragging = true;
      }

      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const cols = columnCountRef.current;
      const rows = rowCountRef.current;
      const cellWidth = rect.width / cols;
      const cellHeight = rect.height / rows;

      const col = Math.floor((e.clientX - rect.left) / cellWidth);
      const row = Math.floor((e.clientY - rect.top) / cellHeight);

      const clampedCol = Math.max(0, Math.min(col, cols - 1));
      const clampedRow = Math.max(0, Math.min(row, rows - 1));
      const cellIndex = clampedRow * cols + clampedCol;

      // Look up target date from data-date attributes on day cells
      const dateCells = grid.querySelectorAll("[data-date]");
      if (cellIndex >= dateCells.length) return;

      const dateAttr = dateCells[cellIndex].getAttribute("data-date");
      if (!dateAttr) return;

      const targetDate = new Date(dateAttr);

      setDragState({
        eventId: drag.eventId,
        event: drag.event,
        originalDate: drag.originalDate,
        targetDate,
        isDragging: true,
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

          const daysDelta = differenceInCalendarDays(
            prev.targetDate,
            prev.originalDate,
          );

          if (daysDelta !== 0) {
            onEventChangeRef.current?.({
              ...event,
              start: addDays(event.start, daysDelta),
              end: addDays(event.end, daysDelta),
            });
          }

          return null;
        });
      } else {
        setDragState(null);
      }

      dragRef.current = null;
    };
  }, [gridRef, cleanup]);

  const handleDragMouseDown = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      if (e.button !== 0) return;

      // Select the event immediately
      onEventClickRef.current?.(event);

      dragRef.current = {
        eventId: event.id,
        event,
        originalDate: event.start,
        startClientX: e.clientX,
        startClientY: e.clientY,
        isDragging: false,
      };

      setDragState({
        eventId: event.id,
        event,
        originalDate: event.start,
        targetDate: event.start,
        isDragging: false,
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

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { dragState, handleDragMouseDown };
}
