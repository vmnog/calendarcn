"use client";

import * as React from "react";

import { isTypingTarget } from "@/hooks/use-calendar-shortcuts";
import { useToday } from "@/hooks/use-now";
import {
  useCalendar,
  useCalendarConfig,
  useCalendarNotice,
} from "@/components/calendar-provider";
import {
  DEFAULT_AVAILABILITY_DURATION,
  formatAvailabilityText,
  mergeAvailabilityRanges,
} from "@/lib/availability";
import { getViewerTimeZone } from "@/lib/time-zones";
import type {
  AvailabilityRange,
  SchedulingContextValue,
  SchedulingLinkKind,
  SchedulingPurpose,
} from "@/components/calendar-types";
import type {
  SchedulingProviderProps,
  UseSchedulingShortcutsOptions,
} from "@/components/week-view-types";

/** Toast after "Copy", as the calendar's own say what they put on the clipboard */
const COPIED_MESSAGE = "Availability copied to clipboard";

/** Toast when the browser refuses the clipboard (an insecure page, a denied permission) */
const COPY_FAILED_MESSAGE = "Couldn't copy to clipboard";

/** Notion Calendar's toast after a marked time is removed, with Undo */
const RANGE_DELETED_MESSAGE = "Time range deleted";

/** No marked times */
const NO_RANGES: AvailabilityRange[] = [];

/**
 * Keys that, with Cmd or Ctrl, change or select events in the calendar's
 * shortcuts: select all, cut, copy, paste, duplicate, undo and redo
 */
const EVENT_COMMAND_KEYS = new Set(["a", "x", "c", "v", "d", "z"]);

/**
 * Whether a key would change or select events through the calendar's
 * shortcuts: Delete, Backspace, or Cmd/Ctrl with A, X, C, V, D or Z.
 * While times are marked, events stay as they are, so these keys go no
 * further than scheduling's listener.
 */
function isEventKey(e: KeyboardEvent): boolean {
  if (e.altKey) return false;
  if (e.metaKey || e.ctrlKey) {
    return EVENT_COMMAND_KEYS.has(e.key.toLowerCase());
  }
  return e.key === "Delete" || e.key === "Backspace";
}

const SchedulingContext = React.createContext<SchedulingContextValue | null>(
  null,
);

/** Puts text on the clipboard. Resolves to false when the browser refuses */
async function writeClipboardText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The marked time of `ranges` that covers `range`: where a time just added
 * or moved ended up after merging
 */
function findCoveringRange(
  ranges: AvailabilityRange[],
  range: Omit<AvailabilityRange, "id">,
): AvailabilityRange | undefined {
  return ranges.find(
    (candidate) => candidate.start <= range.start && candidate.end >= range.end,
  );
}

/**
 * Notion Calendar's scheduling: marking open times on the day and week
 * views and copying them as text, and scheduling links your app creates.
 * Holds the marked times while they're picked; nothing it does changes the
 * events. Goes inside `CalendarProvider`, around the views and sidebars:
 * `TimeGrid` draws the marked times, `DetailsSidebar` shows the scheduling
 * panel, `CalendarSidebar` the Scheduling row, all through `useScheduling()`.
 */
export function SchedulingProvider({
  onCreateSchedulingLink,
  defaultDurationMinutes = DEFAULT_AVAILABILITY_DURATION,
  children,
}: SchedulingProviderProps) {
  const { view, switchView, clearSelection } = useCalendar();
  const { hourCycle, locale } = useCalendarConfig();
  const { showNotice } = useCalendarNotice();
  // `null` on the server and during hydration, when nothing is marked yet
  const today = useToday();

  /** Latest `onCreateSchedulingLink`, read when a link is asked for */
  const onCreateSchedulingLinkRef = React.useRef(onCreateSchedulingLink);
  /** Whether times are marked right now: an Undo after leaving does nothing */
  const isPickingRef = React.useRef(false);
  /** Counts up to give every marked time its own id */
  const nextRangeIdRef = React.useRef(0);

  const [isPicking, setIsPicking] = React.useState(false);
  const [purpose, setPurpose] = React.useState<SchedulingPurpose>("share");
  const [ranges, setRanges] = React.useState<AvailabilityRange[]>(NO_RANGES);
  const [selectedRangeId, setSelectedRangeId] = React.useState<string | null>(
    null,
  );
  const [durationMinutes, setDurationMinutes] = React.useState(
    defaultDurationMinutes,
  );

  React.useEffect(() => {
    onCreateSchedulingLinkRef.current = onCreateSchedulingLink;
  }, [onCreateSchedulingLink]);

  React.useEffect(() => {
    isPickingRef.current = isPicking;
  }, [isPicking]);

  const text = React.useMemo(
    () =>
      formatAvailabilityText(ranges, {
        durationMinutes,
        hourCycle,
        locale,
        now: today ?? undefined,
      }),
    [ranges, durationMinutes, hourCycle, locale, today],
  );

  const startPicking = React.useCallback(
    (nextPurpose: SchedulingPurpose = "share") => {
      clearSelection();
      // Times are marked on the hour grid
      if (view !== "day" && view !== "week") switchView("week");
      setRanges(NO_RANGES);
      setSelectedRangeId(null);
      setPurpose(nextPurpose);
      setIsPicking(true);
    },
    [clearSelection, view, switchView],
  );

  const cancelPicking = React.useCallback(() => {
    // Leave no event selected, as starting does: one picked while marking
    // (by a command, say) would come out selected for a later Delete
    clearSelection();
    setIsPicking(false);
    setRanges(NO_RANGES);
    setSelectedRangeId(null);
  }, [clearSelection]);

  const addRange = React.useCallback(
    (range: Omit<AvailabilityRange, "id">) => {
      nextRangeIdRef.current += 1;
      const added = { ...range, id: `availability-${nextRangeIdRef.current}` };
      const next = mergeAvailabilityRanges([...ranges, added]);
      setRanges(next);
      setSelectedRangeId(findCoveringRange(next, range)?.id ?? null);
    },
    [ranges],
  );

  const updateRange = React.useCallback(
    (range: AvailabilityRange) => {
      const next = mergeAvailabilityRanges(
        ranges.map((current) => (current.id === range.id ? range : current)),
      );
      setRanges(next);
      setSelectedRangeId(findCoveringRange(next, range)?.id ?? null);
    },
    [ranges],
  );

  const removeRange = React.useCallback(
    (id: string) => {
      const removed = ranges.find((range) => range.id === id);
      if (!removed) return;
      setRanges(ranges.filter((range) => range.id !== id));
      setSelectedRangeId((selected) => (selected === id ? null : selected));
      showNotice({
        message: RANGE_DELETED_MESSAGE,
        onUndo: () => {
          if (!isPickingRef.current) return;
          setRanges((current) =>
            mergeAvailabilityRanges([...current, removed]),
          );
        },
      });
    },
    [ranges, showNotice],
  );

  const copyText = React.useCallback(async () => {
    if (!text) return false;
    const copied = await writeClipboardText(text);
    showNotice({ message: copied ? COPIED_MESSAGE : COPY_FAILED_MESSAGE });
    return copied;
  }, [text, showNotice]);

  const copyAndFinish = React.useCallback(async () => {
    if (await copyText()) cancelPicking();
  }, [copyText, cancelPicking]);

  const createSchedulingLink = React.useCallback(
    (kind: SchedulingLinkKind) => {
      const onCreate = onCreateSchedulingLinkRef.current;
      if (!onCreate) return;
      if (kind === "one-off") {
        startPicking("one-off-link");
        return;
      }
      onCreate({
        kind,
        durationMinutes,
        ranges: NO_RANGES,
        timeZone: getViewerTimeZone(),
      });
    },
    [startPicking, durationMinutes],
  );

  const finishSchedulingLink = React.useCallback(() => {
    onCreateSchedulingLinkRef.current?.({
      kind: "one-off",
      durationMinutes,
      ranges: mergeAvailabilityRanges(ranges),
      timeZone: getViewerTimeZone(),
    });
    cancelPicking();
  }, [durationMinutes, ranges, cancelPicking]);

  const canCreateLinks = onCreateSchedulingLink !== undefined;

  const value = React.useMemo<SchedulingContextValue>(
    () => ({
      isPicking,
      purpose,
      ranges,
      selectedRangeId,
      durationMinutes,
      text,
      canCreateLinks,
      startPicking,
      cancelPicking,
      addRange,
      updateRange,
      removeRange,
      selectRange: setSelectedRangeId,
      setDurationMinutes,
      copyText,
      copyAndFinish,
      createSchedulingLink,
      finishSchedulingLink,
    }),
    [
      isPicking,
      purpose,
      ranges,
      selectedRangeId,
      durationMinutes,
      text,
      canCreateLinks,
      startPicking,
      cancelPicking,
      addRange,
      updateRange,
      removeRange,
      copyText,
      copyAndFinish,
      createSchedulingLink,
      finishSchedulingLink,
    ],
  );

  return (
    <SchedulingContext.Provider value={value}>
      {children}
    </SchedulingContext.Provider>
  );
}

/**
 * The scheduling state of the nearest `SchedulingProvider`, or `null`
 * outside one: the components that read it leave scheduling out then.
 */
export function useScheduling(): SchedulingContextValue | null {
  return React.useContext(SchedulingContext);
}

/**
 * Scheduling's keys, listening on `window`: S starts marking open times
 * (Notion Calendar's key for a one-off link), and while times are marked,
 * Escape leaves without changes and Delete or Backspace removes the
 * selected time. Call it before `useCalendarShortcuts()`, in a component
 * inside `SchedulingProvider`: a key it handles doesn't reach the calendar's
 * (Escape then doesn't also clear the selection). While times are marked,
 * the calendar's keys that change or select events (Delete, Cmd+A, Cmd+X,
 * Cmd+C, Cmd+V, Cmd+D, Cmd+Z) don't reach it either, so nothing changes
 * under the hatch; Cmd+C and Cmd+X still copy and cut selected text. S
 * skips text fields and presses with Cmd, Ctrl or Alt; a menu or dialog that
 * closes on Escape keeps the Escape.
 */
export function useSchedulingShortcuts({
  enabled = true,
}: UseSchedulingShortcutsOptions = {}) {
  const scheduling = useScheduling();
  /** Latest scheduling state, read by the window listener */
  const schedulingRef = React.useRef(scheduling);

  React.useEffect(() => {
    schedulingRef.current = scheduling;
  }, [scheduling]);

  React.useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = schedulingRef.current;
      if (!current || e.defaultPrevented) return;
      const run = (action: () => void) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        action();
      };

      if (current.isPicking && e.key === "Escape") {
        run(current.cancelPicking);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (current.isPicking && isEventKey(e)) {
        const { selectedRangeId } = current;
        const isCommand = e.metaKey || e.ctrlKey;
        if (!isCommand && selectedRangeId) {
          run(() => current.removeRange(selectedRangeId));
          return;
        }
        // Copying or cutting text selected on the page still works
        const key = e.key.toLowerCase();
        if (isCommand && (key === "c" || key === "x")) {
          e.stopImmediatePropagation();
          return;
        }
        run(() => {});
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!current.isPicking && (e.key === "s" || e.key === "S")) {
        run(() => current.startPicking());
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled]);
}
