"use client";

import { isSameDay } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  usePointerGesture,
  suppressNextClick,
} from "@/hooks/use-pointer-gesture";
import { snapToGrid } from "@/lib/event-utils";
import type {
  CalendarEvent,
  EventDragState,
  PointerGestureStart,
} from "@/components/week-view-types";

interface UseEventDragOptions {
  hourHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  days: Date[];
  dayColumnWidth: number;
  timeAxisWidth: number;
  /** Minute step the dragged start snaps to */
  snapMinutes: number;
  /** First visible hour: the top of the grid, and the earliest start */
  dayStartHour: number;
  /** Hour the grid ends at: the latest end */
  dayEndHour: number;
  /** Days `onDragNavigate` moves when the cursor is held at a side edge */
  edgeNavigationDays: number;
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onDragNavigate?: (daysDelta: number) => void;
}

interface UseEventDragReturn {
  dragState: EventDragState | null;
  handleEventPointerDown: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
  ) => void;
}

const DRAG_THRESHOLD_PX = 4;
const EDGE_ZONE_PX = 40;
const EDGE_NAV_DELAY_MS = 500;
const EDGE_NAV_REPEAT_MS = 800;
const AUTO_SCROLL_ZONE_PX = 60;
const AUTO_SCROLL_MAX_SPEED = 12;

function addMinutesToDate(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutes);
  return result;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

interface DragInfo {
  eventId: string;
  event: CalendarEvent;
  /** Pointer driving the drag; moves from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  startClientY: number;
  startClientX: number;
  offsetWithinEvent: number;
  offsetWithinEventX: number;
  isDragging: boolean;
  durationMinutes: number;
  /** Latest snapped start, committed to the parent on pointerup */
  currentStart: Date;
  /** Latest snapped end, committed to the parent on pointerup */
  currentEnd: Date;
}

export function useEventDrag({
  hourHeight,
  scrollContainerRef,
  events,
  days,
  dayColumnWidth,
  timeAxisWidth,
  snapMinutes,
  dayStartHour,
  dayEndHour,
  edgeNavigationDays,
  onEventChange,
  onEventClick,
  onDragNavigate,
}: UseEventDragOptions): UseEventDragReturn {
  const [dragState, setDragState] = useState<EventDragState | null>(null);
  const { startGesture } = usePointerGesture({
    containerRef: scrollContainerRef,
  });

  const dragRef = useRef<DragInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const onDragNavigateRef = useRef(onDragNavigate);
  const eventsRef = useRef(events);
  const hourHeightRef = useRef(hourHeight);
  const daysRef = useRef(days);
  const dayColumnWidthRef = useRef(dayColumnWidth);
  const timeAxisWidthRef = useRef(timeAxisWidth);
  const snapMinutesRef = useRef(snapMinutes);
  const dayStartHourRef = useRef(dayStartHour);
  const dayEndHourRef = useRef(dayEndHour);
  const edgeNavigationDaysRef = useRef(edgeNavigationDays);

  useEffect(() => {
    onEventChangeRef.current = onEventChange;
  }, [onEventChange]);
  useEffect(() => {
    onEventClickRef.current = onEventClick;
  }, [onEventClick]);
  useEffect(() => {
    onDragNavigateRef.current = onDragNavigate;
  }, [onDragNavigate]);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);
  useEffect(() => {
    hourHeightRef.current = hourHeight;
  }, [hourHeight]);
  useEffect(() => {
    daysRef.current = days;
  }, [days]);
  useEffect(() => {
    dayColumnWidthRef.current = dayColumnWidth;
  }, [dayColumnWidth]);
  useEffect(() => {
    timeAxisWidthRef.current = timeAxisWidth;
  }, [timeAxisWidth]);
  useEffect(() => {
    snapMinutesRef.current = snapMinutes;
  }, [snapMinutes]);
  useEffect(() => {
    dayStartHourRef.current = dayStartHour;
  }, [dayStartHour]);
  useEffect(() => {
    dayEndHourRef.current = dayEndHour;
  }, [dayEndHour]);
  useEffect(() => {
    edgeNavigationDaysRef.current = edgeNavigationDays;
  }, [edgeNavigationDays]);

  // Edge navigation timer refs
  const edgeNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeNavDirectionRef = useRef<number | null>(null);

  // Auto-scroll RAF ref
  const autoScrollRAFRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);

  // Store handlers in refs to break the circular dependency
  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );

  const cancelEdgeNav = useCallback(() => {
    if (edgeNavTimerRef.current !== null) {
      clearTimeout(edgeNavTimerRef.current);
      edgeNavTimerRef.current = null;
    }
    edgeNavDirectionRef.current = null;
  }, []);

  const cancelAutoScroll = useCallback(() => {
    if (autoScrollRAFRef.current !== null) {
      cancelAnimationFrame(autoScrollRAFRef.current);
      autoScrollRAFRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

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
    cancelEdgeNav();
    cancelAutoScroll();
  }, [cancelEdgeNav, cancelAutoScroll]);

  // Auto-scroll loop
  const startAutoScrollLoop = useCallback(() => {
    if (autoScrollRAFRef.current !== null) return;

    const tick = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const speed = autoScrollSpeedRef.current;
      if (speed === 0) {
        autoScrollRAFRef.current = null;
        return;
      }

      container.scrollTop += speed;
      autoScrollRAFRef.current = requestAnimationFrame(tick);
    };

    autoScrollRAFRef.current = requestAnimationFrame(tick);
  }, [scrollContainerRef]);

  const scheduleEdgeNav = useCallback(
    (direction: number) => {
      if (edgeNavDirectionRef.current === direction) return;

      cancelEdgeNav();
      edgeNavDirectionRef.current = direction;

      const fireNav = () => {
        onDragNavigateRef.current?.(direction);
        edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_REPEAT_MS);
      };

      edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_DELAY_MS);
    },
    [cancelEdgeNav],
  );

  // Initialize the handlers once (stable references via refs)
  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      const deltaY = Math.abs(e.clientY - drag.startClientY);
      const deltaX = Math.abs(e.clientX - drag.startClientX);
      if (
        !drag.isDragging &&
        deltaY < DRAG_THRESHOLD_PX &&
        deltaX < DRAG_THRESHOLD_PX
      )
        return;

      if (!drag.isDragging) {
        drag.isDragging = true;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const absoluteY =
        e.clientY - containerRect.top + scrollTop - drag.offsetWithinEvent;
      const absoluteX =
        e.clientX - containerRect.left - drag.offsetWithinEventX;
      // The grid's top edge is `dayStartHour`, not midnight
      const visibleStartMinutes = dayStartHourRef.current * 60;
      const visibleEndMinutes = dayEndHourRef.current * 60;
      const rawMinutes =
        visibleStartMinutes + (absoluteY / hourHeightRef.current) * 60;
      const snappedStartMinutes = snapToGrid(
        rawMinutes,
        snapMinutesRef.current,
      );
      const clampedStart = Math.max(
        visibleStartMinutes,
        Math.min(snappedStartMinutes, visibleEndMinutes - drag.durationMinutes),
      );

      // Column detection — based on raw cursor position over the grid
      const colWidth = dayColumnWidthRef.current;
      const visibleDays = daysRef.current;
      const gridLeftEdge = containerRect.left + timeAxisWidthRef.current;
      const cursorInGrid = e.clientX - gridLeftEdge;
      const columnIndex = clamp(
        Math.floor(cursorInGrid / colWidth),
        0,
        visibleDays.length - 1,
      );
      const targetDay = visibleDays[columnIndex];

      const currentStart = addMinutesToDate(targetDay, clampedStart);
      const currentEnd = addMinutesToDate(
        targetDay,
        clampedStart + drag.durationMinutes,
      );

      drag.currentStart = currentStart;
      drag.currentEnd = currentEnd;

      setDragState({
        eventId: drag.eventId,
        event: drag.event,
        originalStart: drag.event.start,
        originalEnd: drag.event.end,
        currentStart,
        currentEnd,
        currentDate: targetDay,
        isDragging: true,
        cursorY: absoluteY,
        cursorX: absoluteX,
        clientX: e.clientX - drag.offsetWithinEventX,
        clientY: e.clientY - drag.offsetWithinEvent,
      });

      // Edge-of-view week navigation
      // Trigger when cursor is within EDGE_ZONE_PX of the grid boundary OR past it
      const cursorXInGrid = e.clientX - gridLeftEdge;
      const gridWidth = colWidth * visibleDays.length;

      if (cursorXInGrid < EDGE_ZONE_PX) {
        scheduleEdgeNav(-edgeNavigationDaysRef.current);
      } else if (cursorXInGrid > gridWidth - EDGE_ZONE_PX) {
        scheduleEdgeNav(edgeNavigationDaysRef.current);
      } else {
        cancelEdgeNav();
      }

      // Auto-scroll at top/bottom edges
      const cursorYInContainer = e.clientY - containerRect.top;
      const containerHeight = containerRect.height;

      if (cursorYInContainer < AUTO_SCROLL_ZONE_PX) {
        const dist = cursorYInContainer;
        autoScrollSpeedRef.current =
          -AUTO_SCROLL_MAX_SPEED * (1 - dist / AUTO_SCROLL_ZONE_PX);
        startAutoScrollLoop();
      } else if (cursorYInContainer > containerHeight - AUTO_SCROLL_ZONE_PX) {
        const dist = containerHeight - cursorYInContainer;
        autoScrollSpeedRef.current =
          AUTO_SCROLL_MAX_SPEED * (1 - dist / AUTO_SCROLL_ZONE_PX);
        startAutoScrollLoop();
      } else {
        cancelAutoScroll();
      }
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;

      cleanup();
      dragRef.current = null;
      setDragState(null);

      // Touch selects on release, after the drag, rather than on press
      if (drag.pointerType === "touch") onEventClickRef.current?.(drag.event);
      if (!drag.isDragging) return;
      suppressNextClick(drag.pointerType);

      // Commit from the handler, never from inside a state updater:
      // updaters run during render, and calling the parent's setState
      // there triggers "Cannot update a component while rendering".
      const event = eventsRef.current.find((e) => e.id === drag.eventId);
      if (!event) return;

      onEventChangeRef.current?.({
        ...event,
        start: drag.currentStart,
        end: drag.currentEnd,
      });
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
  }, [
    scrollContainerRef,
    cleanup,
    scheduleEdgeNav,
    cancelEdgeNav,
    cancelAutoScroll,
    startAutoScrollLoop,
  ]);

  const beginDrag = useCallback(
    (
      {
        clientX,
        clientY,
        pointerId,
        pointerType,
        element,
      }: PointerGestureStart,
      event: CalendarEvent,
    ) => {
      // Mouse and pen select the event immediately
      if (pointerType !== "touch") onEventClickRef.current?.(event);

      const container = scrollContainerRef.current;
      if (!container) return;

      // Compute offset within the event element
      const targetRect = element.getBoundingClientRect();
      const offsetWithinEvent = clientY - targetRect.top;
      const offsetWithinEventX = clientX - targetRect.left;

      const startMinutes =
        event.start.getHours() * 60 + event.start.getMinutes();
      // An end at the next midnight is minute 1440 of the event's day, not 0
      const endMinutes = isSameDay(event.start, event.end)
        ? event.end.getHours() * 60 + event.end.getMinutes()
        : 1440;
      const durationMinutes = endMinutes - startMinutes;

      dragRef.current = {
        eventId: event.id,
        event,
        pointerId,
        pointerType,
        startClientY: clientY,
        startClientX: clientX,
        offsetWithinEvent,
        offsetWithinEventX,
        isDragging: false,
        durationMinutes,
        currentStart: event.start,
        currentEnd: event.end,
      };

      setDragState({
        eventId: event.id,
        event,
        originalStart: event.start,
        originalEnd: event.end,
        currentStart: event.start,
        currentEnd: event.end,
        currentDate: event.start,
        isDragging: false,
        cursorY: 0,
        cursorX: 0,
        clientX: 0,
        clientY: 0,
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
    [scrollContainerRef],
  );

  const handleEventPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, event: CalendarEvent) => {
      startGesture(e, (start) => beginDrag(start, event));
    },
    [startGesture, beginDrag],
  );

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { dragState, handleEventPointerDown };
}
