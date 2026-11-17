"use client";

import { useCallback, useRef } from "react";

/**
 * Longest time (ms) between the two clicks of a double-click on empty
 * calendar space. Notion Calendar's own, shorter than most systems' setting.
 */
export const DOUBLE_CLICK_INTERVAL_MS = 350;

/** Furthest (px) the second click of a double-click may land from the first */
export const DOUBLE_CLICK_DISTANCE_PX = 5;

/** The last click that wasn't the second of a double-click */
interface LastClick {
  time: number;
  clientX: number;
  clientY: number;
}

/**
 * Tells double-clicks on empty calendar space from single ones, the way
 * Notion Calendar does: two clicks within `DOUBLE_CLICK_INTERVAL_MS` and
 * `DOUBLE_CLICK_DISTANCE_PX` of each other. Call the returned function from
 * every click on that empty space; it returns true for the click that
 * completes a double-click. The browser's own `dblclick` also fires when the
 * first click landed on something else, like an event beside the slot.
 */
export function useDoubleClick(): (e: React.MouseEvent) => boolean {
  const lastClickRef = useRef<LastClick | null>(null);

  return useCallback((e: React.MouseEvent) => {
    const last = lastClickRef.current;
    const isDoubleClick =
      last !== null &&
      e.timeStamp - last.time <= DOUBLE_CLICK_INTERVAL_MS &&
      Math.hypot(e.clientX - last.clientX, e.clientY - last.clientY) <=
        DOUBLE_CLICK_DISTANCE_PX;
    // A third click starts over: it is the first of the next pair
    lastClickRef.current = isDoubleClick
      ? null
      : { time: e.timeStamp, clientX: e.clientX, clientY: e.clientY };
    return isDoubleClick;
  }, []);
}
