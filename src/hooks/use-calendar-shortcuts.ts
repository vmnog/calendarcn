import * as React from "react";

import { useCalendar } from "@/components/calendar-provider";
import type { CalendarContextValue } from "@/components/calendar-types";

interface UseCalendarShortcutsOptions {
  /** Whether the shortcuts are active. Defaults to true */
  enabled?: boolean;
}

/** Calendar actions the shortcuts trigger */
type ShortcutActions = Pick<
  CalendarContextValue,
  | "goToToday"
  | "goToPrev"
  | "goToNext"
  | "switchView"
  | "setNumberOfDays"
  | "clearSelection"
  | "toggleWeekends"
  | "toggleDeclinedEvents"
>;

/** Keys 2-9: show that many days */
const NUMBER_OF_DAYS_KEY = /^[2-9]$/;

/** Whether a key press is typed into a text field (single-key shortcuts skip those) */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA";
}

/**
 * Handles one key press. Returns early on the first match, in the same
 * order the demo has always checked them.
 */
function handleShortcut(e: KeyboardEvent, actions: ShortcutActions): void {
  // Escape deselects, even from inside a text field
  if (e.key === "Escape") {
    actions.clearSelection();
    return;
  }

  const isCommand = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();

  // Shift+Cmd+E / Shift+Cmd+D (Ctrl on Windows and Linux) toggle the view
  // settings, even from inside a text field
  if (isCommand && e.shiftKey && key === "e") {
    e.preventDefault();
    actions.toggleWeekends();
    return;
  }

  if (isCommand && e.shiftKey && key === "d") {
    e.preventDefault();
    actions.toggleDeclinedEvents();
    return;
  }

  // Single keys only: Cmd+K, Ctrl+D and the like belong to the app and browser
  if (isCommand || isTypingTarget(e.target)) return;

  if (e.key === "t" || e.key === "T") {
    e.preventDefault();
    actions.goToToday();
    return;
  }

  if (e.key === "1" || e.key === "d" || e.key === "D") {
    e.preventDefault();
    actions.switchView("day");
    return;
  }

  if (e.key === "0" || e.key === "w" || e.key === "W") {
    e.preventDefault();
    actions.switchView("week");
    return;
  }

  if (NUMBER_OF_DAYS_KEY.test(e.key)) {
    e.preventDefault();
    actions.setNumberOfDays(Number(e.key));
    return;
  }

  if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
    e.preventDefault();
    actions.goToPrev();
    return;
  }

  if (e.key === "k" || e.key === "K" || e.key === "ArrowRight") {
    e.preventDefault();
    actions.goToNext();
    return;
  }

  // Lowercase only: Shift+M is left free for app shortcuts
  if (e.key === "m") {
    e.preventDefault();
    actions.switchView("month");
    return;
  }

  // Cmd+A / Ctrl+A never get here, so they still select all
  if (e.key === "a" || e.key === "A") {
    e.preventDefault();
    actions.switchView("agenda");
  }
}

/**
 * Opt-in single-key calendar shortcuts, listening on `window`:
 *
 * - T: today
 * - J / ArrowLeft, K / ArrowRight: previous / next period
 * - D or 1: day view, W or 0: week view, M: month view, A: agenda
 * - 2-9: number of days
 * - Escape: clear the selection
 * - Shift+Cmd+E / Shift+Cmd+D (Ctrl on Windows and Linux): show or hide
 *   weekends / declined events
 *
 * Presses with Cmd or Ctrl are left alone, apart from those two.
 *
 * Key presses in inputs and textareas are ignored (except Escape). The
 * listener is added once on mount, so its position among other `window`
 * keydown listeners stays fixed: an app shortcut that shares a key (e.g.
 * Cmd+K) should be handled by a listener added before this hook's, and call
 * `event.stopImmediatePropagation()`.
 */
export function useCalendarShortcuts({
  enabled = true,
}: UseCalendarShortcutsOptions = {}) {
  const {
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    setNumberOfDays,
    clearSelection,
    toggleWeekends,
    toggleDeclinedEvents,
  } = useCalendar();

  /** Latest actions, read by the window listener */
  const actionsRef = React.useRef<ShortcutActions>({
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    setNumberOfDays,
    clearSelection,
    toggleWeekends,
    toggleDeclinedEvents,
  });

  React.useEffect(() => {
    actionsRef.current = {
      goToToday,
      goToPrev,
      goToNext,
      switchView,
      setNumberOfDays,
      clearSelection,
      toggleWeekends,
      toggleDeclinedEvents,
    };
  }, [
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    setNumberOfDays,
    clearSelection,
    toggleWeekends,
    toggleDeclinedEvents,
  ]);

  React.useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      handleShortcut(e, actionsRef.current);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
