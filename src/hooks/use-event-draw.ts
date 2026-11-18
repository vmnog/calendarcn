"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isPrimaryPress,
  suppressNextClick,
  usePointerGesture,
} from "@/hooks/use-pointer-gesture";
import { getClickedEventRange, getDrawnEventRange } from "@/lib/event-utils";
import type { TimeGridPoint } from "@/lib/event-utils";
import type {
  EventDrawPhase,
  NewEventRange,
  PointerGestureStart,
} from "@/components/week-view-types";

interface UseEventDrawOptions {
  hourHeight: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Days on screen, left to right: the columns a drag can reach */
  days: Date[];
  dayColumnWidth: number;
  timeAxisWidth: number;
  /** Minute step both ends of the drawn range snap to, and its shortest length */
  snapMinutes: number;
  /** Length of the event a touch long press starts with, before the finger moves */
  defaultEventDuration: number;
  /** First visible hour: the top of the grid, and the earliest start */
  dayStartHour: number;
  /** Hour the grid ends at: the latest end */
  dayEndHour: number;
  /**
   * Called with the range drawn so far: "start" once the press becomes a
   * drag, "move" each time the snapped range changes, "end" on release
   */
  onDraw?: (range: NewEventRange, phase: EventDrawPhase) => void;
  /** Called when a drag that started drawing is dropped: Escape, or the browser took the pointer */
  onCancel?: () => void;
}

interface UseEventDrawReturn {
  /** Whether a drag is drawing a new event right now */
  isDrawing: boolean;
  /** Starts a draw gesture from a pointerdown on a day column's empty space */
  handleDrawPointerDown: (
    e: React.PointerEvent<HTMLElement>,
    columnDate: Date,
  ) => void;
}

/**
 * How far (px) the pointer travels before a press on empty space draws an
 * event. Matches the drag and resize thresholds, so a click never draws.
 */
const DRAW_THRESHOLD_PX = 4;
const AUTO_SCROLL_ZONE_PX = 60;
const AUTO_SCROLL_MAX_SPEED = 12;

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** A press on empty grid space that may become, or is, a drawn event */
interface DrawInfo {
  /** Pointer driving the gesture; moves from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  startClientX: number;
  startClientY: number;
  /** Where the press landed: the end of the range that stays put */
  anchor: TimeGridPoint;
  /** Whether the press has started drawing (reported "start") */
  isDrawing: boolean;
  /** Whether the pointer has travelled past the threshold */
  hasMoved: boolean;
  /** Range reported last, reported again as the final one on release */
  range: NewEventRange | null;
}

/**
 * Draws a new event on the time grid, as Notion Calendar does: press empty
 * space and drag. The press is the anchor; the range runs from it to the
 * pointer, up or down and across day columns, snapped to `snapMinutes`.
 * Mouse and pen draw once the pointer has moved; touch draws from a long
 * press, starting with a `defaultEventDuration` event at the pressed slot.
 * Escape or a `pointercancel` mid-drag drops it through `onCancel`.
 */
export function useEventDraw({
  hourHeight,
  scrollContainerRef,
  days,
  dayColumnWidth,
  timeAxisWidth,
  snapMinutes,
  defaultEventDuration,
  dayStartHour,
  dayEndHour,
  onDraw,
  onCancel,
}: UseEventDrawOptions): UseEventDrawReturn {
  const [isDrawing, setIsDrawing] = useState(false);
  const { startGesture } = usePointerGesture({
    containerRef: scrollContainerRef,
  });

  const drawRef = useRef<DrawInfo | null>(null);
  const onDrawRef = useRef(onDraw);
  const onCancelRef = useRef(onCancel);
  const hourHeightRef = useRef(hourHeight);
  const daysRef = useRef(days);
  const dayColumnWidthRef = useRef(dayColumnWidth);
  const timeAxisWidthRef = useRef(timeAxisWidth);
  const snapMinutesRef = useRef(snapMinutes);
  const defaultEventDurationRef = useRef(defaultEventDuration);
  const dayStartHourRef = useRef(dayStartHour);
  const dayEndHourRef = useRef(dayEndHour);

  useEffect(() => {
    onDrawRef.current = onDraw;
  }, [onDraw]);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);
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
    defaultEventDurationRef.current = defaultEventDuration;
  }, [defaultEventDuration]);
  useEffect(() => {
    dayStartHourRef.current = dayStartHour;
  }, [dayStartHour]);
  useEffect(() => {
    dayEndHourRef.current = dayEndHour;
  }, [dayEndHour]);

  const autoScrollRAFRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);

  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );
  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null);

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
    if (handleKeyDownRef.current) {
      window.removeEventListener("keydown", handleKeyDownRef.current, true);
    }
    cancelAutoScroll();
  }, [cancelAutoScroll]);

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

  /** The grid point under a viewport position: its day column and clock minutes */
  const getPointAt = useCallback(
    (clientX: number, clientY: number, fallbackDay: Date): TimeGridPoint => {
      const container = scrollContainerRef.current;
      if (!container) return { day: fallbackDay, minutes: 0 };

      const containerRect = container.getBoundingClientRect();
      const absoluteY = clientY - containerRect.top + container.scrollTop;
      // The grid's top edge is `dayStartHour`, not midnight
      const minutes =
        dayStartHourRef.current * 60 + (absoluteY / hourHeightRef.current) * 60;

      const visibleDays = daysRef.current;
      const colWidth = dayColumnWidthRef.current;
      if (visibleDays.length === 0 || colWidth <= 0) {
        return { day: fallbackDay, minutes };
      }
      const gridLeftEdge = containerRect.left + timeAxisWidthRef.current;
      const columnIndex = clamp(
        Math.floor((clientX - gridLeftEdge) / colWidth),
        0,
        visibleDays.length - 1,
      );
      return { day: visibleDays[columnIndex], minutes };
    },
    [scrollContainerRef],
  );

  /** Ends the gesture without a draft: Escape, or the browser took the pointer */
  const cancelDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    cleanup();
    drawRef.current = null;
    setIsDrawing(false);
    if (draw.isDrawing) onCancelRef.current?.();
  }, [cleanup]);

  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const draw = drawRef.current;
      if (!draw || e.pointerId !== draw.pointerId) return;

      if (!draw.hasMoved) {
        const distance = Math.hypot(
          e.clientX - draw.startClientX,
          e.clientY - draw.startClientY,
        );
        if (distance < DRAW_THRESHOLD_PX) return;
        draw.hasMoved = true;
      }

      const range = getDrawnEventRange(
        draw.anchor,
        getPointAt(e.clientX, e.clientY, draw.anchor.day),
        {
          snapMinutes: snapMinutesRef.current,
          dayStartHour: dayStartHourRef.current,
          dayEndHour: dayEndHourRef.current,
        },
      );
      const isSameRange =
        draw.range !== null &&
        draw.range.start.getTime() === range.start.getTime() &&
        draw.range.end.getTime() === range.end.getTime();
      draw.range = range;

      if (!draw.isDrawing) {
        draw.isDrawing = true;
        setIsDrawing(true);
        onDrawRef.current?.(range, "start");
      } else if (!isSameRange) {
        onDrawRef.current?.(range, "move");
      }

      // Auto-scroll at top/bottom edges
      const container = scrollContainerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const cursorYInContainer = e.clientY - containerRect.top;

      if (cursorYInContainer < AUTO_SCROLL_ZONE_PX) {
        autoScrollSpeedRef.current =
          -AUTO_SCROLL_MAX_SPEED *
          (1 - Math.max(0, cursorYInContainer) / AUTO_SCROLL_ZONE_PX);
        startAutoScrollLoop();
        return;
      }
      if (cursorYInContainer > containerRect.height - AUTO_SCROLL_ZONE_PX) {
        const distance = Math.max(0, containerRect.height - cursorYInContainer);
        autoScrollSpeedRef.current =
          AUTO_SCROLL_MAX_SPEED * (1 - distance / AUTO_SCROLL_ZONE_PX);
        startAutoScrollLoop();
        return;
      }
      cancelAutoScroll();
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const draw = drawRef.current;
      if (!draw || e.pointerId !== draw.pointerId) return;

      cleanup();
      drawRef.current = null;
      setIsDrawing(false);

      if (!draw.isDrawing || !draw.range) return;
      // The click that follows lands on the grid and would read as a
      // background click that throws the new draft away
      suppressNextClick(draw.pointerType);
      onDrawRef.current?.(draw.range, "end");
    };

    // The browser took the pointer over (e.g. for a system gesture): drop
    // the draft
    handlePointerCancelRef.current = (e: PointerEvent) => {
      const draw = drawRef.current;
      if (!draw || e.pointerId !== draw.pointerId) return;
      cancelDraw();
    };

    // Escape mid-drag drops the draft, as in Notion Calendar. The key goes
    // on to the calendar's own Escape, which clears the selection anyway.
    handleKeyDownRef.current = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      cancelDraw();
    };
  }, [
    scrollContainerRef,
    cleanup,
    cancelDraw,
    cancelAutoScroll,
    startAutoScrollLoop,
    getPointAt,
  ]);

  const beginDraw = useCallback(
    (
      { clientX, clientY, pointerId, pointerType }: PointerGestureStart,
      columnDate: Date,
    ) => {
      const anchor = getPointAt(clientX, clientY, columnDate);
      const draw: DrawInfo = {
        pointerId,
        pointerType,
        startClientX: clientX,
        startClientY: clientY,
        // The pressed column is the anchor's day, whatever X resolves to
        anchor: { day: columnDate, minutes: anchor.minutes },
        isDrawing: false,
        hasMoved: false,
        range: null,
      };
      drawRef.current = draw;

      // A long press draws at once: a finger has no double-click
      if (pointerType === "touch") {
        draw.range = getClickedEventRange(columnDate, anchor.minutes, {
          snapMinutes: snapMinutesRef.current,
          defaultEventDuration: defaultEventDurationRef.current,
          dayStartHour: dayStartHourRef.current,
          dayEndHour: dayEndHourRef.current,
        });
        draw.isDrawing = true;
        setIsDrawing(true);
        onDrawRef.current?.(draw.range, "start");
      }

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
      if (handleKeyDownRef.current) {
        window.addEventListener("keydown", handleKeyDownRef.current, true);
      }
    },
    [getPointAt],
  );

  const handleDrawPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, columnDate: Date) => {
      if (!isPrimaryPress(e)) return;
      startGesture(e, (start) => beginDraw(start, columnDate));
    },
    [startGesture, beginDraw],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { isDrawing, handleDrawPointerDown };
}
