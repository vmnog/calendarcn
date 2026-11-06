"use client";

import React from "react";
import { createPortal } from "react-dom";
import { isSameDay, startOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { isPrimaryPress, usePointerGesture } from "@/hooks/use-pointer-gesture";
import {
  calculatePositionedEvents,
  formatFullDate,
  getNewEventRange,
} from "@/lib/event-utils";
import { CalendarEventItem } from "./calendar-event-item";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import { useCalendarConfig } from "./calendar-provider";
import type {
  CalendarEvent,
  EventDragState,
  EventItemPopoverProps,
  EventResizeState,
  PositionedEvent,
  WeekViewGridProps,
} from "./week-view-types";

/**
 * Max pointer travel (px) between pointerdown and click for a click on an
 * empty slot to create an event. Matches the drag threshold in
 * use-event-drag so a press that moves far enough to count as a drag never
 * also creates an event.
 */
const CREATE_CLICK_TOLERANCE_PX = 4;

/** Pointer position recorded when a mouse or pen press lands on an empty day column */
interface PendingCreateClick {
  clientX: number;
  clientY: number;
}

/**
 * Main grid displaying hour/day intersection cells with events
 * Each cell represents one hour in one day
 */
export function WeekViewGrid({
  days,
  hours,
  hourHeight,
  events = [],
  onEventClick,
  selectedEventId,
  onEventCreate,
  dragState,
  onEventDragPointerDown,
  resizeState,
  onEventResizePointerDown,
  onEventChange,
  onContextMenuOpenChange,
  showEventPopover,
  onEventPopoverExpand,
  onEventPopoverClose,
  highlightedDate,
  visibleStartIndex = 0,
  visibleCount,
  className,
}: WeekViewGridProps) {
  const { view } = useCalendarPopoverBoundary();
  const config = useCalendarConfig();
  const isDayView = view === "day";
  const gridRef = React.useRef<HTMLDivElement>(null);
  /** Set only by a mouse or pen press directly on empty column space */
  const pendingCreateRef = React.useRef<PendingCreateClick | null>(null);
  const [gridWidth, setGridWidth] = React.useState(0);
  const { startGesture } = usePointerGesture({ containerRef: gridRef });

  React.useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGridWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /** Creates an event in a column at a viewport Y position */
  const createEventAt = React.useCallback(
    (column: HTMLElement, columnDate: Date, clientY: number) => {
      if (!onEventCreate) return;
      // The column's top edge is `dayStartHour`, not midnight
      const columnTop = column.getBoundingClientRect().top;
      const minutesFromMidnight =
        config.dayStartHour * 60 + ((clientY - columnTop) / hourHeight) * 60;
      onEventCreate(getNewEventRange(columnDate, minutesFromMidnight, config));
    },
    [onEventCreate, hourHeight, config],
  );

  /**
   * Capture phase runs before event items stop pointerdown propagation, so
   * a press that starts on an event (drag, resize, select) always clears any
   * pending create left over from an earlier press.
   */
  const handleColumnPointerDownCapture = React.useCallback(() => {
    pendingCreateRef.current = null;
  }, []);

  const handleColumnPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>, columnDate: Date) => {
      if (e.target !== e.currentTarget) return;
      // Touch creates with a long press, so a swipe over empty space still
      // scrolls and a tap only clears the selection
      if (e.pointerType === "touch") {
        startGesture(e, ({ clientY, element }) =>
          createEventAt(element, columnDate, clientY),
        );
        return;
      }
      if (!isPrimaryPress(e)) return;
      pendingCreateRef.current = { clientX: e.clientX, clientY: e.clientY };
    },
    [startGesture, createEventAt],
  );

  /**
   * Creates an event when a press started and ended on empty space in the
   * same column without moving. With an event selected the click is left to
   * bubble so WeekView's background click deselects instead.
   */
  const handleColumnClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>, columnDate: Date) => {
      const pending = pendingCreateRef.current;
      pendingCreateRef.current = null;

      if (!pending || !onEventCreate) return;
      if (e.target !== e.currentTarget) return;
      if (selectedEventId) return;

      const movedX = Math.abs(e.clientX - pending.clientX);
      const movedY = Math.abs(e.clientY - pending.clientY);
      if (
        movedX > CREATE_CLICK_TOLERANCE_PX ||
        movedY > CREATE_CLICK_TOLERANCE_PX
      ) {
        return;
      }

      e.stopPropagation();
      createEventAt(e.currentTarget, columnDate, e.clientY);
    },
    [onEventCreate, selectedEventId, createEventAt],
  );

  return (
    <div ref={gridRef} className={cn("relative", className)}>
      {/* Background grid */}
      <div
        aria-hidden
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${days.length}, 1fr)`,
          gridTemplateRows: `repeat(${hours.length}, ${hourHeight}px)`,
        }}
      >
        {hours.map((hourSlot) =>
          days.map((day) => {
            const isWeekend =
              day.date.getDay() === 0 || day.date.getDay() === 6;
            return (
              <div
                key={`${day.date.toISOString()}-${hourSlot.hour}`}
                className={cn(
                  "border-border border-b border-l",
                  isWeekend && "bg-calendar-weekend",
                )}
              />
            );
          }),
        )}
      </div>

      {/* Column highlight layer — brief background fade for "+N more" navigation */}
      {highlightedDate && (
        <div
          aria-hidden
          className="absolute inset-0 grid pointer-events-none"
          style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
        >
          {days.map((day) => (
            <div
              key={day.date.toISOString()}
              className={cn(
                isSameDay(day.date, highlightedDate) && "column-highlight",
              )}
            />
          ))}
        </div>
      )}

      {/* Events layer */}
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
      >
        {days.map((day, index) => {
          const isOnScreen =
            index >= visibleStartIndex &&
            index < visibleStartIndex + (visibleCount ?? days.length);
          /**
           * Day view uses a smaller right gap than week view so events
           * nearly fill the column but still show a sliver of the grid
           * line — matching Notion Calendar's day-view styling.
           */
          const rightGap = isDayView ? 2 : 8;
          const positionedEvents = calculatePositionedEvents(
            events,
            day,
            config,
            rightGap,
          );

          return (
            <DayEventsColumn
              key={day.date.toISOString()}
              columnDate={day.date}
              label={formatFullDate(day.date, config.locale)}
              isOnScreen={isOnScreen}
              events={positionedEvents}
              hourHeight={hourHeight}
              onEventClick={onEventClick}
              selectedEventId={selectedEventId}
              dragState={dragState}
              onEventDragPointerDown={onEventDragPointerDown}
              resizeState={resizeState}
              onEventResizePointerDown={onEventResizePointerDown}
              onEventChange={onEventChange}
              onContextMenuOpenChange={onContextMenuOpenChange}
              showEventPopover={showEventPopover}
              onEventPopoverExpand={onEventPopoverExpand}
              onEventPopoverClose={onEventPopoverClose}
              onColumnPointerDownCapture={handleColumnPointerDownCapture}
              onColumnPointerDown={handleColumnPointerDown}
              onColumnClick={handleColumnClick}
            />
          );
        })}
      </div>

      {/* Resize placeholder overlay — rendered at grid level for cross-day support */}
      {resizeState?.isResizing &&
        !isSameDay(
          resizeState.currentStartDate,
          resizeState.currentEndDate,
        ) && (
          <ResizePlaceholderOverlay
            days={days}
            hourHeight={hourHeight}
            resizeState={resizeState}
          />
        )}

      {/* Drag placeholder overlay — rendered at grid level for cross-column support */}
      {dragState?.isDragging && (
        <DragPlaceholderOverlay
          days={days}
          hourHeight={hourHeight}
          dragState={dragState}
        />
      )}

      {/* Floating dragging copy — rendered at grid level so it can move freely */}
      {dragState?.isDragging && (
        <FloatingDragCopy
          days={days}
          hourHeight={hourHeight}
          dragState={dragState}
          gridWidth={gridWidth}
        />
      )}
    </div>
  );
}

interface DragPlaceholderOverlayProps {
  days: WeekViewGridProps["days"];
  hourHeight: number;
  dragState: EventDragState;
}

function DragPlaceholderOverlay({
  days,
  hourHeight,
  dragState,
}: DragPlaceholderOverlayProps) {
  // Find the target column index using dragState.currentDate
  const targetColumnIndex = days.findIndex((d) =>
    isSameDay(d.date, dragState.currentDate),
  );

  if (targetColumnIndex === -1) return null;

  // Build a minimal PositionedEvent from the drag state event
  const placeholderPositioned: PositionedEvent = {
    event: dragState.event,
    top: 0,
    height: 0,
    left: 0,
    width: 92,
    column: 0,
    totalColumns: 1,
  };

  return (
    <div
      aria-hidden
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, i) => {
        if (i !== targetColumnIndex) {
          return <div key={day.date.toISOString()} />;
        }

        return (
          <div key={day.date.toISOString()} className="relative">
            <CalendarEventItem
              key={`${dragState.eventId}-placeholder`}
              positionedEvent={placeholderPositioned}
              hourHeight={hourHeight}
              dragVariant="placeholder"
              overrideStart={dragState.currentStart}
              overrideEnd={dragState.currentEnd}
            />
          </div>
        );
      })}
    </div>
  );
}

interface ResizePlaceholderOverlayProps {
  days: WeekViewGridProps["days"];
  hourHeight: number;
  resizeState: EventResizeState;
}

function ResizePlaceholderOverlay({
  days,
  hourHeight,
  resizeState,
}: ResizePlaceholderOverlayProps) {
  if (resizeState.effectiveEdge === "bottom") {
    return (
      <BottomEdgeOverlay
        days={days}
        hourHeight={hourHeight}
        resizeState={resizeState}
      />
    );
  }

  return (
    <TopEdgeOverlay
      days={days}
      hourHeight={hourHeight}
      resizeState={resizeState}
    />
  );
}

function BottomEdgeOverlay({
  days,
  hourHeight,
  resizeState,
}: ResizePlaceholderOverlayProps) {
  const endDay = resizeState.currentEndDate;

  const startColIndex = days.findIndex((d) =>
    isSameDay(d.date, resizeState.currentStartDate),
  );
  const endColIndex = days.findIndex((d) => isSameDay(d.date, endDay));

  if (startColIndex === -1 || endColIndex === -1) return null;
  if (endColIndex <= startColIndex) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, i) => {
        // Skip start column (handled by DayEventsColumn) and columns outside range
        if (i <= startColIndex || i > endColIndex) {
          return <div key={day.date.toISOString()} />;
        }

        const isEndColumn = i === endColIndex;
        const segmentPosition = isEndColumn
          ? ("end" as const)
          : ("middle" as const);

        const midnight = startOfDay(day.date);
        const overrideStart = midnight;
        const overrideEnd = isEndColumn
          ? resizeState.currentEnd
          : addDays(midnight, 1);

        const positioned: PositionedEvent = {
          event: resizeState.event,
          top: 0,
          height: 0,
          left: 0,
          width: 92,
          column: 0,
          totalColumns: 1,
          segmentPosition,
        };

        return (
          <div key={day.date.toISOString()} className="relative">
            <CalendarEventItem
              positionedEvent={positioned}
              hourHeight={hourHeight}
              isSelected
              isResizing
              overrideStart={overrideStart}
              overrideEnd={overrideEnd}
            />
          </div>
        );
      })}
    </div>
  );
}

function TopEdgeOverlay({
  days,
  hourHeight,
  resizeState,
}: ResizePlaceholderOverlayProps) {
  const startDay = resizeState.currentStartDate;

  const startColIndex = days.findIndex((d) => isSameDay(d.date, startDay));
  const endColIndex = days.findIndex((d) =>
    isSameDay(d.date, resizeState.currentEndDate),
  );

  if (startColIndex === -1 || endColIndex === -1) return null;
  if (endColIndex <= startColIndex) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-0 grid pointer-events-none"
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, i) => {
        // Skip end column (handled by DayEventsColumn) and columns outside range
        if (i < startColIndex || i >= endColIndex) {
          return <div key={day.date.toISOString()} />;
        }

        const isStartColumn = i === startColIndex;
        const segmentPosition = isStartColumn
          ? ("start" as const)
          : ("middle" as const);

        const midnight = startOfDay(day.date);
        const overrideStart = isStartColumn
          ? resizeState.currentStart
          : midnight;
        const overrideEnd = addDays(midnight, 1);

        const positioned: PositionedEvent = {
          event: resizeState.event,
          top: 0,
          height: 0,
          left: 0,
          width: 92,
          column: 0,
          totalColumns: 1,
          segmentPosition,
        };

        return (
          <div key={day.date.toISOString()} className="relative">
            <CalendarEventItem
              positionedEvent={positioned}
              hourHeight={hourHeight}
              isSelected
              isResizing
              overrideStart={overrideStart}
              overrideEnd={overrideEnd}
            />
          </div>
        );
      })}
    </div>
  );
}

interface FloatingDragCopyProps {
  days: WeekViewGridProps["days"];
  hourHeight: number;
  dragState: EventDragState;
  gridWidth: number;
}

function FloatingDragCopy({
  days,
  hourHeight,
  dragState,
  gridWidth,
}: FloatingDragCopyProps) {
  const floatingPositioned: PositionedEvent = {
    event: dragState.event,
    top: 0,
    height: 0,
    left: 0,
    width: 92,
    column: 0,
    totalColumns: 1,
  };

  const durationMinutes =
    (dragState.currentEnd.getTime() - dragState.currentStart.getTime()) / 60000;
  const heightPx = (durationMinutes / 60) * hourHeight;
  const columnWidthPx =
    (days.length > 0 ? gridWidth / days.length : 200) * 0.92;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 9999,
      }}
    >
      <CalendarEventItem
        key={`${dragState.eventId}-dragging`}
        positionedEvent={floatingPositioned}
        hourHeight={hourHeight}
        dragVariant="dragging"
        overrideStart={dragState.currentStart}
        overrideEnd={dragState.currentEnd}
        cursorY={dragState.clientY}
        cursorX={dragState.clientX}
        fixedWidth={columnWidthPx}
        fixedHeight={heightPx}
      />
    </div>,
    document.body,
  );
}

interface DayEventsColumnProps extends EventItemPopoverProps {
  columnDate: Date;
  /** Accessible name: the column's full date */
  label: string;
  /**
   * Whether the column is on screen. Off-screen scroll buffer columns are
   * inert, so their events can't be tabbed to or read out.
   */
  isOnScreen: boolean;
  events: ReturnType<typeof calculatePositionedEvents>;
  hourHeight: number;
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  dragState?: EventDragState;
  onEventDragPointerDown?: WeekViewGridProps["onEventDragPointerDown"];
  resizeState?: EventResizeState;
  onEventResizePointerDown?: WeekViewGridProps["onEventResizePointerDown"];
  onEventChange?: (event: CalendarEvent) => void;
  onContextMenuOpenChange?: (open: boolean) => void;
  onColumnPointerDownCapture?: () => void;
  onColumnPointerDown?: (
    e: React.PointerEvent<HTMLDivElement>,
    columnDate: Date,
  ) => void;
  onColumnClick?: (
    e: React.MouseEvent<HTMLDivElement>,
    columnDate: Date,
  ) => void;
}

function renderColumnGhost(
  positionedEvent: PositionedEvent,
  hourHeight: number,
) {
  return (
    <CalendarEventItem
      key={`${positionedEvent.event.id}-ghost`}
      positionedEvent={positionedEvent}
      hourHeight={hourHeight}
      dragVariant="ghost"
    />
  );
}

function DayEventsColumn({
  columnDate,
  label,
  isOnScreen,
  events,
  hourHeight,
  onEventClick,
  selectedEventId,
  dragState,
  onEventDragPointerDown,
  resizeState,
  onEventResizePointerDown,
  onEventChange,
  onContextMenuOpenChange,
  showEventPopover,
  onEventPopoverExpand,
  onEventPopoverClose,
  onColumnPointerDownCapture,
  onColumnPointerDown,
  onColumnClick,
}: DayEventsColumnProps) {
  return (
    <div
      role="group"
      aria-label={label}
      inert={!isOnScreen}
      className="relative h-full pointer-events-auto"
      onPointerDownCapture={onColumnPointerDownCapture}
      onPointerDown={(e) => onColumnPointerDown?.(e, columnDate)}
      onClick={(e) => onColumnClick?.(e, columnDate)}
    >
      {events.map((positionedEvent) => {
        const eventId = positionedEvent.event.id;
        const isBeingDragged =
          dragState?.isDragging && dragState.eventId === eventId;

        if (isBeingDragged) {
          return renderColumnGhost(positionedEvent, hourHeight);
        }

        const isBeingResized =
          resizeState?.isResizing && resizeState.eventId === eventId;

        if (isBeingResized) {
          const { effectiveEdge, currentStartDate, currentEndDate } =
            resizeState;
          const isCrossDay = !isSameDay(currentStartDate, currentEndDate);

          // Determine if this column is the anchor column
          const isAnchorColumn =
            (effectiveEdge === "bottom" &&
              isSameDay(columnDate, currentStartDate)) ||
            (effectiveEdge === "top" && isSameDay(columnDate, currentEndDate));

          // Check if this column is within the new range at all
          const colTime = columnDate.getTime();
          const inRange =
            colTime >= currentStartDate.getTime() &&
            colTime <= currentEndDate.getTime();

          // Non-anchor columns with original segments: render as ghost
          // Columns outside new range with original segments: render as ghost
          if (!isAnchorColumn || !inRange) {
            return renderColumnGhost(positionedEvent, hourHeight);
          }

          // Anchor column rendering
          let displayStart: Date;
          let displayEnd: Date;
          let segmentPosition: "start" | "middle" | "end" | "full";

          if (!isCrossDay) {
            // Same day: show currentStart to currentEnd
            displayStart = resizeState.currentStart;
            displayEnd = resizeState.currentEnd;
            segmentPosition = "full";
          } else if (effectiveEdge === "bottom") {
            // Anchor is start column: show currentStart to end-of-day
            displayStart = resizeState.currentStart;
            displayEnd = addDays(startOfDay(columnDate), 1);
            segmentPosition = "start";
          } else {
            // Anchor is end column: show start-of-day to currentEnd
            displayStart = startOfDay(columnDate);
            displayEnd = resizeState.currentEnd;
            segmentPosition = "end";
          }

          const resizePositioned = { ...positionedEvent, segmentPosition };

          return (
            <React.Fragment key={eventId}>
              {renderColumnGhost(positionedEvent, hourHeight)}
              <CalendarEventItem
                key={`${eventId}-resizing`}
                positionedEvent={resizePositioned}
                hourHeight={hourHeight}
                isSelected={isCrossDay || eventId === selectedEventId}
                isResizing
                overrideStart={displayStart}
                overrideEnd={displayEnd}
                onEventChange={onEventChange}
              />
            </React.Fragment>
          );
        }

        return (
          <CalendarEventItem
            key={eventId}
            positionedEvent={positionedEvent}
            hourHeight={hourHeight}
            isSelected={eventId === selectedEventId}
            onClick={onEventClick}
            onDragPointerDown={onEventDragPointerDown}
            onResizePointerDown={onEventResizePointerDown}
            onEventChange={onEventChange}
            onContextMenuOpenChange={onContextMenuOpenChange}
            showEventPopover={showEventPopover}
            onEventPopoverExpand={onEventPopoverExpand}
            onEventPopoverClose={onEventPopoverClose}
          />
        );
      })}
    </div>
  );
}
