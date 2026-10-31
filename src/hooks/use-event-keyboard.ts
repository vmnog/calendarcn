"use client";

import { useCallback } from "react";

import { useCalendar, useCalendarConfig } from "@/components/calendar-provider";
import { getKeyboardEventChange } from "@/lib/event-utils";

interface UseEventKeyboardOptions {
  /** Element holding the view's events; focus is put back on an event inside it */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Vertically scrolling element, kept scrolled to the focused event */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Whether a day is on screen; a keyboard move off screen calls `revealDay` */
  isDayVisible: (date: Date) => boolean;
  /** Navigates the view so the day is on screen */
  revealDay: (date: Date) => void;
}

/** Arrow keys that, with Alt, move (or with Alt+Shift, resize) the focused event */
const EVENT_MOVE_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

/**
 * Keys that select, open or close the focused event. Opening or closing its
 * popover can re-create the event's element, so focus is put back on it.
 */
const FOCUS_KEEPING_KEYS = new Set(["Enter", " ", "Escape"]);

/**
 * Focuses the event's element inside `container` and returns it, or `null`
 * when none takes focus. Inert (off-screen buffer) copies refuse focus, so
 * each match is tried in turn.
 */
export function focusEventElement(
  container: HTMLElement | null,
  eventId: string,
): HTMLElement | null {
  if (!container) return null;
  const candidates = container.querySelectorAll<HTMLElement>(
    `[data-event-id="${CSS.escape(eventId)}"]`,
  );
  for (const candidate of candidates) {
    candidate.focus({ preventScroll: true });
    if (document.activeElement === candidate) return candidate;
  }
  return null;
}

/** Scrolls `scroller` vertically just enough to show `element` */
function keepInView(element: HTMLElement, scroller: HTMLElement | null) {
  if (!scroller) return;
  const elementRect = element.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  if (elementRect.top < scrollerRect.top) {
    scroller.scrollTop -= scrollerRect.top - elementRect.top;
    return;
  }
  if (elementRect.bottom > scrollerRect.bottom) {
    scroller.scrollTop += elementRect.bottom - scrollerRect.bottom;
  }
}

/**
 * Keyboard editing for a view's events, as a keydown handler for the view's
 * root. On a focused event (an element with `data-event-id`):
 *
 * - Alt+ArrowLeft/Right moves it a day; Alt+ArrowUp/Down moves it one
 *   `snapMinutes` step (a week in month view); Alt+Shift+ArrowUp/Down
 *   resizes its end (see `getKeyboardEventChange`)
 * - Enter, Space and Escape keep focus on it while its popover opens or closes
 *
 * Handled keys don't reach the calendar shortcuts (where arrows change the
 * period) or the browser (where Alt+Arrow navigates history).
 */
export function useEventKeyboard({
  containerRef,
  scrollContainerRef,
  isDayVisible,
  revealDay,
}: UseEventKeyboardOptions): (e: React.KeyboardEvent<HTMLElement>) => void {
  const { events, view, updateEvent } = useCalendar();
  const config = useCalendarConfig();

  /**
   * After React re-renders, focuses the event's element again if focus was
   * lost (its element was re-created), and keeps it scrolled into view.
   * Focus that moved somewhere else on purpose is left alone. (Escape with
   * the popover open is handled by the popover: it closes first.)
   */
  const restoreFocus = useCallback(
    (eventId: string) => {
      requestAnimationFrame(() => {
        const container = containerRef.current;
        if (!container) return;
        const scroller = scrollContainerRef?.current ?? null;

        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          active.dataset.eventId === eventId
        ) {
          keepInView(active, scroller);
          return;
        }
        if (active && active !== document.body) return;

        const focused = focusEventElement(container, eventId);
        if (focused) keepInView(focused, scroller);
      });
    },
    [containerRef, scrollContainerRef],
  );

  return useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!(e.target instanceof HTMLElement)) return;
      const eventId =
        e.target.closest<HTMLElement>("[data-event-id]")?.dataset.eventId;
      if (!eventId) return;

      if (FOCUS_KEEPING_KEYS.has(e.key)) {
        restoreFocus(eventId);
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (!EVENT_MOVE_KEYS.has(e.key)) return;

      e.preventDefault();
      e.stopPropagation();

      const event = events.find((ev) => ev.id === eventId);
      if (!event) return;
      const changed = getKeyboardEventChange(
        event,
        e.key,
        e.shiftKey,
        view,
        config,
      );
      if (!changed) return;

      updateEvent(changed);
      if (!isDayVisible(changed.start)) revealDay(changed.start);
      restoreFocus(eventId);
    },
    [events, view, config, updateEvent, isDayVisible, revealDay, restoreFocus],
  );
}
