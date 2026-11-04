"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react-dom";
import type { Placement } from "@floating-ui/react-dom";
import { PanelRightIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { focusEventElement } from "@/hooks/use-event-keyboard";
import { Button } from "@/components/ui/button";
import { EventDetailPanel } from "./event-detail-panel";
import {
  isEventInsideCalendarPopover,
  isInsideCalendarPopover,
  useCalendarPopoverBoundary,
} from "./calendar-popover-context";
import { useCalendarRenderSlots } from "./calendar-provider";
import { useEventTitleFocus } from "./event-title-focus-context";
import type { CalendarEvent, EventPopoverAnchor } from "./week-view-types";

/** Gap between the anchor and the popover, in px */
const POPOVER_SIDE_OFFSET = 8;

/** Collision padding on the bottom, left and right edges, in px */
const POPOVER_COLLISION_PADDING = { bottom: 8, left: 16, right: 16 };

/**
 * A menu, listbox or dialog opened from the details — the event type menu,
 * a select or a popover in custom details — owns Escape and outside presses
 * until it closes, the way stacked layers behave in shadcn/ui. Its content
 * has focus while it is open, in both the Radix and the Base UI styles.
 */
function isLayerOpen(panel: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!(active instanceof Element)) return false;
  const layer = active.closest(
    '[role="menu"], [role="listbox"], [role="dialog"]',
  );
  return layer !== null && layer !== panel;
}

interface DismissOptions {
  panelRef: React.RefObject<HTMLElement | null>;
  triggerRef?: React.RefObject<Element | null>;
  onEscape: () => void;
  onDismiss: () => void;
}

/** Handlers for the panel element, so the hook sees presses in its React tree */
interface DismissHandlers {
  onPointerDownCapture: () => void;
  onFocusCapture: () => void;
}

/**
 * Closes the popover the way a non-modal shadcn/ui popover does: on Escape,
 * on a press outside it and when focus moves outside it. Not outside: the
 * details and everything in their React tree, including what they render in
 * portals (their menus, a select's list in custom details); the trigger,
 * which toggles the popover itself; and a layer open above the details,
 * which takes the press or the Escape for itself.
 */
function useDismiss({
  panelRef,
  triggerRef,
  onEscape,
  onDismiss,
}: DismissOptions): DismissHandlers {
  const onEscapeRef = React.useRef(onEscape);
  const onDismissRef = React.useRef(onDismiss);
  /**
   * Set by the panel's React capture handlers, which run before the document
   * listeners below (React listens on its root, under the document), and
   * reset by those listeners' capture-phase twins, which run before React.
   */
  const pointerInsideRef = React.useRef(false);
  const focusInsideRef = React.useRef(false);

  React.useEffect(() => {
    onEscapeRef.current = onEscape;
    onDismissRef.current = onDismiss;
  }, [onEscape, onDismiss]);

  React.useEffect(() => {
    function isOutside(e: Event): boolean {
      const target = e.target;
      if (!(target instanceof Node)) return false;
      if (triggerRef?.current?.contains(target)) return false;
      return !isEventInsideCalendarPopover(e);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || isLayerOpen(panelRef.current)) return;
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
     * Whether a layer above the details was open when the press began. Read
     * before any library's own listener: a Base UI menu closes on a capture
     * listener, so by the bubble phase it is gone and focus is back in the
     * details.
     */
    let layerOpenOnPress = false;
    function beginPointerDown() {
      pointerInsideRef.current = false;
      layerOpenOnPress = isLayerOpen(panelRef.current);
    }

    function handlePointerDown(e: PointerEvent) {
      if (pointerInsideRef.current || layerOpenOnPress || !isOutside(e)) {
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

    function beginFocusIn() {
      focusInsideRef.current = false;
    }

    function handleFocusIn(e: FocusEvent) {
      if (focusInsideRef.current || isLayerOpen(panelRef.current)) return;
      if (!isOutside(e)) return;
      onDismissRef.current();
    }

    // Escape is handled before it reaches the calendar's own key handlers
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", beginPointerDown, true);
    document.addEventListener("focusin", beginFocusIn, true);
    document.addEventListener("focusin", handleFocusIn);
    // Start listening for presses a tick later, so the press that opened the
    // popover doesn't close it
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", beginPointerDown, true);
      document.removeEventListener("focusin", beginFocusIn, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handlePointerDown);
      clearPendingClick();
    };
  }, [panelRef, triggerRef]);

  return React.useMemo(
    () => ({
      onPointerDownCapture: () => {
        pointerInsideRef.current = true;
      },
      onFocusCapture: () => {
        focusInsideRef.current = true;
      },
    }),
    [],
  );
}

interface EventDetailPopoverProps {
  event: CalendarEvent;
  /** What the popover is placed beside */
  anchor: EventPopoverAnchor;
  /**
   * The element that toggles the popover (the event itself). Presses and
   * focus on it don't close the popover, since its own click does.
   */
  triggerRef?: React.RefObject<Element | null>;
  onEventChange?: (event: CalendarEvent) => void;
  onClose: () => void;
  /** Callback for the expand button (e.g. dock to a side panel). Hidden when absent. */
  onExpand?: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  /** Which side to prefer for the popover. Defaults to "right". */
  side?: "right" | "bottom" | "left" | "top";
  /** Alignment along the side axis. Defaults to "center". */
  align?: "start" | "center" | "end";
  /**
   * Override the top collision padding. When omitted the header height is
   * used so the popover never overlaps the weekday header. All-day events
   * live *inside* the header, so they pass a small value to avoid being
   * pushed off-screen.
   */
  collisionPaddingTop?: number;
}

/**
 * The event details in a popover beside `anchor`. It renders its own
 * floating layer instead of the shadcn/ui Popover, so it works the same
 * with the Radix and the Base UI styles.
 */
export function EventDetailPopover({
  event,
  anchor,
  triggerRef,
  onEventChange,
  onClose,
  onExpand,
  onPrevWeek,
  onNextWeek,
  side = "right",
  align = "center",
  collisionPaddingTop,
}: EventDetailPopoverProps) {
  const { boundary, headerHeight, view } = useCalendarPopoverBoundary();
  const { pendingEventId, clearPending } = useEventTitleFocus();
  const { renderEventDetails } = useCalendarRenderSlots();
  const panelRef = React.useRef<HTMLDivElement>(null);
  /** Just created by click-to-create: its title should be focused */
  const isNew = pendingEventId === event.id;

  /**
   * In day view the event trigger spans the full grid width, leaving no room
   * for a 320px popover on either side within the calendar container.
   * Skip the collision boundary so the popover stays within the viewport.
   */
  const isDayView = view === "day";
  const collisionBoundary = !isDayView && boundary ? [boundary] : [];
  const detectOverflowOptions = {
    padding: {
      top: collisionPaddingTop ?? headerHeight,
      ...POPOVER_COLLISION_PADDING,
    },
    boundary: collisionBoundary,
    altBoundary: collisionBoundary.length > 0,
  };
  const placement: Placement = align === "center" ? side : `${side}-${align}`;

  const {
    refs,
    floatingStyles,
    isPositioned,
    placement: placedAt,
  } = useFloating({
    open: true,
    placement,
    strategy: "fixed",
    // left/top rather than a transform: the enter animation animates the
    // transform, and would slide the panel in from the viewport's corner
    transform: false,
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(POPOVER_SIDE_OFFSET),
      shift({
        mainAxis: true,
        crossAxis: false,
        limiter: limitShift(),
        ...detectOverflowOptions,
      }),
      flip(detectOverflowOptions),
    ],
  });

  // After every render: a ref object keeps its identity when its element
  // changes, and floating-ui ignores a reference it already has
  React.useLayoutEffect(() => {
    refs.setReference("current" in anchor ? anchor.current : anchor);
  });

  const setPanel = React.useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      refs.setFloating(node);
    },
    [refs],
  );

  /**
   * Escape closes the popover before the keydown reaches the event. If focus
   * was on the event or in the details (which unmount and drop it), put it
   * back on the event once that has happened.
   */
  const handleEscapeKeyDown = React.useCallback(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const hadFocus =
      active.dataset.eventId === event.id || isInsideCalendarPopover(active);
    if (!hadFocus) return;
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) {
        return;
      }
      focusEventElement(boundary, event.id);
    });
  }, [boundary, event.id]);

  const dismissHandlers = useDismiss({
    panelRef,
    triggerRef,
    onEscape: handleEscapeKeyDown,
    onDismiss: onClose,
  });

  // Custom details get `isNew` for one render; the default panel clears the
  // request itself once it has focused the title
  React.useEffect(() => {
    if (!renderEventDetails || !isNew) return;
    clearPending();
  }, [renderEventDetails, isNew, clearPending]);

  const popoverHeaderActions = (
    <>
      {onExpand && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-[#C7C5C1] dark:text-[#595959]"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          title="Dock to sidebar"
        >
          <PanelRightIcon className="size-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-[#C7C5C1] dark:text-[#595959]"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Close"
      >
        <X className="size-4" />
      </Button>
    </>
  );

  return createPortal(
    <div
      ref={setPanel}
      role="dialog"
      aria-label="Event details"
      data-calendar-popover=""
      data-side={placedAt.split("-")[0]}
      tabIndex={-1}
      // The views' own click handlers never see a press in the details, or in
      // anything the details render in a portal
      onClick={(e) => e.stopPropagation()}
      {...dismissHandlers}
      // Off-screen until placed, but still focusable for the new event's title
      style={
        isPositioned
          ? floatingStyles
          : { ...floatingStyles, transform: "translate(0, -200%)" }
      }
      className={cn(
        "z-50 w-[320px] max-h-[80vh] overflow-y-auto rounded-lg border bg-popover/60 text-popover-foreground shadow-lg outline-hidden backdrop-blur-xl",
        "animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      )}
    >
      {renderEventDetails ? (
        renderEventDetails({ event, close: onClose, isNew })
      ) : (
        <EventDetailPanel
          event={event}
          onEventChange={onEventChange}
          onPrevWeek={onPrevWeek}
          onNextWeek={onNextWeek}
          headerActions={popoverHeaderActions}
          autoFocusTitle={isNew}
          onTitleAutoFocused={clearPending}
        />
      )}
    </div>,
    document.body,
  );
}
