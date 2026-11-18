"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isPrimaryPress,
  suppressNextClick,
  usePointerGesture,
} from "@/hooks/use-pointer-gesture";
import { getAllDayEventRange } from "@/lib/event-utils";
import type {
  EventDrawPhase,
  NewEventRange,
  PointerGestureStart,
} from "@/components/week-view-types";

interface UseDayRangeDrawOptions {
  /** Element the gestures start in: the all-day row or the month grid */
  containerRef: React.RefObject<HTMLElement | null>;
  /**
   * The day under a viewport position, or `null` when there is none (the
   * pointer left the days): the range then keeps its last day
   */
  getDayAtPoint: (clientX: number, clientY: number) => Date | null;
  /**
   * Called with the whole days drawn so far: "start" once the press becomes
   * a drag, "move" each time the pointer reaches another day, "end" on
   * release
   */
  onDraw?: (range: NewEventRange, phase: EventDrawPhase) => void;
  /** Called when a drag that started drawing is dropped: Escape, or the browser took the pointer */
  onCancel?: () => void;
}

interface UseDayRangeDrawReturn {
  /** Whether a drag is drawing a new all-day event right now */
  isDrawing: boolean;
  /** Starts a draw gesture from a pointerdown on a day's empty space */
  handleDrawPointerDown: (
    e: React.PointerEvent<HTMLElement>,
    day: Date,
  ) => void;
}

/**
 * How far (px) the pointer travels before a press on empty space draws an
 * event. Matches the drag and resize thresholds, so a click never draws.
 */
const DRAW_THRESHOLD_PX = 4;

/** A press on a day's empty space that may become, or is, a drawn all-day event */
interface DayDrawInfo {
  /** Pointer driving the gesture; moves from other pointers are ignored */
  pointerId: number;
  /** "mouse", "pen" or "touch" */
  pointerType: string;
  startClientX: number;
  startClientY: number;
  /** The pressed day: the end of the range that stays put */
  anchorDay: Date;
  /** Whether the press has started drawing (reported "start") */
  isDrawing: boolean;
  /** Whether the pointer has travelled past the threshold */
  hasMoved: boolean;
  /** Range reported last, reported again as the final one on release */
  range: NewEventRange | null;
}

/**
 * Draws a new all-day event over whole days, as Notion Calendar does in the
 * all-day row and the month view: press a day's empty space and drag to
 * another day, forwards or backwards. Mouse and pen draw once the pointer
 * has moved; touch draws from a long press, starting with the pressed day.
 * Escape or a `pointercancel` mid-drag drops it through `onCancel`.
 */
export function useDayRangeDraw({
  containerRef,
  getDayAtPoint,
  onDraw,
  onCancel,
}: UseDayRangeDrawOptions): UseDayRangeDrawReturn {
  const [isDrawing, setIsDrawing] = useState(false);
  const { startGesture } = usePointerGesture({ containerRef });

  const drawRef = useRef<DayDrawInfo | null>(null);
  const getDayAtPointRef = useRef(getDayAtPoint);
  const onDrawRef = useRef(onDraw);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    getDayAtPointRef.current = getDayAtPoint;
  }, [getDayAtPoint]);
  useEffect(() => {
    onDrawRef.current = onDraw;
  }, [onDraw]);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  const handlePointerMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePointerCancelRef = useRef<((e: PointerEvent) => void) | null>(
    null,
  );
  const handleKeyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null);

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
  }, []);

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

      const day = getDayAtPointRef.current(e.clientX, e.clientY);
      // Off the days: keep the range as it is
      if (!day && draw.range) return;
      const range = getAllDayEventRange(draw.anchorDay, day ?? draw.anchorDay);
      const isSameRange =
        draw.range !== null &&
        draw.range.start.getTime() === range.start.getTime() &&
        draw.range.end.getTime() === range.end.getTime();
      draw.range = range;

      if (!draw.isDrawing) {
        draw.isDrawing = true;
        setIsDrawing(true);
        onDrawRef.current?.(range, "start");
        return;
      }
      if (!isSameRange) onDrawRef.current?.(range, "move");
    };

    handlePointerUpRef.current = (e: PointerEvent) => {
      const draw = drawRef.current;
      if (!draw || e.pointerId !== draw.pointerId) return;

      cleanup();
      drawRef.current = null;
      setIsDrawing(false);

      if (!draw.isDrawing || !draw.range) return;
      // The click that follows lands on the view and would read as a
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
  }, [cleanup, cancelDraw]);

  const beginDraw = useCallback(
    (
      { clientX, clientY, pointerId, pointerType }: PointerGestureStart,
      day: Date,
    ) => {
      const draw: DayDrawInfo = {
        pointerId,
        pointerType,
        startClientX: clientX,
        startClientY: clientY,
        anchorDay: day,
        isDrawing: false,
        hasMoved: false,
        range: null,
      };
      drawRef.current = draw;

      // A long press draws at once: a finger has no double-click
      if (pointerType === "touch") {
        draw.range = getAllDayEventRange(day);
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
    [],
  );

  const handleDrawPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>, day: Date) => {
      if (!isPrimaryPress(e)) return;
      startGesture(e, (start) => beginDraw(start, day));
    },
    [startGesture, beginDraw],
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return { isDrawing, handleDrawPointerDown };
}
