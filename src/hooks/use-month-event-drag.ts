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
  /** Viewport X for fixed-position floating copy */
  clientX: number;
  /** Viewport Y for fixed-position floating copy */
  clientY: number;
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
}

interface UseMonthEventDragReturn {
  /** Current drag state, or null when not dragging */
  dragState: MonthDragState | null;
  /** Attach to event elements' onMouseDown */
  handleDragMouseDown: (e: React.MouseEvent, event: CalendarEvent) => void;
}

/** Minimum pixel distance before a click becomes a drag */
const DRAG_THRESHOLD_PX = 4;

/**
 * Finds the date of the grid cell under the given viewport coordinates.
 * Uses elementsFromPoint so the browser handles CSS transforms
 * (vertical scroll offset, buffered rows) automatically.
 */
function getDateAtPoint(
  gridEl: HTMLElement,
  clientX: number,
  clientY: number,
): Date | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    const dateAttr = el.getAttribute("data-date");
    if (dateAttr && gridEl.contains(el)) {
      return new Date(dateAttr);
    }
  }
  return null;
}

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
}: UseMonthEventDragOptions): UseMonthEventDragReturn {
  const [dragState, setDragState] = useState<MonthDragState | null>(null);

  const dragRef = useRef<DragInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const eventsRef = useRef(events);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    onEventClickRef.current = onEventClick;
  }, [onEventClick]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

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

      const targetDate = getDateAtPoint(grid, e.clientX, e.clientY);
      if (!targetDate) return;

      setDragState({
        eventId: drag.eventId,
        event: drag.event,
        originalDate: drag.originalDate,
        targetDate,
        isDragging: true,
        clientX: e.clientX,
        clientY: e.clientY,
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

          // Select the event after drop so the detail popover opens
          onEventClickRef.current?.(drag.event);

          return null;
        });
      } else {
        // No drag — select the event on mouseup (not mousedown) so the
        // popover doesn't flash while the user is still holding the mouse.
        onEventClickRef.current?.(drag.event);
        setDragState(null);

        // Swallow the subsequent click event so the event item's onClick
        // doesn't double-fire selection.
        window.addEventListener(
          "click",
          (ev) => {
            ev.stopPropagation();
          },
          { capture: true, once: true },
        );
      }

      dragRef.current = null;
    };
  }, [gridRef, cleanup]);

  const handleDragMouseDown = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      if (e.button !== 0) return;

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
        clientX: e.clientX,
        clientY: e.clientY,
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
