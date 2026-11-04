"use client";

import {
  useRef,
  useMemo,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addWeeks,
  isWeekend,
  startOfDay,
  startOfMonth,
} from "date-fns";

import { cn } from "@/lib/utils";
import { useMonthEventDrag } from "@/hooks/use-month-event-drag";
import { useMonthEventResize } from "@/hooks/use-month-event-resize";
import { useVerticalScroll } from "@/hooks/use-vertical-scroll";
import { useEventKeyboard } from "@/hooks/use-event-keyboard";
import {
  MONTH_VIEW_ROWS,
  generateConsecutiveWeeks,
  generateWeekRow,
} from "@/lib/event-utils";
import { isMultiDayEvent } from "@/lib/event-utils";
import { MonthViewGrid } from "./month-view-grid";
import { MonthViewEventBar } from "./month-view-event-bar";
import { MonthViewEventItem } from "./month-view-event-item";
import { EventContextMenu } from "./event-context-menu";
import {
  CalendarPopoverBoundaryProvider,
  isInsideCalendarPopover,
} from "./calendar-popover-context";
import { CalendarLoadingBar } from "./calendar-loading-bar";
import {
  useCalendar,
  useCalendarConfig,
  useCalendarViewSync,
} from "./calendar-provider";
import type { CalendarEvent } from "./calendar-types";
import type { MonthViewProps } from "./week-view-types";
import type { MonthWeekRow } from "@/lib/event-utils";

/** Base buffer rows on each side (extends dynamically with scroll distance) */
const BUFFER_ROWS = 2;

interface ContextMenuState {
  x: number;
  y: number;
  event: CalendarEvent;
}

/**
 * Month grid calendar. Date, events, selection and view settings come from
 * the surrounding CalendarProvider.
 */
export function MonthView({
  showEventPopover = true,
  onEventPopoverExpand,
  className,
}: MonthViewProps) {
  const {
    view,
    currentDate,
    events,
    viewSettings,
    weekStartsOn,
    selectedEvent,
    selectEvent,
    clearSelection,
    updateEvent,
    goToDate,
    showDay,
    loading,
  } = useCalendar();
  const { locale } = useCalendarConfig();
  const { reportView, reportDisplayMonth, closeEventPopover } =
    useCalendarViewSync();
  /**
   * Whether the provider navigates by month. False for the commit before it
   * adopts this view (on mount, or right after a switch it doesn't follow).
   */
  const isProviderInSync = view === "month";
  const boundaryRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const selectedEventId = selectedEvent?.id;
  const { showWeekends, showWeekNumbers } = viewSettings;

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const weekRows = useMemo(
    () =>
      generateConsecutiveWeeks(
        currentDate,
        MONTH_VIEW_ROWS,
        weekStartsOn,
        locale,
      ),
    [currentDate, weekStartsOn, locale],
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

  // Tell the provider which view is on screen. `reportView` changes with the
  // provider's state, so this also re-checks after every switch. A layout
  // effect: the provider adopts month view before the first paint.
  useLayoutEffect(() => {
    reportView({ view: "month" });
  }, [reportView]);

  // Report the display month to the provider (header and sidebar sync). Not
  // while it is adopting this view: the date is about to change.
  useEffect(() => {
    if (!isProviderInSync) return;
    reportDisplayMonth(displayMonth);
  }, [isProviderInSync, displayMonth, reportDisplayMonth]);

  // Weekday columns in display order, starting on `weekStartsOn`, named in
  // the calendar's locale ("Sun", "Mon") like the rows' days
  const dayNames = useMemo(() => {
    const firstWeek = weekRows[0]?.days ?? [];
    const visibleDays = showWeekends
      ? firstWeek
      : firstWeek.filter((day) => !isWeekend(day.date));
    return visibleDays.map((day) => day.dayName);
  }, [weekRows, showWeekends]);

  const colCount = dayNames.length;
  const gridTemplateColumns = showWeekNumbers
    ? `2rem repeat(${colCount}, minmax(0, 1fr))`
    : `repeat(${colCount}, minmax(0, 1fr))`;

  const handleEventClick = useCallback(
    (event: CalendarEvent) => selectEvent(event.id),
    [selectEvent],
  );

  const { dragState, handleDragPointerDown } = useMonthEventDrag({
    gridRef,
    events,
    onEventChange: updateEvent,
    onEventClick: handleEventClick,
  });

  const { resizeState, handleResizePointerDown } = useMonthEventResize({
    gridRef,
    events,
    onEventChange: updateEvent,
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
      goToDate(newDate);
    },
    [currentDate, goToDate],
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
  const wasProviderInSyncRef = useRef(isProviderInSync);
  useEffect(() => {
    const wasProviderInSync = wasProviderInSyncRef.current;
    wasProviderInSyncRef.current = isProviderInSync;

    if (scrollNavigatedRef.current) {
      scrollNavigatedRef.current = false;
      prevDateRef.current = currentDate;
      return;
    }

    const prevDate = prevDateRef.current;
    prevDateRef.current = currentDate;

    if (prevDate.getTime() === currentDate.getTime()) return;
    // Dates set while the provider adopts this view (an undone switch, such
    // as "+N more" without a week view to open) are not navigation
    if (!wasProviderInSync || !isProviderInSync) return;

    // Calculate how many weeks changed
    const weeksDelta = Math.round(
      (currentDate.getTime() - prevDate.getTime()) / (7 * 24 * 60 * 60 * 1000),
    );

    if (weeksDelta !== 0) {
      triggerSlideAnimation(weeksDelta);
    }
  }, [currentDate, isProviderInSync, triggerSlideAnimation]);

  /** Whether a day is in one of the on-screen week rows */
  const isDayVisible = useCallback(
    (date: Date) => {
      const firstRow = weekRows[0];
      const lastRow = weekRows[weekRows.length - 1];
      if (!firstRow || !lastRow) return false;
      const first = startOfDay(firstRow.days[0].date);
      const afterLast = addDays(
        startOfDay(lastRow.days[lastRow.days.length - 1].date),
        1,
      );
      return date >= first && date < afterLast;
    },
    [weekRows],
  );

  /** Scrolls a row toward a day just off screen (keyboard moves go a week at most) */
  const revealDay = useCallback(
    (date: Date) => {
      const firstDay = weekRows[0]?.days[0]?.date ?? currentDate;
      goToDate(addWeeks(currentDate, date < firstDay ? -1 : 1));
    },
    [weekRows, currentDate, goToDate],
  );

  const handleEventKeyDown = useEventKeyboard({
    containerRef: boundaryRef,
    isDayVisible,
    revealDay,
  });

  // Symmetric buffer: extends in both directions (mirrors week view's dynamicBuffer)
  const extraScrollRows =
    rowHeight > 0 ? Math.ceil(Math.abs(scrollOffset) / rowHeight) : 0;
  const dynamicBuffer = BUFFER_ROWS + extraScrollRows;

  // Build buffered week rows: dynamicBuffer above + MONTH_VIEW_ROWS + dynamicBuffer below
  const bufferedWeekRows = useMemo(() => {
    if (weekRows.length === 0) return weekRows;
    const rows: MonthWeekRow[] = [];
    const firstDate = weekRows[0].days[0].date;
    for (let i = dynamicBuffer; i > 0; i--) {
      rows.push(generateWeekRow(addWeeks(firstDate, -i), weekStartsOn, locale));
    }
    rows.push(...weekRows);
    const lastDate = weekRows[weekRows.length - 1].days[0].date;
    for (let i = 1; i <= dynamicBuffer; i++) {
      rows.push(generateWeekRow(addWeeks(lastDate, i), weekStartsOn, locale));
    }
    return rows;
  }, [weekRows, dynamicBuffer, weekStartsOn, locale]);

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
        isInsideCalendarPopover(target) ||
        target.closest("button") ||
        target.closest("[role='button']")
      ) {
        return;
      }
      clearSelection();
    },
    [clearSelection],
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
        aria-busy={loading || undefined}
        onClick={handleRootClick}
        onKeyDown={handleEventKeyDown}
      >
        {/* Day-of-week header — right-aligned to match day number positions */}
        <div
          ref={headerRef}
          className="relative border-b border-border bg-background"
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
          {loading && <CalendarLoadingBar />}
        </div>

        {/* Month grid — fills remaining space */}
        <div ref={scrollContainerRef} className="flex-1 overflow-hidden">
          <MonthViewGrid
            weekRows={bufferedWeekRows}
            events={displayEvents}
            currentMonth={displayMonth}
            showWeekNumbers={showWeekNumbers}
            showWeekends={showWeekends}
            onEventClick={handleEventClick}
            onContextMenu={handleContextMenu}
            onMoreClick={showDay}
            onDayNumberClick={showDay}
            onBackgroundClick={clearSelection}
            onDragPointerDown={handleDragPointerDown}
            onResizePointerDown={handleResizePointerDown}
            selectedEventId={selectedEventId}
            dragEventId={dragEventId}
            resizeEventId={resizeEventId}
            dragTargetDate={isDragging ? dragState?.targetDate : undefined}
            dragEvent={isDragging ? dragState?.event : undefined}
            showEventPopover={showEventPopover}
            onEventChange={updateEvent}
            onEventPopoverExpand={onEventPopoverExpand}
            onEventPopoverClose={closeEventPopover}
            visibleRowCount={visibleRowCount}
            visibleRowStart={dynamicBuffer}
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
            onEventChange={updateEvent}
          />
        )}

        {/* Floating drag copy — portaled to body, follows cursor */}
        {isDragging &&
          dragState &&
          createPortal(
            <div
              aria-hidden
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
                  isDragging
                />
              ) : (
                <MonthViewEventItem event={dragState.event} isDragging />
              )}
            </div>,
            document.body,
          )}
      </div>
    </CalendarPopoverBoundaryProvider>
  );
}
