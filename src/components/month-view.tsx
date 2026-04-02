"use client";

import { useRef, useMemo, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { startOfMonth } from "date-fns";

import { cn } from "@/lib/utils";
import { useMonthEventDrag } from "@/hooks/use-month-event-drag";
import { generateMonthGrid } from "@/lib/event-utils";
import { isMultiDayEvent } from "@/lib/event-utils";
import { MonthViewGrid } from "./month-view-grid";
import { MonthViewEventBar } from "./month-view-event-bar";
import { MonthViewEventItem } from "./month-view-event-item";
import { EventContextMenu } from "./event-context-menu";
import { CalendarPopoverBoundaryProvider } from "./calendar-popover-context";
import type { CalendarEvent, ViewSettings } from "./calendar-types";

/** Day name labels for full weeks (Sun–Sat) */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day name labels for weekdays only (Mon–Fri) */
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export interface MonthViewProps {
  currentDate: Date;
  events?: CalendarEvent[];
  viewSettings?: ViewSettings;
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  onBackgroundClick?: () => void;
  onEventChange?: (event: CalendarEvent) => void;
  onMoreClick?: (date: Date) => void;
  onDayNumberClick?: (date: Date) => void;
  isSidebarOpen?: boolean;
  onDockToSidebar?: () => void;
  onClosePopover?: () => void;
  className?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  event: CalendarEvent;
}

export function MonthView({
  currentDate,
  events = [],
  viewSettings,
  onEventClick,
  selectedEventId,
  onBackgroundClick,
  onEventChange,
  onMoreClick,
  onDayNumberClick,
  isSidebarOpen,
  onDockToSidebar,
  onClosePopover,
  className,
}: MonthViewProps) {
  const boundaryRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const showWeekends = viewSettings?.showWeekends ?? true;
  const showWeekNumbers = viewSettings?.showWeekNumbers ?? false;

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const weekRows = useMemo(
    () => generateMonthGrid(startOfMonth(currentDate)),
    [currentDate],
  );

  const dayNames = showWeekends ? DAY_NAMES : WEEKDAY_NAMES;

  const colCount = dayNames.length;
  const gridTemplateColumns = showWeekNumbers
    ? `2rem repeat(${colCount}, minmax(0, 1fr))`
    : `repeat(${colCount}, minmax(0, 1fr))`;

  const { dragState, handleDragMouseDown } = useMonthEventDrag({
    gridRef,
    events,
    onEventChange,
    onEventClick,
    columnCount: colCount,
    rowCount: weekRows.length,
  });

  const isDragging = dragState?.isDragging ?? false;
  const dragEventId = isDragging ? dragState?.eventId : undefined;

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, event });
    },
    [],
  );

  const handleRootClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("button") ||
        target.closest("[role='button']")
      ) {
        return;
      }
      onBackgroundClick?.();
    },
    [onBackgroundClick],
  );

  return (
    <CalendarPopoverBoundaryProvider
      boundaryRef={boundaryRef}
      headerRef={headerRef}
      view="month"
    >
      <div
        ref={boundaryRef}
        className={cn("flex h-full flex-col overflow-hidden", className)}
        onClick={handleRootClick}
      >
        {/* Day-of-week header — right-aligned to match day number positions */}
        <div
          ref={headerRef}
          className="border-b border-border bg-background"
          style={{ display: "grid", gridTemplateColumns }}
        >
          {showWeekNumbers && (
            <div className="py-2 text-center text-[11px] text-muted-foreground">
              w
            </div>
          )}
          {dayNames.map((name) => (
            <div
              key={name}
              className="py-2 text-center text-[13px] text-muted-foreground"
            >
              {name}
            </div>
          ))}
        </div>

        {/* Month grid — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <MonthViewGrid
            weekRows={weekRows}
            events={events}
            currentMonth={startOfMonth(currentDate)}
            showWeekNumbers={showWeekNumbers}
            showWeekends={showWeekends}
            onEventClick={onEventClick}
            onContextMenu={handleContextMenu}
            onMoreClick={onMoreClick}
            onDayNumberClick={onDayNumberClick}
            onBackgroundClick={onBackgroundClick}
            onDragMouseDown={handleDragMouseDown}
            selectedEventId={selectedEventId}
            dragEventId={dragEventId}
            dragTargetDate={isDragging ? dragState?.targetDate : undefined}
            dragEvent={isDragging ? dragState?.event : undefined}
            isSidebarOpen={isSidebarOpen}
            onEventChange={onEventChange}
            onDockToSidebar={onDockToSidebar}
            onClosePopover={onClosePopover}
            gridRef={gridRef}
          />
        </div>

        {/* Context menu */}
        {contextMenu && (
          <EventContextMenu
            event={contextMenu.event}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={() => setContextMenu(null)}
            onEventChange={onEventChange}
          />
        )}

        {/* Floating drag copy — portaled to body, follows cursor */}
        {isDragging &&
          dragState &&
          createPortal(
            <div
              className="pointer-events-none fixed z-[9999] w-48 opacity-80 shadow-lg"
              style={{
                left: dragState.clientX - 96,
                top: dragState.clientY - 10,
              }}
            >
              {dragState.event.isAllDay || isMultiDayEvent(dragState.event) ? (
                <MonthViewEventBar
                  event={dragState.event}
                  colSpan={1}
                  roundedLeft
                  roundedRight
                />
              ) : (
                <MonthViewEventItem event={dragState.event} />
              )}
            </div>,
            document.body,
          )}
      </div>
    </CalendarPopoverBoundaryProvider>
  );
}
