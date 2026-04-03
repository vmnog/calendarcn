"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseVerticalScrollOptions {
  /** Ref to the scrollable container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Height of a single row in pixels */
  rowHeight: number;
  /** Called when scroll settles — receives the number of rows scrolled */
  onNavigate: (rowsDelta: number) => void;
  /** Disable scroll handling (e.g., during drag) */
  disabled?: boolean;
}

interface UseVerticalScrollReturn {
  /** Current scroll offset in pixels (for translateY) */
  scrollOffset: number;
  /** Slide animation offset in pixels (for button/keyboard nav) */
  slideOffset: number;
  /** Whether the user is actively scrolling */
  isScrolling: boolean;
  /** Whether a snap/slide animation is in progress */
  isAnimating: boolean;
  /** Trigger a slide animation for programmatic navigation */
  triggerSlideAnimation: (rowsDelta: number) => void;
}

/** Debounce time after last wheel event before snapping */
const SCROLL_END_DEBOUNCE_MS = 150;

/** Duration of snap/slide CSS transition */
const SNAP_ANIMATION_MS = 200;

export function useVerticalScroll({
  containerRef,
  rowHeight,
  onNavigate,
  disabled,
}: UseVerticalScrollOptions): UseVerticalScrollReturn {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const scrollEndTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const accumulatedDelta = useRef(0);
  const onNavigateRef = useRef(onNavigate);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
  }, [onNavigate]);

  const snapAndNavigate = useCallback(
    (offset: number) => {
      if (rowHeight <= 0) return;

      const rowsDelta = Math.round(offset / rowHeight);

      // If scroll distance < half a row, snap back
      if (rowsDelta === 0) {
        setIsAnimating(true);
        setScrollOffset(0);
        setTimeout(() => {
          setIsAnimating(false);
          setIsScrolling(false);
        }, SNAP_ANIMATION_MS);
        return;
      }

      // Snap to exact row boundary then navigate
      const targetOffset = rowsDelta * rowHeight;
      setIsAnimating(true);
      setScrollOffset(targetOffset);

      setTimeout(() => {
        onNavigateRef.current(-rowsDelta);
        setScrollOffset(0);
        setIsAnimating(false);
        setIsScrolling(false);
        accumulatedDelta.current = 0;
      }, SNAP_ANIMATION_MS);
    },
    [rowHeight],
  );

  // Programmatic slide animation for button/keyboard navigation
  const triggerSlideAnimation = useCallback(
    (rowsDelta: number) => {
      if (rowHeight <= 0 || isAnimating || isScrolling) return;

      const startOffset = rowsDelta * rowHeight;
      setSlideOffset(startOffset);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
          setSlideOffset(0);
          setTimeout(() => {
            setIsAnimating(false);
          }, SNAP_ANIMATION_MS);
        });
      });
    },
    [rowHeight, isAnimating, isScrolling],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (disabled) return;

      // Only handle vertical-dominant scrolls
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      e.preventDefault();

      setIsScrolling(true);

      // Negate deltaY: scroll down (positive deltaY) = move calendar up = navigate forward
      accumulatedDelta.current += -e.deltaY;
      setScrollOffset(accumulatedDelta.current);

      // Reset debounce timer
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }

      scrollEndTimer.current = setTimeout(() => {
        snapAndNavigate(accumulatedDelta.current);
        accumulatedDelta.current = 0;
      }, SCROLL_END_DEBOUNCE_MS);
    };

    container.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      if (scrollEndTimer.current) {
        clearTimeout(scrollEndTimer.current);
      }
    };
  }, [containerRef, snapAndNavigate, disabled]);

  return {
    scrollOffset,
    slideOffset,
    isScrolling,
    isAnimating,
    triggerSlideAnimation,
  };
}
