"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerGestureStart } from "@/components/week-view-types";

interface UsePointerGestureOptions {
  /**
   * Element the gestures start in. A no-op, non-passive touchmove listener
   * on it keeps the browser from treating its touch moves as uncancelable,
   * so a long press that became a drag can stop the page from scrolling.
   */
  containerRef: React.RefObject<HTMLElement | null>;
}

interface UsePointerGestureReturn {
  /**
   * Starts a press-to-drag gesture from a pointerdown. Mouse and pen start
   * right away; touch starts after a long press, so a finger that moves
   * first scrolls the page instead. Non-primary pointers and buttons are
   * ignored.
   */
  startGesture: (
    e: React.PointerEvent<HTMLElement>,
    onStart: (start: PointerGestureStart) => void,
  ) => void;
}

/** How long (ms) a finger must rest before a touch drag, resize or create starts */
export const LONG_PRESS_DELAY_MS = 350;

/**
 * How far (px) a finger may move during the long press. Moving further
 * cancels it, so the gesture scrolls instead.
 */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 8;

/**
 * How long (ms) after a touch gesture ends its follow-up mousedown, click
 * and long-press context menu are swallowed. Mouse and pen clicks follow
 * pointerup in the same task, so for them the window closes on the next one.
 */
const TOUCH_FOLLOW_UP_WINDOW_MS = 400;

/** A touch waiting for its long press, or a long press that started a gesture */
interface TouchPress {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  /** Latest position, where the gesture starts when the long press completes */
  lastClientX: number;
  lastClientY: number;
  element: HTMLElement;
  /**
   * Node the touch events target. Browsers keep sending them there even
   * after it is removed from the DOM mid-drag, when they no longer bubble.
   */
  touchTarget: EventTarget;
  /** Whether the long press completed and the gesture is running */
  isActive: boolean;
  /** The element's inline touch-action before the gesture, restored after it */
  previousTouchAction: string;
  timer: ReturnType<typeof setTimeout> | null;
}

/** Whether a pointerdown can start a gesture: the primary pointer's main button (left mouse button, pen tip or a finger) */
export function isPrimaryPress(e: React.PointerEvent | PointerEvent): boolean {
  return e.isPrimary && e.button === 0;
}

/** Swallows the next `type` event the browser sends within `windowMs` */
function swallowNext(type: "click" | "mousedown", windowMs: number): void {
  const stop = () => {
    window.removeEventListener(type, swallow, true);
    clearTimeout(timer);
  };
  function swallow(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    stop();
  }
  window.addEventListener(type, swallow, true);
  const timer = setTimeout(stop, windowMs);
}

/**
 * Swallows the click the browser sends right after a drag, resize or touch
 * gesture ends. When the pressed element was swapped out mid-drag (for a
 * ghost or a floating copy), that click lands on a shared ancestor and would
 * read as a background click that clears the selection.
 */
export function suppressNextClick(pointerType: string): void {
  swallowNext("click", pointerType === "touch" ? TOUCH_FOLLOW_UP_WINDOW_MS : 0);
}

/** Keeps the long-press context menu from opening over a touch gesture */
function blockContextMenu(e: Event) {
  e.preventDefault();
  e.stopPropagation();
}

/** Registered only to make touch moves in the container cancelable */
function noop() {}

/**
 * Turns pointerdowns into press-to-drag gestures for the drag and resize
 * hooks: immediately for mouse and pen, after a long press for touch.
 * While a touch gesture runs, the pressed element gets `touch-action: none`,
 * page scrolling and the context menu are blocked, and the click that
 * follows it is swallowed.
 */
export function usePointerGesture({
  containerRef,
}: UsePointerGestureOptions): UsePointerGestureReturn {
  const pressRef = useRef<TouchPress | null>(null);
  const handlePressMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const handlePressEndRef = useRef<((e: PointerEvent) => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("touchmove", noop, { passive: false });
    return () => container.removeEventListener("touchmove", noop);
  }, [containerRef]);

  /** Stops the page from scrolling once the long press has completed */
  const blockTouchMove = useCallback((e: Event) => {
    if (!pressRef.current?.isActive || !e.cancelable) return;
    e.preventDefault();
  }, []);

  /** Ends the current touch press, whether it was pending or active */
  const finishPress = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    pressRef.current = null;

    if (press.timer !== null) clearTimeout(press.timer);
    if (handlePressMoveRef.current) {
      window.removeEventListener("pointermove", handlePressMoveRef.current);
    }
    if (handlePressEndRef.current) {
      window.removeEventListener("pointerup", handlePressEndRef.current);
      window.removeEventListener("pointercancel", handlePressEndRef.current);
    }
    press.touchTarget.removeEventListener("touchmove", blockTouchMove);

    if (!press.isActive) return;
    press.element.style.touchAction = press.previousTouchAction;
    // The browser may still send the touch's compatibility mousedown and
    // click. The mousedown would move focus (e.g. off a just-created
    // event's title) and the click would read as a background click.
    swallowNext("mousedown", TOUCH_FOLLOW_UP_WINDOW_MS);
    suppressNextClick("touch");
    setTimeout(() => {
      window.removeEventListener("contextmenu", blockContextMenu, true);
    }, TOUCH_FOLLOW_UP_WINDOW_MS);
  }, [blockTouchMove]);

  useEffect(() => {
    handlePressMoveRef.current = (e: PointerEvent) => {
      const press = pressRef.current;
      if (!press || e.pointerId !== press.pointerId) return;
      press.lastClientX = e.clientX;
      press.lastClientY = e.clientY;
      if (press.isActive) return;

      const distance = Math.hypot(
        e.clientX - press.startClientX,
        e.clientY - press.startClientY,
      );
      if (distance <= LONG_PRESS_MOVE_TOLERANCE_PX) return;
      // Moved before the long press completed: let the browser scroll
      finishPress();
    };

    handlePressEndRef.current = (e: PointerEvent) => {
      const press = pressRef.current;
      if (!press || e.pointerId !== press.pointerId) return;
      finishPress();
    };
  }, [finishPress]);

  // Cancel a pending or running touch press on unmount
  useEffect(() => {
    return finishPress;
  }, [finishPress]);

  const startGesture = useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      onStart: (start: PointerGestureStart) => void,
    ) => {
      if (!isPrimaryPress(e)) return;

      const element = e.currentTarget;
      if (e.pointerType !== "touch") {
        onStart({
          clientX: e.clientX,
          clientY: e.clientY,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          element,
        });
        return;
      }

      finishPress();
      const press: TouchPress = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
        element,
        touchTarget: e.target,
        isActive: false,
        previousTouchAction: "",
        timer: null,
      };
      pressRef.current = press;

      press.touchTarget.addEventListener("touchmove", blockTouchMove, {
        passive: false,
      });
      if (handlePressMoveRef.current) {
        window.addEventListener("pointermove", handlePressMoveRef.current);
      }
      if (handlePressEndRef.current) {
        window.addEventListener("pointerup", handlePressEndRef.current);
        window.addEventListener("pointercancel", handlePressEndRef.current);
      }

      press.timer = setTimeout(() => {
        press.timer = null;
        press.isActive = true;
        press.previousTouchAction = element.style.touchAction;
        element.style.touchAction = "none";
        window.addEventListener("contextmenu", blockContextMenu, true);
        onStart({
          clientX: press.lastClientX,
          clientY: press.lastClientY,
          pointerId: press.pointerId,
          pointerType: "touch",
          element,
        });
      }, LONG_PRESS_DELAY_MS);
    },
    [finishPress, blockTouchMove],
  );

  return { startGesture };
}
