"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  getDaySegmentPosition,
  getEventDayRange,
  resolveEventColorStyle,
} from "@/lib/event-utils";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import { useCalendarConfig, useCalendarEventDraft } from "./calendar-provider";
import { EventDetailPopover } from "./event-detail-popover";
import type {
  CalendarEvent,
  EventDraftLayerProps,
  EventDraftPopoverProps,
  EventPopoverAnchor,
} from "./week-view-types";

/**
 * Marks the elements that stand for the event being created: the hours or
 * days it covers. Its details popover opens beside the first one on screen.
 */
export const EVENT_DRAFT_ANCHOR_ATTRIBUTE = "data-event-draft-anchor";

/** Props that mark an element as an anchor of the event being created */
export const EVENT_DRAFT_ANCHOR_PROPS = { [EVENT_DRAFT_ANCHOR_ATTRIBUTE]: "" };

/** `data-slot` of a draft's tint, for styling and tests */
export const EVENT_DRAFT_SLOT = "event-draft";

/**
 * Fill of a draft that nothing was typed into yet: the event's own color
 * (set on the element with `resolveEventColorStyle()`), see-through over the
 * grid, as Notion Calendar tints the range a new event will cover
 */
export const EVENT_DRAFT_TINT_CLASS =
  "bg-event-border/25 dark:bg-event-border/20";

/** The first anchor of the event being created that is on screen, if any */
function findEventDraftAnchor(boundary: HTMLElement): Element | null {
  const anchors = boundary.querySelectorAll(
    `[${EVENT_DRAFT_ANCHOR_ATTRIBUTE}]`,
  );
  for (const anchor of anchors) {
    // Scroll buffer columns and rows are inert: off screen
    if (!anchor.closest("[inert]")) return anchor;
  }
  return null;
}

/** The created event's own element, once the views draw it as an event */
function findEventElement(
  boundary: HTMLElement,
  event: CalendarEvent,
): Element | null {
  return boundary.querySelector(`[data-event-id="${CSS.escape(event.id)}"]`);
}

/**
 * The time grid's layer for the event being created: the hours it covers in
 * each day column, tinted while it is a draft nothing was typed into. A
 * range drawn across days fills every column it crosses, as in Notion
 * Calendar. Once the draft is drawn as an event (named, or saved) the layer
 * is see-through and only anchors the details popover.
 */
export function TimeGridEventDraft({
  days,
  visibleStartIndex = 0,
  visibleCount,
}: EventDraftLayerProps) {
  const { event, isTinted } = useCalendarEventDraft();
  const config = useCalendarConfig();

  if (!event || event.isAllDay) return null;

  const colorStyle = resolveEventColorStyle(event, config.calendars);
  const visibleEnd = visibleStartIndex + (visibleCount ?? days.length);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 grid"
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, index) => {
        const segment = getDaySegmentPosition(event, day.date, config);
        const key = day.date.toISOString();
        if (!segment) return <div key={key} />;
        const isOnScreen = index >= visibleStartIndex && index < visibleEnd;

        return (
          <div key={key} className="relative">
            <div
              {...(isOnScreen ? EVENT_DRAFT_ANCHOR_PROPS : null)}
              data-slot={isTinted ? EVENT_DRAFT_SLOT : undefined}
              className={cn(
                "absolute inset-x-0",
                isTinted && EVENT_DRAFT_TINT_CLASS,
              )}
              style={{
                ...colorStyle,
                top: `${segment.top}%`,
                height: `${segment.height}%`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * The all-day row's layer for the event being created: the days an all-day
 * draft covers, tinted over the row's full height while nothing was typed
 * into it, as in Notion Calendar. Once the draft is drawn as an event the
 * layer is see-through and only anchors the details popover.
 */
export function AllDayEventDraft({
  days,
  visibleStartIndex = 0,
  visibleCount,
}: EventDraftLayerProps) {
  const { event, isTinted } = useCalendarEventDraft();
  const { calendars } = useCalendarConfig();

  if (!event || !event.isAllDay) return null;

  const { first, last } = getEventDayRange(event);
  let startColumn = -1;
  let endColumn = -1;
  days.forEach((day, index) => {
    if (day.date < first || day.date > last) return;
    if (startColumn === -1) startColumn = index;
    endColumn = index;
  });
  if (startColumn === -1) return null;

  // The popover goes beside the part of the range that is on screen
  const anchorStart = Math.max(startColumn, visibleStartIndex);
  const anchorEnd = Math.min(
    endColumn,
    visibleStartIndex + (visibleCount ?? days.length) - 1,
  );
  const columnPercent = 100 / days.length;
  const colorStyle = resolveEventColorStyle(event, calendars);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {isTinted && (
        <div
          data-slot={EVENT_DRAFT_SLOT}
          className={cn("absolute inset-y-0", EVENT_DRAFT_TINT_CLASS)}
          style={{
            ...colorStyle,
            left: `${startColumn * columnPercent}%`,
            width: `${(endColumn - startColumn + 1) * columnPercent}%`,
          }}
        />
      )}
      {anchorEnd >= anchorStart && (
        <div
          {...EVENT_DRAFT_ANCHOR_PROPS}
          className="absolute inset-y-0"
          style={{
            left: `${anchorStart * columnPercent}%`,
            width: `${(anchorEnd - anchorStart + 1) * columnPercent}%`,
          }}
        />
      )}
    </div>
  );
}

/**
 * The details popover of the event being created, kept by the view rather
 * than by an event item: it opens beside the draft's tinted range and stays
 * mounted when the draft turns into an event (its first title keystroke) and
 * when it is saved, so focus never leaves the field being typed into. It
 * waits for a drag that is still drawing the draft to end. Render it in a
 * view that shows details in popovers; it draws nothing when no event is
 * being created.
 */
export function EventDraftPopover({ onExpand }: EventDraftPopoverProps) {
  const {
    event,
    isDraft,
    isDrawing,
    updateEvent,
    updateEventDraft,
    closePopover,
  } = useCalendarEventDraft();
  const { boundary, view, boundaryRight, headerBottom } =
    useCalendarPopoverBoundary();

  if (!event || isDrawing || !boundary) return null;

  const isDayView = view === "day";

  /**
   * Read when the popover is placed, after the layout it sits in: a ref
   * whose `current` looks the anchor up, since the layer that draws it is
   * elsewhere in the view. Off screen, the calendar itself stands in.
   */
  const anchorRef: React.RefObject<Element | null> = {
    get current() {
      return findEventDraftAnchor(boundary) ?? boundary;
    },
  };

  /**
   * In day view the range spans the full grid width, so the popover opens
   * leftward from the calendar's right edge, level with the range. An
   * all-day range sits in the header: there the edge's whole height anchors
   * it, as for all-day events.
   */
  const dayViewAnchor: EventPopoverAnchor = {
    getBoundingClientRect: () => {
      if (event.isAllDay) {
        return new DOMRect(boundaryRight, 0, 0, window.innerHeight);
      }
      const rect = findEventDraftAnchor(boundary)?.getBoundingClientRect();
      return new DOMRect(boundaryRight, rect?.top ?? 0, 0, rect?.height ?? 0);
    },
  };

  /** Presses on the event's own block, once it has one, aren't outside the popover */
  const triggerRef: React.RefObject<Element | null> = {
    get current() {
      return findEventElement(boundary, event);
    },
  };

  // All-day events and month cells open their details from the top corner
  const alignsToStart = event.isAllDay || view === "month";

  return (
    <EventDetailPopover
      event={event}
      anchor={isDayView ? dayViewAnchor : anchorRef}
      triggerRef={triggerRef}
      onEventChange={updateEvent}
      onTitlePreview={isDraft ? updateEventDraft : undefined}
      onClose={() => closePopover(event.id)}
      onExpand={onExpand}
      side={isDayView ? "left" : "right"}
      align={alignsToStart ? "start" : "center"}
      collisionPaddingTop={isDayView ? headerBottom : undefined}
    />
  );
}
