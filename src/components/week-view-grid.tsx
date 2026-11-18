"use client";

import React from "react";
import { createPortal } from "react-dom";
import { isSameDay, startOfDay, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useDoubleClick } from "@/hooks/use-double-click";
import {
  calculatePositionedEvents,
  formatFullDate,
  getClickedEventRange,
  getNewEventRange,
} from "@/lib/event-utils";
import { CalendarEventItem } from "./calendar-event-item";
import { useCalendarPopoverBoundary } from "./calendar-popover-context";
import { useCalendarConfig } from "./calendar-provider";
import { TimeGridEventDraft } from "./event-draft";
import {
  FreeTimeBlock,
  PersonEventItem,
  getDayFreeTimes,
} from "./week-view-people";
import type {
  CalendarEvent,
  EventDragState,
  EventItemPopoverProps,
  EventResizeState,
  PositionedEvent,
  TimeSpan,
  WeekViewGridProps,
} from "./week-view-types";

/**
 * Main grid displaying hour/day intersection cells with events
 * Each cell represents one hour in one day. Empty space creates events the
 * way Notion Calendar does: a double-click starts one at that slot
 * (`onEventCreate`), a press that drags draws one (`onEventDrawPointerDown`),
 * and a single click is left to the view, which clears the selection.
 */
export function WeekViewGrid({
  days,
  hours,
  hourHeight,
  events = [],
  onEventClick,
  selectedEventId,
  onEventCreate,
  onEventDrawPointerDown,
  onSlotHover,
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
  personEvents,
  freeTimes,
  visibleStartIndex = 0,
  visibleCount,
  className,
}: WeekViewGridProps) {
  const { view } = useCalendarPopoverBoundary();
  const config = useCalendarConfig();
  const isDayView = view === "day";
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = React.useState(0);
  const isDoubleClick = useDoubleClick();

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

  /** Minutes since midnight, by the clock, at a viewport Y position in a column */
  const getMinutesAt = React.useCallback(
    (column: HTMLElement, clientY: number) => {
      // The column's top edge is `dayStartHour`, not midnight
      const columnTop = column.getBoundingClientRect().top;
      return (
        config.dayStartHour * 60 + ((clientY - columnTop) / hourHeight) * 60
      );
    },
    [hourHeight, config.dayStartHour],
  );

  /** The slot at a viewport Y position in a column: where a paste lands */
  const getSlotRange = React.useCallback(
    (column: HTMLElement, columnDate: Date, clientY: number) =>
      getNewEventRange(columnDate, getMinutesAt(column, clientY), config),
    [getMinutesAt, config],
  );

  /**
   * Reports the mouse's slot, where a paste goes. Pointer moves in a
   * popover or menu bubble here through React portals: those are skipped,
   * since their DOM is outside the column.
   */
  const handleColumnPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>, columnDate: Date) => {
      if (!onSlotHover || e.pointerType !== "mouse") return;
      if (!(e.target instanceof Node)) return;
      if (!e.currentTarget.contains(e.target)) return;
      onSlotHover(getSlotRange(e.currentTarget, columnDate, e.clientY));
    },
    [onSlotHover, getSlotRange],
  );

  /**
   * A press on empty column space may become a drag that draws an event.
   * Mouse and pen draw once the pointer moves; touch draws after a long
   * press, so a swipe over empty space still scrolls.
   */
  const handleColumnPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>, columnDate: Date) => {
      if (e.target !== e.currentTarget) return;
      onEventDrawPointerDown?.(e, columnDate);
    },
    [onEventDrawPointerDown],
  );

  /**
   * A double-click on empty column space creates an event at that slot. A
   * single click is left to bubble, so the view's background click clears
   * the selection; the double-click's second click stops there instead,
   * since it has just selected the new event.
   */
  const handleColumnClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>, columnDate: Date) => {
      if (e.target !== e.currentTarget) return;
      if (!isDoubleClick(e) || !onEventCreate) return;

      e.stopPropagation();
      onEventCreate(
        getClickedEventRange(
          columnDate,
          getMinutesAt(e.currentTarget, e.clientY),
          config,
        ),
      );
    },
    [isDoubleClick, onEventCreate, getMinutesAt, config],
  );

  return (
    <div ref={gridRef} className={cn("relative select-none", className)}>
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

      {/* The event being created, under the events: its range, tinted */}
      <TimeGridEventDraft
        days={days}
        visibleStartIndex={visibleStartIndex}
        visibleCount={visibleCount}
      />

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
          // Other people's events sit behind yours, laid out among themselves
          const positionedPersonEvents = personEvents?.length
            ? calculatePositionedEvents(personEvents, day, config, 0)
            : undefined;

          return (
            <DayEventsColumn
              key={day.date.toISOString()}
              columnDate={day.date}
              label={formatFullDate(day.date, config.locale)}
              isOnScreen={isOnScreen}
              events={positionedEvents}
              personEvents={positionedPersonEvents}
              freeTimes={
                freeTimes?.length
                  ? getDayFreeTimes(freeTimes, day.date)
                  : undefined
              }
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
              onColumnPointerDown={handleColumnPointerDown}
              onColumnPointerMove={handleColumnPointerMove}
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
  /** Other people's events on this day, drawn behind yours */
  personEvents?: PositionedEvent[];
  /** Free time everyone shares on this day, drawn under the events */
  freeTimes?: TimeSpan[];
  hourHeight: number;
  onEventClick?: (event: CalendarEvent) => void;
  selectedEventId?: string;
  dragState?: EventDragState;
  onEventDragPointerDown?: WeekViewGridProps["onEventDragPointerDown"];
  resizeState?: EventResizeState;
  onEventResizePointerDown?: WeekViewGridProps["onEventResizePointerDown"];
  onEventChange?: (event: CalendarEvent) => void;
  onContextMenuOpenChange?: (open: boolean) => void;
  onColumnPointerDown?: (
    e: React.PointerEvent<HTMLDivElement>,
    columnDate: Date,
  ) => void;
  onColumnPointerMove?: (
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
  personEvents,
  freeTimes,
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
  onColumnPointerDown,
  onColumnPointerMove,
  onColumnClick,
}: DayEventsColumnProps) {
  return (
    <div
      role="group"
      aria-label={label}
      inert={!isOnScreen}
      className="relative h-full pointer-events-auto"
      onPointerDown={(e) => onColumnPointerDown?.(e, columnDate)}
      onPointerMove={(e) => onColumnPointerMove?.(e, columnDate)}
      onClick={(e) => onColumnClick?.(e, columnDate)}
    >
      {freeTimes?.map((span) => (
        <FreeTimeBlock
          key={span.start.toISOString()}
          span={span}
          hourHeight={hourHeight}
        />
      ))}
      {personEvents?.map((positionedEvent) => (
        <PersonEventItem
          key={positionedEvent.event.id}
          positionedEvent={positionedEvent}
          hourHeight={hourHeight}
        />
      ))}
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
