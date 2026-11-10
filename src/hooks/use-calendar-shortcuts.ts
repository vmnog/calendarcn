import * as React from "react";

import { useCalendar } from "@/components/calendar-provider";
import type { CalendarContextValue } from "@/components/calendar-types";

interface UseCalendarShortcutsOptions {
  /** Whether the shortcuts are active. Defaults to true */
  enabled?: boolean;
  /** Cmd+K / Ctrl+K, even from inside a text field: opens or closes a command menu */
  onToggleCommandMenu?: () => void;
  /** Cmd+/ (the Meta key, also on Windows and Linux): opens or closes the sidebar */
  onToggleSidebar?: () => void;
  /** /: opens or closes the context panel */
  onToggleContextPanel?: () => void;
  /** Shift+M: switches to the next theme */
  onCycleTheme?: () => void;
  /** Cmd+, / Ctrl+,, even from inside a text field: opens the settings */
  onOpenSettings?: () => void;
}

/** App actions some keys trigger. A key is claimed only when its action is given */
type AppShortcutActions = Omit<UseCalendarShortcutsOptions, "enabled">;

/** Calendar actions the shortcuts trigger */
type CalendarShortcutActions = Pick<
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

/** Everything the window listener reads */
type ShortcutActions = CalendarShortcutActions & AppShortcutActions;

/** Keys 2-9: show that many days */
const NUMBER_OF_DAYS_KEY = /^[2-9]$/;

/** Tags of the form fields that take key presses themselves */
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Whether a key press is typed into a field: an input, a textarea, a select or editable content (single-key shortcuts skip those) */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

/**
 * Handles the app's keys, before the calendar's. Returns whether one ran. One
 * that runs stops the event, so no later `keydown` listener also acts on it
 * (e.g. Shift+M, next to the calendar's M).
 */
function handleAppShortcut(
  e: KeyboardEvent,
  actions: AppShortcutActions,
): boolean {
  const run = (action: (() => void) | undefined) => {
    if (!action) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    action();
    return true;
  };
  const isCommand = e.metaKey || e.ctrlKey;

  if (isCommand && e.key === "k") return run(actions.onToggleCommandMenu);
  if (e.metaKey && e.key === "/") return run(actions.onToggleSidebar);
  if (isCommand && e.key === ",") return run(actions.onOpenSettings);

  // Single keys only from here: they'd be typed into a text field
  if (isTypingTarget(e.target)) return false;

  if (e.key === "/" && !isCommand && !e.altKey) {
    return run(actions.onToggleContextPanel);
  }
  if (e.key === "M" && e.shiftKey && !isCommand) {
    return run(actions.onCycleTheme);
  }
  return false;
}

/**
 * Handles one key press. Returns early on the first match, in the same
 * order the demo has always checked them.
 */
function handleShortcut(
  e: KeyboardEvent,
  actions: CalendarShortcutActions,
): void {
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

  // Single keys only: Cmd+K, Ctrl+D, Alt+ArrowLeft and the like belong to the
  // app and browser
  if (isCommand || e.altKey || isTypingTarget(e.target)) return;

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
 * Presses with Cmd, Ctrl or Alt are left alone, apart from those two.
 *
 * The live demo's app keys come on with their actions: Cmd+K
 * (`onToggleCommandMenu`), Cmd+/ (`onToggleSidebar`), / (`onToggleContextPanel`),
 * Shift+M (`onCycleTheme`) and Cmd+, (`onOpenSettings`). They're checked
 * first, and one that runs stops the event from reaching later listeners.
 *
 * Key presses in inputs, textareas, selects and editable content are ignored
 * (except Escape, Cmd+K and Cmd+,). The listener is added once on mount, so
 * its position among other `window` keydown listeners stays fixed: any other
 * app shortcut that shares a key should be handled by a listener added before
 * this hook's, and call `event.stopImmediatePropagation()`.
 */
export function useCalendarShortcuts({
  enabled = true,
  onToggleCommandMenu,
  onToggleSidebar,
  onToggleContextPanel,
  onCycleTheme,
  onOpenSettings,
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
    onToggleCommandMenu,
    onToggleSidebar,
    onToggleContextPanel,
    onCycleTheme,
    onOpenSettings,
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
      onToggleCommandMenu,
      onToggleSidebar,
      onToggleContextPanel,
      onCycleTheme,
      onOpenSettings,
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
    onToggleCommandMenu,
    onToggleSidebar,
    onToggleContextPanel,
    onCycleTheme,
    onOpenSettings,
  ]);

  React.useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (handleAppShortcut(e, actionsRef.current)) return;
      handleShortcut(e, actionsRef.current);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
