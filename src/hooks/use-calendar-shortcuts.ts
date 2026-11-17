import * as React from "react";

import {
  useCalendar,
  useCalendarEventActions,
} from "@/components/calendar-provider";
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
  /** .: opens Go to date (the demo's command menu, on its date field) */
  onGoToDate?: () => void;
  /** ?: shows the full keyboard shortcut list */
  onShowShortcuts?: () => void;
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
  | "addEventAtNextSlot"
>;

/** Event actions the event keys run, and what says whether each has something to act on */
type EditShortcutActions = Pick<
  CalendarContextValue,
  | "deleteEvent"
  | "duplicateEvent"
  | "copyEvent"
  | "cutEvent"
  | "pasteEvent"
  | "undo"
  | "redo"
  | "canUndo"
  | "canRedo"
> & {
  /** The selected event's id, or `null` when none (or a missing one) is selected */
  selectedEventId: string | null;
  /** Whether a cut or copied event waits to be pasted */
  hasCopiedEvent: boolean;
};

/** Everything the window listener reads */
type ShortcutActions = CalendarShortcutActions &
  EditShortcutActions &
  AppShortcutActions;

/** Keys 2-9: show that many days */
const NUMBER_OF_DAYS_KEY = /^[2-9]$/;

/** Tags of the form fields that take key presses themselves */
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** Whether a key press is typed into a field: an input, a textarea, a select or editable content (single-key shortcuts skip those) */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return TYPING_TAGS.has(target.tagName) || target.isContentEditable;
}

/** Whether a key press is part of an IME composition (Safari reports keyCode 229 with `isComposing` already false) */
function isComposingKey(e: KeyboardEvent): boolean {
  return e.isComposing || e.keyCode === 229;
}

/** Whether text is selected on the page, which Cmd+C and Cmd+X then copy or cut instead */
function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed;
}

/**
 * Handles the keys that change events: Delete and Backspace, Cmd+X, Cmd+C
 * and Cmd+D on the selected event, Cmd+V, Cmd+Z and Shift+Cmd+Z (Ctrl on
 * Windows and Linux). Returns whether one ran. A key with nothing to act on
 * (no selected event, nothing to paste, undo or redo) is left to the
 * browser, and so is every key typed into a field, during an IME
 * composition, with Alt, or (Cmd+C, Cmd+X) with text selected on the page.
 */
function handleEditShortcut(
  e: KeyboardEvent,
  actions: EditShortcutActions,
): boolean {
  if (e.altKey || isComposingKey(e) || isTypingTarget(e.target)) return false;
  const run = (action: () => void) => {
    e.preventDefault();
    action();
    return true;
  };
  const isCommand = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  const { selectedEventId } = actions;

  if (isCommand && key === "z") {
    if (e.shiftKey) return actions.canRedo && run(actions.redo);
    return actions.canUndo && run(actions.undo);
  }
  if (isCommand && !e.shiftKey && key === "v") {
    return actions.hasCopiedEvent && run(actions.pasteEvent);
  }
  if (!selectedEventId) return false;
  if (!isCommand && (e.key === "Delete" || e.key === "Backspace")) {
    return run(() => actions.deleteEvent(selectedEventId));
  }
  if (!isCommand || e.shiftKey) return false;
  if (key === "d") return run(() => actions.duplicateEvent(selectedEventId));
  // With text selected, Cmd+C and Cmd+X copy or cut the text
  if (hasTextSelection()) return false;
  if (key === "c") return run(() => actions.copyEvent(selectedEventId));
  if (key === "x") return run(() => actions.cutEvent(selectedEventId));
  return false;
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
  if (e.key === "." && !isCommand && !e.altKey) {
    return run(actions.onGoToDate);
  }
  if (e.key === "?" && !isCommand && !e.altKey) {
    return run(actions.onShowShortcuts);
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

  // Shift+Cmd+E (Ctrl on Windows and Linux) toggles weekends, even from
  // inside a text field
  if (isCommand && e.shiftKey && key === "e") {
    e.preventDefault();
    actions.toggleWeekends();
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

  if (e.key === "y" || e.key === "Y") {
    e.preventDefault();
    actions.switchView("year");
    return;
  }

  if (e.key === "c" || e.key === "C") {
    e.preventDefault();
    actions.addEventAtNextSlot();
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
 * - D or 1: day view, W or 0: week view, M: month view, Y: year view, A: agenda
 * - 2-9: number of days
 * - C: create an event at the next half hour (`addEventAtNextSlot`)
 * - Escape: clear the selection
 * - Delete / Backspace: delete the selected event
 * - Cmd+X, Cmd+C, Cmd+D: cut, copy, duplicate the selected event; Cmd+V:
 *   paste it at the slot under the mouse (Ctrl on Windows and Linux)
 * - Cmd+Z / Shift+Cmd+Z: undo / redo
 * - Shift+Cmd+E (Ctrl on Windows and Linux): show or hide weekends
 *
 * Other presses with Cmd, Ctrl or Alt are left alone, and an event key with
 * nothing to act on is too.
 *
 * The live demo's app keys come on with their actions: Cmd+K
 * (`onToggleCommandMenu`), Cmd+/ (`onToggleSidebar`), / (`onToggleContextPanel`),
 * Shift+M (`onCycleTheme`), Cmd+, (`onOpenSettings`), . (`onGoToDate`) and ?
 * (`onShowShortcuts`). They're checked
 * first, and one that runs stops the event from reaching later listeners.
 *
 * Key presses in inputs, textareas, selects and editable content are ignored
 * (except Escape, Cmd+K and Cmd+,), and the event keys also during an IME
 * composition. The listener is added once on mount, so
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
  onGoToDate,
  onShowShortcuts,
}: UseCalendarShortcutsOptions = {}) {
  const {
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    setNumberOfDays,
    clearSelection,
    toggleWeekends,
    addEventAtNextSlot,
    selectedEvent,
    deleteEvent,
    duplicateEvent,
    copyEvent,
    cutEvent,
    pasteEvent,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCalendar();
  const eventActions = useCalendarEventActions();
  const selectedEventId = selectedEvent?.id ?? null;
  const hasCopiedEvent = eventActions?.hasCopiedEvent ?? false;

  /** Latest actions, read by the window listener */
  const actionsRef = React.useRef<ShortcutActions>({
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    setNumberOfDays,
    clearSelection,
    toggleWeekends,
    addEventAtNextSlot,
    selectedEventId,
    hasCopiedEvent,
    deleteEvent,
    duplicateEvent,
    copyEvent,
    cutEvent,
    pasteEvent,
    undo,
    redo,
    canUndo,
    canRedo,
    onToggleCommandMenu,
    onToggleSidebar,
    onToggleContextPanel,
    onCycleTheme,
    onOpenSettings,
    onGoToDate,
    onShowShortcuts,
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
      addEventAtNextSlot,
      selectedEventId,
      hasCopiedEvent,
      deleteEvent,
      duplicateEvent,
      copyEvent,
      cutEvent,
      pasteEvent,
      undo,
      redo,
      canUndo,
      canRedo,
      onToggleCommandMenu,
      onToggleSidebar,
      onToggleContextPanel,
      onCycleTheme,
      onOpenSettings,
      onGoToDate,
      onShowShortcuts,
    };
  }, [
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    setNumberOfDays,
    clearSelection,
    toggleWeekends,
    addEventAtNextSlot,
    selectedEventId,
    hasCopiedEvent,
    deleteEvent,
    duplicateEvent,
    copyEvent,
    cutEvent,
    pasteEvent,
    undo,
    redo,
    canUndo,
    canRedo,
    onToggleCommandMenu,
    onToggleSidebar,
    onToggleContextPanel,
    onCycleTheme,
    onOpenSettings,
    onGoToDate,
    onShowShortcuts,
  ]);

  React.useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (handleAppShortcut(e, actionsRef.current)) return;
      if (handleEditShortcut(e, actionsRef.current)) return;
      handleShortcut(e, actionsRef.current);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
