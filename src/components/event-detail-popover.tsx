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
import { usePopoverDismiss } from "@/hooks/use-popover-dismiss";
import { Button } from "@/components/ui/button";
import { EventDetailPanel } from "./event-detail-panel";
import {
  isInsideCalendarPopover,
  useCalendarPopoverBoundary,
} from "./calendar-popover-context";
import { useCalendarRenderSlots, useCalendarSeries } from "./calendar-provider";
import { useEventTitleFocus } from "./event-title-focus-context";
import type { CalendarEvent, EventPopoverAnchor } from "./week-view-types";

/** Gap between the anchor and the popover, in px */
const POPOVER_SIDE_OFFSET = 8;

/** Collision padding on the bottom, left and right edges, in px */
const POPOVER_COLLISION_PADDING = { bottom: 8, left: 16, right: 16 };

/** Elements of the panel that Tab can reach, in order */
function getTabbables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>("*")).filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.hidden &&
      !(el as HTMLButtonElement).disabled &&
      !(el instanceof HTMLInputElement && el.type === "hidden") &&
      el.getClientRects().length > 0 &&
      getComputedStyle(el).visibility !== "hidden",
  );
}

/**
 * Tab and Shift+Tab cycle inside the details, as Radix's non-modal popover
 * content does with a looping (not trapping) focus scope: Tab on the last
 * control moves to the first, Shift+Tab on the first moves to the last. From
 * the panel itself (focused by a press on a blank part of it), Tab enters at
 * the first control and Shift+Tab at the last.
 */
function loopFocus(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.defaultPrevented) return;
  const panel = e.currentTarget;
  const tabbables = getTabbables(panel);
  const first = tabbables[0];
  const last = tabbables[tabbables.length - 1];
  const active = document.activeElement;
  if (!first || !last) {
    if (active === panel) e.preventDefault();
    return;
  }
  const edge = e.shiftKey ? first : last;
  if (active !== edge && active !== panel) return;
  const next = e.shiftKey ? last : first;
  e.preventDefault();
  next.focus({ preventScroll: true });
  if (next instanceof HTMLInputElement) next.select();
}

/**
 * The transform origin for each placement: the panel grows out of the side
 * and corner that face its anchor.
 */
const TRANSFORM_ORIGIN_BY_PLACEMENT: Record<Placement, string> = {
  top: "center bottom",
  "top-start": "left bottom",
  "top-end": "right bottom",
  bottom: "center top",
  "bottom-start": "left top",
  "bottom-end": "right top",
  left: "right center",
  "left-start": "right top",
  "left-end": "right bottom",
  right: "left center",
  "right-start": "left top",
  "right-end": "left bottom",
};

interface EventDetailPopoverProps {
  event: CalendarEvent;
  /** The panel's id, for the trigger's `aria-controls` */
  id?: string;
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
  id,
  anchor,
  triggerRef,
  onEventChange,
  onClose,
  onExpand,
  side = "right",
  align = "center",
  collisionPaddingTop,
}: EventDetailPopoverProps) {
  const { boundary, headerHeight, view } = useCalendarPopoverBoundary();
  const { pendingEventId, clearPending } = useEventTitleFocus();
  const { renderEventDetails } = useCalendarRenderSlots();
  const series = useCalendarSeries();
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

  const dismissHandlers = usePopoverDismiss({
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

  // The provider works out the selected event's series neighbors; the
  // arrows are disabled at the series' ends
  const isSeriesEvent = series.eventId === event.id;
  const previousInSeries = isSeriesEvent ? series.previousInSeries : null;
  const nextInSeries = isSeriesEvent ? series.nextInSeries : null;

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

  // The provider measures its boundary after it mounts. Until then there is
  // nothing to place the panel against, and no way to tell whether the
  // calendar sits in a dialog: rendering once that is known keeps the panel
  // in one container, rather than moving it (and remounting it) a render later
  if (!boundary) return null;

  /**
   * Inside a dialog (or a sheet or drawer), the panel goes into that dialog
   * rather than the body: a modal dialog keeps focus inside its own element
   * and turns off pointer events on the rest of the page.
   */
  const portalContainer =
    boundary.closest<HTMLElement>('[role="dialog"], [role="alertdialog"]') ??
    document.body;

  return createPortal(
    <div
      ref={setPanel}
      id={id}
      role="dialog"
      aria-label="Event details"
      data-calendar-popover=""
      data-side={placedAt.split("-")[0]}
      tabIndex={-1}
      // The views' own click handlers never see a press in the details, or in
      // anything the details render in a portal
      onClick={(e) => e.stopPropagation()}
      onKeyDown={loopFocus}
      {...dismissHandlers}
      style={{
        ...floatingStyles,
        transformOrigin: TRANSFORM_ORIGIN_BY_PLACEMENT[placedAt],
      }}
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
          onPrevWeek={
            previousInSeries
              ? () => series.showSeriesOccurrence(previousInSeries)
              : undefined
          }
          onNextWeek={
            nextInSeries
              ? () => series.showSeriesOccurrence(nextInSeries)
              : undefined
          }
          headerActions={popoverHeaderActions}
          autoFocusTitle={isNew}
          onTitleAutoFocused={clearPending}
        />
      )}
    </div>,
    portalContainer,
  );
}
