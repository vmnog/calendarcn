"use client";

import * as React from "react";
import { PanelRightIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PopoverContent } from "@/components/ui/popover";
import { EventDetailPanel } from "./event-detail-panel";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import type { CalendarEvent } from "./week-view-types";

interface EventDetailPopoverProps {
  event: CalendarEvent;
  onClose: () => void;
  onDockToSidebar: () => void;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  /** Which side to prefer for the popover. Defaults to "right". */
  side?: "right" | "bottom" | "left" | "top";
  /** Alignment along the side axis. Defaults to "center". */
  align?: "start" | "center" | "end";
}

export function EventDetailPopover({
  event,
  onClose,
  onDockToSidebar,
  onPrevWeek,
  onNextWeek,
  side = "right",
  align = "center",
}: EventDetailPopoverProps) {
  const { boundary, headerHeight } = useCalendarPopoverBoundary();

  const popoverHeaderActions = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-[#C7C5C1] dark:text-[#595959]"
        onClick={(e) => {
          e.stopPropagation();
          onDockToSidebar();
        }}
        title="Dock to sidebar"
      >
        <PanelRightIcon className="size-4" />
      </Button>
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
      collisionPadding={{ top: headerHeight, bottom: 8, left: 16, right: 16 }}
      collisionBoundary={boundary ? [boundary] : undefined}
      className="w-[320px] max-h-[80vh] overflow-y-auto p-0 bg-popover border shadow-lg rounded-lg"
      onOpenAutoFocus={(e) => e.preventDefault()}
      onCloseAutoFocus={(e) => e.preventDefault()}
    >
      <EventDetailPanel
        event={event}
        onPrevWeek={onPrevWeek}
        onNextWeek={onNextWeek}
        headerActions={popoverHeaderActions}
      />
    </PopoverContent>
  );
}
