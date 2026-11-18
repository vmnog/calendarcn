"use client";

import * as React from "react";

/**
 * How long after a framed example loads its own focus moves are handed back,
 * in ms: long enough for a dialog that starts open to focus its field
 */
const FRAME_AUTOFOCUS_WINDOW_MS = 2000;

/**
 * Keeps a framed example from taking the docs page's focus as it loads. A
 * dialog that starts open (the command menu, the settings) focuses its
 * field when it mounts, and inside a docs iframe that would pull the page's
 * focus, and its keys, into the frame. In the frame's first moments, until
 * the reader presses or types in it, a focus move goes back to the page; the
 * dialog stays open. (User activation can't tell: a click on the docs page
 * activates its same-origin frames too.)
 */
export function FrameFocusGuard() {
  React.useEffect(() => {
    if (window.parent === window) return;

    const startedAt = performance.now();
    const handleFocusIn = (e: FocusEvent) => {
      if (performance.now() - startedAt > FRAME_AUTOFOCUS_WINDOW_MS) {
        disarm();
        return;
      }
      if (e.target instanceof HTMLElement) e.target.blur();
      window.parent.focus();
    };
    function disarm() {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", disarm, true);
      document.removeEventListener("keydown", disarm, true);
    }
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", disarm, true);
    document.addEventListener("keydown", disarm, true);
    return disarm;
  }, []);

  return null;
}
