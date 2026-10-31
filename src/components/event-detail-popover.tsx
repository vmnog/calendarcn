"use client";

import * as React from "react";
import { PanelRightIcon, X } from "lucide-react";

import { focusEventElement } from "@/hooks/use-event-keyboard";
import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { EventDetailPanel } from "./event-detail-panel";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import { useCalendarRenderSlots } from "./calendar-provider";
import { useEventTitleFocus } from "./event-title-focus-context";
import type { CalendarEvent } from "./week-view-types";

interface EventDetailPopoverProps {
  event: CalendarEvent;
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

export function EventDetailPopover({
  event,
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
  /** Just created by click-to-create: its title should be focused */
  const isNew = pendingEventId === event.id;

  /**
   * Escape closes the popover before the keydown reaches the event, and the
   * event's element is re-created without it. If focus was on the event or
   * in the details, put it back on the event once that has happened.
   */
  const handleEscapeKeyDown = React.useCallback(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const hadFocus =
      active.dataset.eventId === event.id ||
      active.closest("[data-radix-popper-content-wrapper]") !== null;
    if (!hadFocus) return;
    requestAnimationFrame(() => {
      if (document.activeElement && document.activeElement !== document.body) {
        return;
      }
      focusEventElement(boundary, event.id);
    });
  }, [boundary, event.id]);

  // Custom details get `isNew` for one render; the default panel clears the
  // request itself once it has focused the title
  React.useEffect(() => {
    if (!renderEventDetails || !isNew) return;
    clearPending();
  }, [renderEventDetails, isNew, clearPending]);

  /**
   * In day view the event trigger spans the full grid width, leaving no room
   * for a 320px popover on either side within the calendar container.
   * Skip the collision boundary so Radix uses the viewport instead.
   */
  const isDayView = view === "day";
  const effectiveBoundary = isDayView
    ? undefined
    : boundary
      ? [boundary]
      : undefined;

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

  return (
    <PopoverContent
      side={side}
      align={align}
      sideOffset={8}
      collisionPadding={{
        top: collisionPaddingTop ?? headerHeight,
        bottom: 8,
        left: 16,
        right: 16,
      }}
      collisionBoundary={effectiveBoundary}
      className="w-[320px] max-h-[80vh] overflow-y-auto p-0 bg-popover/60 backdrop-blur-xl border shadow-lg rounded-lg"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
      onEscapeKeyDown={handleEscapeKeyDown}
      onInteractOutside={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("[data-radix-popper-content-wrapper]")) {
          e.preventDefault();
        }
      }}
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
    </PopoverContent>
  );
}
