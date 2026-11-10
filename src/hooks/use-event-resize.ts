"use client";

import { isSameDay, startOfDay, subDays } from "date-fns";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isPrimaryPress,
  suppressNextClick,
  usePointerGesture,
} from "@/hooks/use-pointer-gesture";
import { snapToGrid } from "@/lib/event-utils";
import type {
  CalendarEvent,
  EventResizeState,
  PointerGestureStart,
} from "@/components/week-view-types";

interface UseEventResizeOptions {
  hourHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  events: CalendarEvent[];
  days: Date[];
  dayColumnWidth: number;
  timeAxisWidth: number;
  /** Minute step the dragged edge snaps to, and the shortest duration */
  snapMinutes: number;
  /** First visible hour: the top of the grid, and the earliest start */
  dayStartHour: number;
  /** Hour the grid ends at: the latest end */
  dayEndHour: number;
  /** Days `onResizeNavigate` moves when the cursor is held at a side edge */
  edgeNavigationDays: number;
  onEventChange?: (event: CalendarEvent) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onResizeNavigate?: (daysDelta: number) => void;
}

interface UseEventResizeReturn {
  resizeState: EventResizeState | null;
  handleResizePointerDown: (
    e: React.PointerEvent<HTMLElement>,
    event: CalendarEvent,
    edge: "top" | "bottom",
  ) => void;
}

const DRAG_THRESHOLD_PX = 4;
const AUTO_SCROLL_ZONE_PX = 60;
const AUTO_SCROLL_MAX_SPEED = 12;
const EDGE_ZONE_PX = 40;
const EDGE_NAV_DELAY_MS = 500;
const EDGE_NAV_REPEAT_MS = 800;

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

interface ResizeInfo {
  eventId: string;
  event: CalendarEvent;
  /** Pointer driving the resize; moves from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  edge: "top" | "bottom";
  startClientY: number;
  isResizing: boolean;
  originalStartMinutes: number;
  originalEndMinutes: number;
  originalStartDate: Date;
  originalEndDate: Date;
  /** Latest snapped start, committed to the parent on pointerup */
  currentStart: Date;
  /** Latest snapped end, committed to the parent on pointerup */
  currentEnd: Date;
}

export function useEventResize({
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
  onResizeNavigate,
}: UseEventResizeOptions): UseEventResizeReturn {
  const [resizeState, setResizeState] = useState<EventResizeState | null>(null);
  const { startGesture } = usePointerGesture({
    containerRef: scrollContainerRef,
  });

  const resizeRef = useRef<ResizeInfo | null>(null);
  const onEventChangeRef = useRef(onEventChange);
  const onEventClickRef = useRef(onEventClick);
  const onResizeNavigateRef = useRef(onResizeNavigate);
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
    onResizeNavigateRef.current = onResizeNavigate;
  }, [onResizeNavigate]);
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

  const autoScrollRAFRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);
  const edgeNavTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeNavDirectionRef = useRef<number | null>(null);

  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );

  const cancelAutoScroll = useCallback(() => {
    if (autoScrollRAFRef.current !== null) {
      cancelAnimationFrame(autoScrollRAFRef.current);
      autoScrollRAFRef.current = null;
    }
    autoScrollSpeedRef.current = 0;
  }, []);

  const cancelEdgeNav = useCallback(() => {
    if (edgeNavTimerRef.current !== null) {
      clearTimeout(edgeNavTimerRef.current);
      edgeNavTimerRef.current = null;
    }
    edgeNavDirectionRef.current = null;
  }, []);

  const scheduleEdgeNav = useCallback(
    (direction: number) => {
      if (edgeNavDirectionRef.current === direction) return;

      cancelEdgeNav();
      edgeNavDirectionRef.current = direction;

      const fireNav = () => {
        onResizeNavigateRef.current?.(direction);
        edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_REPEAT_MS);
      };

      edgeNavTimerRef.current = setTimeout(fireNav, EDGE_NAV_DELAY_MS);
    },
    [cancelEdgeNav],
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
    cancelAutoScroll();
    cancelEdgeNav();
  }, [cancelAutoScroll, cancelEdgeNav]);

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

  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;

      const deltaY = Math.abs(e.clientY - resize.startClientY);
      if (!resize.isResizing && deltaY < DRAG_THRESHOLD_PX) return;

      if (!resize.isResizing) {
        resize.isResizing = true;
      }

      const container = scrollContainerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const scrollTop = container.scrollTop;
      const absoluteY = e.clientY - containerRect.top + scrollTop;
      // The grid's top edge is `dayStartHour`, not midnight
      const visibleStartMinutes = dayStartHourRef.current * 60;
      const visibleEndMinutes = dayEndHourRef.current * 60;
      const rawMinutes =
        visibleStartMinutes + (absoluteY / hourHeightRef.current) * 60;
      const snapStep = snapMinutesRef.current;
      const snappedMinutes = snapToGrid(rawMinutes, snapStep);
      // Shortest event a resize can make: one snap step
      const minDurationMinutes = snapStep;

      let newStartMinutes = resize.originalStartMinutes;
      let newEndMinutes = resize.originalEndMinutes;
      let startDate = resize.originalStartDate;
      let endDate = resize.originalEndDate;

      // Column detection (shared for both edges)
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

      // Unified anchor model: anchor is the opposite end of the grabbed edge
      const anchorDate =
        resize.edge === "bottom"
          ? resize.originalStartDate
          : resize.originalEndDate;
      const anchorMinutes =
        resize.edge === "bottom"
          ? resize.originalStartMinutes
          : resize.originalEndMinutes;

      const cursorTimestamp = targetDay.getTime() + snappedMinutes * 60000;
      const anchorTimestamp = anchorDate.getTime() + anchorMinutes * 60000;

      let effectiveEdge: "top" | "bottom";

      if (cursorTimestamp > anchorTimestamp) {
        // Cursor is after anchor → effective bottom
        effectiveEdge = "bottom";
        startDate = anchorDate;
        newStartMinutes = anchorMinutes;
        endDate = targetDay;
        newEndMinutes = clamp(
          snappedMinutes,
          visibleStartMinutes,
          visibleEndMinutes,
        );

        // Cross-day edge case: cursor at minute 0 on day right after anchor → treat as end-of-anchor-day
        if (!isSameDay(targetDay, anchorDate)) {
          const dayAfterAnchor = new Date(anchorDate);
          dayAfterAnchor.setDate(dayAfterAnchor.getDate() + 1);
          dayAfterAnchor.setHours(0, 0, 0, 0);

          if (isSameDay(targetDay, dayAfterAnchor) && snappedMinutes === 0) {
            newEndMinutes = 1440;
            endDate = anchorDate;
          }
        }

        // Same-day: enforce min duration
        if (isSameDay(startDate, endDate)) {
          newEndMinutes = clamp(
            newEndMinutes,
            anchorMinutes + minDurationMinutes,
            1440,
          );
        }
      } else if (cursorTimestamp < anchorTimestamp) {
        // Cursor is before anchor → effective top
        effectiveEdge = "top";
        endDate = anchorDate;
        newEndMinutes = anchorMinutes;
        startDate = targetDay;
        newStartMinutes = clamp(
          snappedMinutes,
          visibleStartMinutes,
          visibleEndMinutes,
        );

        // Cross-day edge case: cursor at minute 1440 on day right before anchor → treat as start-of-anchor-day
        if (!isSameDay(targetDay, anchorDate)) {
          const dayBeforeAnchor = new Date(anchorDate);
          dayBeforeAnchor.setDate(dayBeforeAnchor.getDate() - 1);
          dayBeforeAnchor.setHours(0, 0, 0, 0);

          if (isSameDay(targetDay, dayBeforeAnchor) && snappedMinutes >= 1440) {
            newStartMinutes = 0;
            startDate = anchorDate;
          }
        }

        // Same-day: enforce min duration
        if (isSameDay(startDate, endDate)) {
          newStartMinutes = clamp(
            newStartMinutes,
            0,
            anchorMinutes - minDurationMinutes,
          );
        }
      } else {
        // Cursor at anchor → keep minimum duration in original edge direction (no flip)
        effectiveEdge = resize.edge;
        if (resize.edge === "bottom") {
          startDate = anchorDate;
          newStartMinutes = anchorMinutes;
          endDate = anchorDate;
          newEndMinutes = anchorMinutes + minDurationMinutes;
        } else {
          endDate = anchorDate;
          newEndMinutes = anchorMinutes;
          startDate = anchorDate;
          newStartMinutes = anchorMinutes - minDurationMinutes;
        }
      }

      const currentStart = addMinutesToDate(startDate, newStartMinutes);
      const currentEnd = addMinutesToDate(endDate, newEndMinutes);

      resize.currentStart = currentStart;
      resize.currentEnd = currentEnd;

      setResizeState({
        eventId: resize.eventId,
        event: resize.event,
        originalStart: resize.event.start,
        originalEnd: resize.event.end,
        currentStart,
        currentEnd,
        edge: resize.edge,
        effectiveEdge,
        isResizing: true,
        currentEndDate: endDate,
        currentStartDate: startDate,
      });

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

      // Edge-of-view week navigation
      const cursorXInGrid = e.clientX - gridLeftEdge;
      const gridWidth = colWidth * visibleDays.length;

      if (cursorXInGrid < EDGE_ZONE_PX) {
        scheduleEdgeNav(-edgeNavigationDaysRef.current);
      } else if (cursorXInGrid > gridWidth - EDGE_ZONE_PX) {
        scheduleEdgeNav(edgeNavigationDaysRef.current);
      } else {
        cancelEdgeNav();
      }
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;

      cleanup();
      resizeRef.current = null;
      setResizeState(null);

      // Touch selects on release, after the resize, rather than on press
      if (resize.pointerType === "touch") {
        onEventClickRef.current?.(resize.event);
      }
      if (!resize.isResizing) return;
      suppressNextClick(resize.pointerType);

      // Commit from the handler, never from inside a state updater:
      // updaters run during render, and calling the parent's setState
      // there triggers "Cannot update a component while rendering".
      const event = eventsRef.current.find((e) => e.id === resize.eventId);
      if (!event) return;

      const MS_IN_24H = 24 * 60 * 60 * 1000;
      const isLongerThan24h =
        resize.currentEnd.getTime() - resize.currentStart.getTime() > MS_IN_24H;

      onEventChangeRef.current?.({
        ...event,
        start: resize.currentStart,
        end: resize.currentEnd,
        isAllDay: isLongerThan24h,
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
  }, [
    scrollContainerRef,
    cleanup,
    cancelAutoScroll,
    startAutoScrollLoop,
    scheduleEdgeNav,
    cancelEdgeNav,
  ]);

  const beginResize = useCallback(
    (
      { clientY, pointerId, pointerType }: PointerGestureStart,
      event: CalendarEvent,
      edge: "top" | "bottom",
    ) => {
      // Mouse and pen select the event immediately
      if (pointerType !== "touch") onEventClickRef.current?.(event);

      const originalStartMinutes =
        event.start.getHours() * 60 + event.start.getMinutes();
      let originalEndMinutes =
        event.end.getHours() * 60 + event.end.getMinutes();

      const originalStartDate = startOfDay(event.start);
      let originalEndDate = startOfDay(event.end);

      // An end at the next midnight is minute 1440 of the day before, so the
      // resize starts within one day
      if (originalEndMinutes === 0 && !isSameDay(event.start, event.end)) {
        originalEndMinutes = 1440;
        originalEndDate = subDays(originalEndDate, 1);
      }

      resizeRef.current = {
        eventId: event.id,
        event,
        pointerId,
        pointerType,
        edge,
        startClientY: clientY,
        isResizing: false,
        originalStartMinutes,
        originalEndMinutes,
        originalStartDate,
        originalEndDate,
        currentStart: event.start,
        currentEnd: event.end,
      };

      setResizeState({
        eventId: event.id,
        event,
        originalStart: event.start,
        originalEnd: event.end,
        currentStart: event.start,
        currentEnd: event.end,
        edge,
        effectiveEdge: edge,
        isResizing: false,
        currentEndDate: originalEndDate,
        currentStartDate: originalStartDate,
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
      edge: "top" | "bottom",
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
