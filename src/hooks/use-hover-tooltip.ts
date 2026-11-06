import * as React from "react";

/**
 * Value `useHoverTooltip` returns
 */
export interface UseHoverTooltipResult {
  /** Whether the tooltip shows */
  isOpen: boolean;
  /** The pointer entered the trigger: opens after `TOOLTIP_OPEN_DELAY` */
  scheduleOpen: () => void;
  /** The pointer left the trigger or the tooltip: closes after `TOOLTIP_CLOSE_DELAY` */
  scheduleClose: () => void;
  /** The pointer reached the tooltip before it closed: keeps it open */
  keepOpen: () => void;
}

/** How long the pointer rests on a trigger before its tooltip shows, in ms */
const TOOLTIP_OPEN_DELAY = 500;

/** Time to move the pointer from a trigger onto its tooltip, in ms */
const TOOLTIP_CLOSE_DELAY = 120;

/**
 * Open state of a tooltip that shows after the pointer rests on its
 * trigger, and stays while the pointer moves onto it
 */
export function useHoverTooltip(): UseHoverTooltipResult {
  const [isOpen, setIsOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  const scheduleOpen = React.useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(
      () => setIsOpen(true),
      TOOLTIP_OPEN_DELAY,
    );
  }, [clearTimer]);

  const scheduleClose = React.useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(
      () => setIsOpen(false),
      TOOLTIP_CLOSE_DELAY,
    );
  }, [clearTimer]);

  return { isOpen, scheduleOpen, scheduleClose, keepOpen: clearTimer };
}
