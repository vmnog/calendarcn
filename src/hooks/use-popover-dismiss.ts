"use client";

import * as React from "react";

import { isEventInsideCalendarPopover } from "@/components/calendar-popover-context";

/**
 * A trigger in the details whose popup is open: a menu, a select or a popover
 * in custom details. Radix and Base UI both set `aria-expanded` on it as soon
 * as the popup opens, before focus moves in.
 */
const OPEN_POPUP_TRIGGER_SELECTOR =
  '[aria-expanded="true"][aria-haspopup]:not([aria-haspopup="false"]), [aria-expanded="true"][role="combobox"]';

interface PopoverDismissOptions {
  /** The popover's panel */
  panelRef: React.RefObject<HTMLElement | null>;
  /** The element that toggles the popover itself; presses on it aren't outside */
  triggerRef?: React.RefObject<Element | null>;
  /** Called on Escape, before `onDismiss` */
  onEscape: () => void;
  onDismiss: () => void;
}

/** Spread on the panel, so the hook sees events from its React tree */
export interface PopoverDismissHandlers {
  onPointerDownCapture: (e: React.PointerEvent) => void;
  onFocusCapture: (e: React.FocusEvent) => void;
}

/**
 * Closes a popover the way a non-modal shadcn/ui popover does: on Escape, on
 * a press outside it and when focus moves outside it. Not outside: the panel
 * and everything in its React tree, including what it renders in portals (its
 * menus, a select's list in custom details); the trigger; and a layer opened
 * from the panel, which takes the press or the Escape for itself.
 *
 * On touch, a press outside closes the popover on the click that ends it, so
 * a scroll that starts outside doesn't.
 */
export function usePopoverDismiss({
  panelRef,
  triggerRef,
  onEscape,
  onDismiss,
}: PopoverDismissOptions): PopoverDismissHandlers {
  const onEscapeRef = React.useRef(onEscape);
  const onDismissRef = React.useRef(onDismiss);
  /**
   * The native pointerdown and focusin events that went through the panel's
   * React tree. The document listeners look their own event up here, which
   * holds however React's root sits: React's capture handlers run before
   * them whether React listens on a container (Vite) or on the document
   * itself (Next.js App Router).
   */
  const [insideEvents] = React.useState(() => new WeakSet<Event>());
  /**
   * The element last focused through the panel's React tree while outside
   * its DOM: focus is in a popup the details opened in a portal (a menu, a
   * select's list, or a popover opened from inside one of those).
   */
  const portalFocusRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    onEscapeRef.current = onEscape;
    onDismissRef.current = onDismiss;
  }, [onEscape, onDismiss]);

  React.useEffect(() => {
    /**
     * Whether a layer opened from the details is open: a trigger in the panel
     * says so, or focus sits in a popup the panel rendered in a portal. It
     * owns Escape and outside presses until it closes, the way stacked layers
     * behave in shadcn/ui. Layers opened anywhere else on the page don't
     * count.
     */
    function hasOpenLayer(): boolean {
      if (panelRef.current?.querySelector(OPEN_POPUP_TRIGGER_SELECTOR)) {
        return true;
      }
      const focused = portalFocusRef.current;
      return focused !== null && focused === document.activeElement;
    }

    function isOutside(e: Event): boolean {
      const target = e.target;
      if (!(target instanceof Node)) return false;
      if (insideEvents.has(e)) return false;
      if (triggerRef?.current?.contains(target)) return false;
      return !isEventInsideCalendarPopover(e);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || hasOpenLayer()) return;
      // Marks the Escape as taken, as Radix layers do: a Radix dialog the
      // calendar sits in then leaves it to the details and stays open
      e.preventDefault();
      onEscapeRef.current();
      onDismissRef.current();
    }

    /** On touch, the click that ends the press; a scroll never fires one */
    let pendingClick: (() => void) | null = null;
    function clearPendingClick() {
      if (!pendingClick) return;
      document.removeEventListener("click", pendingClick);
      pendingClick = null;
    }
    function dismissOnClick() {
      pendingClick = null;
      onDismissRef.current();
    }

    /**
     * Whether a layer opened from the panel was open when the press began.
     * Read before the layer's own listeners can close it: a Base UI menu
     * closes on a capture listener added after this one.
     */
    let layerOpenOnPress = false;
    function notePointerDown() {
      layerOpenOnPress = hasOpenLayer();
    }

    function handlePointerDown(e: PointerEvent) {
      if (layerOpenOnPress || !isOutside(e)) {
        // A press inside cancels a touch outside still waiting for its click
        clearPendingClick();
        return;
      }
      if (e.pointerType !== "touch") {
        onDismissRef.current();
        return;
      }
      clearPendingClick();
      pendingClick = dismissOnClick;
      document.addEventListener("click", dismissOnClick, { once: true });
    }

    function handleFocusIn(e: FocusEvent) {
      if (hasOpenLayer() || !isOutside(e)) return;
      // Focus on an element the panel sits in (the dialog it's portaled into,
      // after a press on a blank part of it) hasn't left the panel
      const panel = panelRef.current;
      if (panel && e.target instanceof Node && e.target.contains(panel)) return;
      onDismissRef.current();
    }

    // Escape is handled first, on the window's capture phase: before the
    // calendar's own key handlers, and before a dialog's on the document
    window.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", notePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    // Start listening for presses a tick later, so the press that opened the
    // popover doesn't close it
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", notePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown);
      clearPendingClick();
    };
  }, [panelRef, triggerRef, insideEvents]);

  return React.useMemo(
    () => ({
      onPointerDownCapture: (e: React.PointerEvent) => {
        insideEvents.add(e.nativeEvent);
      },
      onFocusCapture: (e: React.FocusEvent) => {
        insideEvents.add(e.nativeEvent);
        const panel = panelRef.current;
        const target = e.target;
        const inPortal =
          target instanceof Element &&
          panel !== null &&
          !panel.contains(target);
        portalFocusRef.current = inPortal ? target : null;
      },
    }),
    [insideEvents, panelRef],
  );
}
