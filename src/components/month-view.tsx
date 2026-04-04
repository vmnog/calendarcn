"use client";

import { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { addWeeks, startOfMonth } from "date-fns";

import { cn } from "@/lib/utils";
import { useMonthEventDrag } from "@/hooks/use-month-event-drag";
import { useMonthEventResize } from "@/hooks/use-month-event-resize";
import { useVerticalScroll } from "@/hooks/use-vertical-scroll";
import { generateConsecutiveWeeks, generateWeekRow } from "@/lib/event-utils";
import { isMultiDayEvent } from "@/lib/event-utils";
import { MonthViewGrid } from "./month-view-grid";
import { MonthViewEventBar } from "./month-view-event-bar";
import { MonthViewEventItem } from "./month-view-event-item";
import { EventContextMenu } from "./event-context-menu";
import { CalendarPopoverBoundaryProvider } from "./calendar-popover-context";
import type { CalendarEvent, ViewSettings } from "./calendar-types";
import type { MonthWeekRow } from "@/lib/event-utils";

/** Day name labels for full weeks (Sun–Sat) */
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Day name labels for weekdays only (Mon–Fri) */
const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Base buffer rows on each side (extends dynamically with scroll distance) */
const BUFFER_ROWS = 2;

export interface MonthViewProps {
  currentDate: Date;
  events?: CalendarEvent[];
  viewSettings?: ViewSettings;
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  onBackgroundClick?: () => void;
  onEventChange?: (event: CalendarEvent) => void;
  onDateChange?: (date: Date) => void;
  /** Called when the display month changes (for header/sidebar sync) */
  onDisplayMonthChange?: (month: Date) => void;
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
  onDateChange,
  onDisplayMonthChange,
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

  /** Number of week rows visible in the viewport */
  const VISIBLE_ROWS = 6;

  const weekRows = useMemo(
    () => generateConsecutiveWeeks(currentDate, VISIBLE_ROWS),
    [currentDate],
  );

  // Derive the display month from the center of the visible rows.
  // This determines the header title and adjacent-month dimming.
  const displayMonth = useMemo(() => {
    const middleRow = weekRows[Math.floor(weekRows.length / 2)];
    if (!middleRow) return startOfMonth(currentDate);
    // Use the Thursday of the middle row (ISO convention for determining the week's month)
    const midDate = middleRow.days[Math.min(4, middleRow.days.length - 1)].date;
    return startOfMonth(midDate);
  }, [weekRows, currentDate]);

  // Notify parent when the display month changes
  useEffect(() => {
    onDisplayMonthChange?.(displayMonth);
  }, [displayMonth, onDisplayMonthChange]);

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

  const { resizeState, handleResizeMouseDown } = useMonthEventResize({
    gridRef,
    events,
    onEventChange,
  });

  const isDragging = dragState?.isDragging ?? false;
  const dragEventId = isDragging ? dragState?.eventId : undefined;
  const isResizing = resizeState?.isResizing ?? false;
  const resizeEventId = isResizing ? resizeState?.eventId : undefined;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const visibleRowCount = weekRows.length;

  const [rowHeight, setRowHeight] = useState(0);

  // Measure row height from container
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || visibleRowCount === 0) return;
    const observer = new ResizeObserver(() => {
      setRowHeight(el.clientHeight / visibleRowCount);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visibleRowCount]);

  const scrollNavigatedRef = useRef(false);

  const handleScrollNavigate = useCallback(
    (rowsDelta: number) => {
      scrollNavigatedRef.current = true;
      const newDate = addWeeks(currentDate, rowsDelta);
      onDateChange?.(newDate);
    },
    [currentDate, onDateChange],
  );

  const { scrollOffset, slideOffset, isAnimating, triggerSlideAnimation } =
    useVerticalScroll({
      containerRef: scrollContainerRef,
      rowHeight,
      onNavigate: handleScrollNavigate,
      disabled: isDragging || isResizing,
    });

  // Detect external currentDate changes (button/keyboard nav) and trigger slide animation
  const prevDateRef = useRef(currentDate);
  useEffect(() => {
    if (scrollNavigatedRef.current) {
      scrollNavigatedRef.current = false;
      prevDateRef.current = currentDate;
      return;
    }

    const prevDate = prevDateRef.current;
    prevDateRef.current = currentDate;

    if (prevDate.getTime() === currentDate.getTime()) return;

    // Calculate how many weeks changed
    const weeksDelta = Math.round(
      (currentDate.getTime() - prevDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    if (weeksDelta !== 0) {
      triggerSlideAnimation(weeksDelta);
    }
  }, [currentDate, triggerSlideAnimation]);

  // Symmetric buffer: extends in both directions (mirrors week view's dynamicBuffer)
  const extraScrollRows =
    rowHeight > 0 ? Math.ceil(Math.abs(scrollOffset) / rowHeight) : 0;
  const dynamicBuffer = BUFFER_ROWS + extraScrollRows;

  // Build buffered week rows: dynamicBuffer above + VISIBLE_ROWS + dynamicBuffer below
  const bufferedWeekRows = useMemo(() => {
    if (weekRows.length === 0) return weekRows;
    const rows: MonthWeekRow[] = [];
    const firstDate = weekRows[0].days[0].date;
    for (let i = dynamicBuffer; i > 0; i--) {
      rows.push(generateWeekRow(addWeeks(firstDate, -i)));
    }
    rows.push(...weekRows);
    const lastDate = weekRows[weekRows.length - 1].days[0].date;
    for (let i = 1; i <= dynamicBuffer; i++) {
      rows.push(generateWeekRow(addWeeks(lastDate, i)));
    }
    return rows;
  }, [weekRows, dynamicBuffer]);

  // Base offset hides the top buffer; scrollOffset + slideOffset shift within
  const baseTranslateY = -(dynamicBuffer * rowHeight);
  const transformY = baseTranslateY + scrollOffset + slideOffset;
  const scrollStyle: React.CSSProperties = {
    transform: `translateY(${transformY}px)`,
    transition: isAnimating ? "transform 200ms ease-out" : undefined,
  };

  // During resize, substitute the resized event's dates so the grid
  // recalculates layout in real-time (live preview with reflow).
  // Keep isAllDay true so the event stays rendered as a bar even when
  // resized down to a single day.
  const displayEvents = useMemo(() => {
    if (!isResizing || !resizeState) return events;
    return events.map((ev) =>
      ev.id === resizeState.eventId
        ? {
            ...ev,
            start: resizeState.currentStart,
            end: resizeState.currentEnd,
            isAllDay: true,
          }
        : ev,
    );
  }, [events, isResizing, resizeState]);

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
        <div ref={scrollContainerRef} className="flex-1 overflow-hidden">
          <MonthViewGrid
            weekRows={bufferedWeekRows}
            events={displayEvents}
            currentMonth={displayMonth}
            showWeekNumbers={showWeekNumbers}
            showWeekends={showWeekends}
            onEventClick={onEventClick}
            onContextMenu={handleContextMenu}
            onMoreClick={onMoreClick}
            onDayNumberClick={onDayNumberClick}
            onBackgroundClick={onBackgroundClick}
            onDragMouseDown={handleDragMouseDown}
            onResizeMouseDown={handleResizeMouseDown}
            selectedEventId={selectedEventId}
            dragEventId={dragEventId}
            resizeEventId={resizeEventId}
            dragTargetDate={isDragging ? dragState?.targetDate : undefined}
            dragEvent={isDragging ? dragState?.event : undefined}
            isSidebarOpen={isSidebarOpen}
            onEventChange={onEventChange}
            onDockToSidebar={onDockToSidebar}
            onClosePopover={onClosePopover}
            visibleRowCount={visibleRowCount}
            scrollStyle={scrollStyle}
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
