"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, differenceInCalendarDays } from "date-fns";

import {
  suppressNextClick,
  usePointerGesture,
} from "@/hooks/use-pointer-gesture";
import { parseCellDate } from "@/lib/event-utils";
import type {
  CalendarEvent,
  PointerGestureStart,
} from "@/components/calendar-types";

/**
 * State of an in-progress month-view event drag operation.
 * Simpler than the week-view drag state — only tracks day-level snapping.
 */
export interface MonthDragState {
  /** ID of the event being dragged */
  eventId: string;
  /** The original event being dragged */
  event: CalendarEvent;
  /** The date under the pointer when the drag began */
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
  /** Called on pointerup to select the event (after the drop, if it moved) */
  onEventClick?: (event: CalendarEvent) => void;
}

interface UseMonthEventDragReturn {
  /** Current drag state, or null when not dragging */
  dragState: MonthDragState | null;
  /** Attach to event elements' onPointerDown */
  handleDragPointerDown: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
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
      return parseCellDate(dateAttr);
    }
  }
  return null;
}

interface DragInfo {
  eventId: string;
  event: CalendarEvent;
  /** Pointer driving the drag; moves from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  originalDate: Date;
  startClientX: number;
  startClientY: number;
  isDragging: boolean;
  /** Latest date under the cursor, committed to the parent on pointerup */
  targetDate: Date;
}

export function useMonthEventDrag({
  gridRef,
  events,
  onEventChange,
  onEventClick,
}: UseMonthEventDragOptions): UseMonthEventDragReturn {
  const [dragState, setDragState] = useState<MonthDragState | null>(null);
  const { startGesture } = usePointerGesture({ containerRef: gridRef });

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
  }, []);

  // Initialize handlers once (stable references via refs)
  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

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

      drag.targetDate = targetDate;

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

    handlePointerUpRef.current = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      cleanup();
      dragRef.current = null;
      setDragState(null);

      // Swallow the click that follows. Without a drag it would select the
      // event a second time; after one it lands on a shared ancestor of the
      // swapped-out item and would clear the selection made below.
      suppressNextClick(drag.pointerType);

      if (!drag.isDragging) {
        // No drag — select the event on pointerup (not pointerdown) so the
        // popover doesn't flash while the user is still holding the mouse.
        onEventClickRef.current?.(drag.event);
        return;
      }

      // Commit from the handler, never from inside a state updater:
      // updaters run during render, and calling the parent's setState
      // there triggers "Cannot update a component while rendering".
      const event = eventsRef.current.find((e) => e.id === drag.eventId);
      if (!event) return;

      const daysDelta = differenceInCalendarDays(
        drag.targetDate,
        drag.originalDate,
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
    };

    // The browser took the pointer over (e.g. for a system gesture): drop
    // the drag without committing it
    handlePointerCancelRef.current = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      cleanup();
      dragRef.current = null;
      setDragState(null);
    };
  }, [gridRef, cleanup]);

  const beginDrag = useCallback(
    (
      { clientX, clientY, pointerId, pointerType }: PointerGestureStart,
      event: CalendarEvent,
    ) => {
      // Anchor on the day that was grabbed, not the event's first day: a
      // bar pressed on its third day moves by the cells the pointer crosses
      const grid = gridRef.current;
      const grabbedDate =
        (grid && getDateAtPoint(grid, clientX, clientY)) ?? event.start;

      dragRef.current = {
        eventId: event.id,
        event,
        pointerId,
        pointerType,
        originalDate: grabbedDate,
        startClientX: clientX,
        startClientY: clientY,
        isDragging: false,
        targetDate: grabbedDate,
      };

      setDragState({
        eventId: event.id,
        event,
        originalDate: grabbedDate,
        targetDate: grabbedDate,
        isDragging: false,
        clientX,
        clientY,
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
    [gridRef],
  );

  const handleDragPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, event: CalendarEvent) => {
      startGesture(e, (start) => beginDrag(start, event));
    },
    [startGesture, beginDrag],
  );

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { dragState, handleDragPointerDown };
}
