"use client";

import * as React from "react";
import { isSameDay } from "date-fns";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  isPrimaryPress,
  suppressNextClick,
  usePointerGesture,
} from "@/hooks/use-pointer-gesture";
import { eventColorStyles } from "@/components/calendar-event-item";
import { useCalendarConfig } from "@/components/calendar-provider";
import { useScheduling } from "@/components/scheduling-provider";
import {
  atMinutesOfDay,
  formatAvailabilityTimeRange,
  getRangeMinutes,
} from "@/lib/availability";
import { formatFullDate } from "@/lib/event-utils";
import type {
  AvailabilityRange,
  EventColor,
  PointerGestureStart,
} from "@/components/calendar-types";
import type { AvailabilityLayerProps } from "@/components/week-view-types";

/**
 * Pointer travel (px) before a press counts as a drag, as for events. A
 * press that moves less marks one meeting length, or selects a marked time
 */
const DRAG_THRESHOLD_PX = 4;

/** Color of the marked times' edge when the app has no calendars */
const DEFAULT_ACCENT_COLOR: EventColor = "blue";

/**
 * The layer's place in the z-index scale: over the events (0-2) and a
 * selected event (20), under drag placeholders (25) and dragging copies (30)
 */
const LAYER_Z_CLASS = "z-[22]";

/**
 * Notion Calendar's diagonal hatch over the times not marked open: faint
 * lines that let the events show through
 */
const HATCH_CLASS =
  "[--availability-hatch:rgb(55_53_47/0.13)] dark:[--availability-hatch:rgb(255_255_255/0.08)] bg-[repeating-linear-gradient(135deg,var(--availability-hatch)_0_1px,transparent_1px_7px)]";

/** What a press on the layer does as the pointer moves */
type PickMode = "create" | "move" | "resize-start" | "resize-end";

/** A press being dragged across the layer */
interface PickDrag {
  mode: PickMode;
  pointerType: string;
  /** The marked time moved or resized; `null` while creating one */
  rangeId: string | null;
  /** Column the time is in now, an index of `days` */
  dayIndex: number;
  startClientX: number;
  startClientY: number;
  /**
   * Create: the pressed slot's start. Resize: the edge that stays. Move:
   * minutes from the time's start to the pointer
   */
  anchorMinutes: number;
  /** Length of the time being moved, in minutes */
  lengthMinutes: number;
  /** The time as it is now, in minutes of its day */
  startMinutes: number;
  endMinutes: number;
  /** Whether the pointer went past `DRAG_THRESHOLD_PX` */
  moved: boolean;
}

/** A stretch of a column, in minutes of the day */
interface MinuteSpan {
  startMinutes: number;
  endMinutes: number;
}

/** The stretches of [from, to) no span covers: where the hatch shows */
function getUncoveredSpans(
  spans: MinuteSpan[],
  from: number,
  to: number,
): MinuteSpan[] {
  const sorted = [...spans].sort((a, b) => a.startMinutes - b.startMinutes);
  const gaps: MinuteSpan[] = [];
  let cursor = from;
  for (const span of sorted) {
    if (span.startMinutes > cursor) {
      gaps.push({ startMinutes: cursor, endMinutes: span.startMinutes });
    }
    cursor = Math.max(cursor, span.endMinutes);
  }
  if (cursor < to) gaps.push({ startMinutes: cursor, endMinutes: to });
  return gaps;
}

/**
 * The time grid's layer for marking open times, shown while scheduling
 * (`useScheduling().isPicking`): a hatch over the times not marked, and
 * the marked times as blocks. Press and drag on a day to mark a time (a
 * click marks one meeting length), drag a block to move it, its top or
 * bottom edge to resize it, and its × to remove it. Touch starts each with
 * a long press, so a swipe still scrolls. It covers the events, so they
 * can't be dragged or opened while times are marked.
 */
export function AvailabilityLayer({
  days,
  hourHeight,
  visibleStartIndex,
  visibleCount,
  className,
}: AvailabilityLayerProps) {
  const scheduling = useScheduling();
  const {
    dayStartHour,
    dayEndHour,
    snapMinutes,
    hourCycle,
    locale,
    calendars,
  } = useCalendarConfig();
  const layerRef = React.useRef<HTMLDivElement>(null);
  const { startGesture } = usePointerGesture({ containerRef: layerRef });
  const [drag, setDrag] = React.useState<PickDrag | null>(null);
  /** The running drag, read by the window listeners */
  const dragRef = React.useRef<PickDrag | null>(null);
  const handlePointerMoveRef = React.useRef<((e: PointerEvent) => void) | null>(
    null,
  );
  const handlePointerUpRef = React.useRef<((e: PointerEvent) => void) | null>(
    null,
  );

  const firstMinute = dayStartHour * 60;
  const lastMinute = dayEndHour * 60;
  // Notion Calendar edges the marked times in the default calendar's color
  const accent = eventColorStyles[calendars[0]?.color ?? DEFAULT_ACCENT_COLOR];

  /** Minutes of the day at a viewport Y position, unsnapped */
  const minutesAt = React.useCallback(
    (clientY: number) => {
      const top = layerRef.current?.getBoundingClientRect().top ?? 0;
      return firstMinute + ((clientY - top) / hourHeight) * 60;
    },
    [firstMinute, hourHeight],
  );

  /** The on-screen column at a viewport X position */
  const dayIndexAt = React.useCallback(
    (clientX: number) => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect || days.length === 0) return visibleStartIndex;
      const index = Math.floor(
        ((clientX - rect.left) / rect.width) * days.length,
      );
      return Math.min(
        Math.max(index, visibleStartIndex),
        visibleStartIndex + visibleCount - 1,
      );
    },
    [days.length, visibleStartIndex, visibleCount],
  );

  /** A minute snapped to the slot grid and kept inside the visible hours */
  const snap = React.useCallback(
    (minutes: number, round: "down" | "nearest", min: number, max: number) => {
      const slots = minutes / snapMinutes;
      const snapped =
        (round === "down" ? Math.floor(slots) : Math.round(slots)) *
        snapMinutes;
      return Math.min(Math.max(snapped, min), max);
    },
    [snapMinutes],
  );

  const updateDrag = React.useCallback((next: PickDrag | null) => {
    dragRef.current = next;
    setDrag(next);
  }, []);

  /** The drag's time after the pointer moved to (clientX, clientY) */
  const followPointer = React.useCallback(
    (current: PickDrag, clientX: number, clientY: number): PickDrag => {
      const minutes = minutesAt(clientY);
      const moved =
        current.moved ||
        Math.hypot(
          clientX - current.startClientX,
          clientY - current.startClientY,
        ) > DRAG_THRESHOLD_PX;

      if (current.mode === "create") {
        const slot = snap(
          minutes,
          "down",
          firstMinute,
          lastMinute - snapMinutes,
        );
        return {
          ...current,
          moved,
          startMinutes: Math.min(current.anchorMinutes, slot),
          endMinutes: Math.max(current.anchorMinutes, slot) + snapMinutes,
        };
      }
      if (current.mode === "resize-start") {
        const startMinutes = snap(
          minutes,
          "nearest",
          firstMinute,
          current.anchorMinutes - snapMinutes,
        );
        return { ...current, moved, startMinutes };
      }
      if (current.mode === "resize-end") {
        const endMinutes = snap(
          minutes,
          "nearest",
          current.anchorMinutes + snapMinutes,
          lastMinute,
        );
        return { ...current, moved, endMinutes };
      }
      const startMinutes = snap(
        minutes - current.anchorMinutes,
        "nearest",
        firstMinute,
        lastMinute - current.lengthMinutes,
      );
      return {
        ...current,
        moved,
        dayIndex: dayIndexAt(clientX),
        startMinutes,
        endMinutes: startMinutes + current.lengthMinutes,
      };
    },
    [minutesAt, snap, firstMinute, lastMinute, snapMinutes, dayIndexAt],
  );

  /** Commits the finished drag: marks, moves or resizes a time, or selects it */
  const finishDrag = React.useCallback(
    (finished: PickDrag) => {
      if (!scheduling) return;
      const day = days[finished.dayIndex]?.date;
      if (!day) return;

      if (finished.mode === "create") {
        // A click marks one meeting length from the pressed slot
        const startMinutes = finished.moved
          ? finished.startMinutes
          : finished.anchorMinutes;
        const endMinutes = finished.moved
          ? finished.endMinutes
          : Math.min(startMinutes + scheduling.durationMinutes, lastMinute);
        scheduling.addRange({
          start: atMinutesOfDay(day, startMinutes),
          end: atMinutesOfDay(day, endMinutes),
        });
        return;
      }
      if (!finished.rangeId) return;
      if (!finished.moved) {
        scheduling.selectRange(finished.rangeId);
        return;
      }
      scheduling.updateRange({
        id: finished.rangeId,
        start: atMinutesOfDay(day, finished.startMinutes),
        end: atMinutesOfDay(day, finished.endMinutes),
      });
    },
    [scheduling, days, lastMinute],
  );

  const stopListening = React.useCallback(() => {
    if (handlePointerMoveRef.current) {
      window.removeEventListener("pointermove", handlePointerMoveRef.current);
    }
    if (handlePointerUpRef.current) {
      window.removeEventListener("pointerup", handlePointerUpRef.current);
      window.removeEventListener("pointercancel", handlePointerUpRef.current);
    }
  }, []);

  React.useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      const current = dragRef.current;
      if (!current) return;
      updateDrag(followPointer(current, e.clientX, e.clientY));
    };
    handlePointerUpRef.current = (e: PointerEvent) => {
      const current = dragRef.current;
      stopListening();
      updateDrag(null);
      if (!current || e.type === "pointercancel") return;
      finishDrag(followPointer(current, e.clientX, e.clientY));
      // The click after the press would land on the grid behind the layer
      suppressNextClick(current.pointerType);
    };
  }, [followPointer, finishDrag, stopListening, updateDrag]);

  // A drag still running when the layer goes away stops listening
  React.useEffect(() => stopListening, [stopListening]);

  /** Starts a drag from a gesture's first point */
  const beginDrag = React.useCallback(
    (
      start: PointerGestureStart,
      init: Omit<
        PickDrag,
        "pointerType" | "startClientX" | "startClientY" | "moved"
      >,
    ) => {
      updateDrag({
        ...init,
        pointerType: start.pointerType,
        startClientX: start.clientX,
        startClientY: start.clientY,
        moved: false,
      });
      if (handlePointerMoveRef.current) {
        window.addEventListener("pointermove", handlePointerMoveRef.current);
      }
      if (handlePointerUpRef.current) {
        window.addEventListener("pointerup", handlePointerUpRef.current);
        window.addEventListener("pointercancel", handlePointerUpRef.current);
      }
    },
    [updateDrag],
  );

  /** A press on a day's free space: marks a new time from the pressed slot */
  const handleColumnPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>, dayIndex: number) => {
      if (e.target !== e.currentTarget) return;
      if (e.pointerType !== "touch" && !isPrimaryPress(e)) return;
      if (e.pointerType !== "touch") e.preventDefault();
      startGesture(e, (start) => {
        const slot = snap(
          minutesAt(start.clientY),
          "down",
          firstMinute,
          lastMinute - snapMinutes,
        );
        beginDrag(start, {
          mode: "create",
          rangeId: null,
          dayIndex,
          anchorMinutes: slot,
          lengthMinutes: snapMinutes,
          startMinutes: slot,
          endMinutes: slot + snapMinutes,
        });
      });
    },
    [
      startGesture,
      snap,
      minutesAt,
      firstMinute,
      lastMinute,
      snapMinutes,
      beginDrag,
    ],
  );

  /** A press on a marked time: moves it, or resizes it from an edge */
  const handleRangePointerDown = React.useCallback(
    (
      e: React.PointerEvent<HTMLElement>,
      range: AvailabilityRange,
      dayIndex: number,
      mode: Exclude<PickMode, "create">,
    ) => {
      e.stopPropagation();
      if (e.pointerType !== "touch" && !isPrimaryPress(e)) return;
      if (e.pointerType !== "touch") e.preventDefault();
      const { startMinutes, endMinutes } = getRangeMinutes(range);
      startGesture(e, (start) => {
        const anchorByMode: Record<Exclude<PickMode, "create">, number> = {
          move: minutesAt(start.clientY) - startMinutes,
          "resize-start": endMinutes,
          "resize-end": startMinutes,
        };
        beginDrag(start, {
          mode,
          rangeId: range.id,
          dayIndex,
          anchorMinutes: anchorByMode[mode],
          lengthMinutes: endMinutes - startMinutes,
          startMinutes,
          endMinutes,
        });
      });
    },
    [startGesture, minutesAt, beginDrag],
  );

  if (!scheduling?.isPicking) return null;

  /** Top and height in px of a stretch of the day */
  const spanStyle = (span: MinuteSpan): React.CSSProperties => ({
    top: ((span.startMinutes - firstMinute) / 60) * hourHeight,
    height: ((span.endMinutes - span.startMinutes) / 60) * hourHeight,
  });

  return (
    <div
      ref={layerRef}
      data-testid="availability-layer"
      className={cn(
        "absolute inset-0 grid select-none",
        LAYER_Z_CLASS,
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
    >
      {days.map((day, dayIndex) => {
        const isOnScreen =
          dayIndex >= visibleStartIndex &&
          dayIndex < visibleStartIndex + visibleCount;
        const dayRanges = scheduling.ranges.filter(
          (range) =>
            isSameDay(range.start, day.date) && range.id !== drag?.rangeId,
        );
        const preview =
          drag && drag.dayIndex === dayIndex
            ? { startMinutes: drag.startMinutes, endMinutes: drag.endMinutes }
            : null;
        const covered: MinuteSpan[] = dayRanges.map(getRangeMinutes);
        if (preview) covered.push(preview);
        const gaps = getUncoveredSpans(covered, firstMinute, lastMinute);
        const dayLabel = formatFullDate(day.date, locale);

        return (
          <div
            key={day.date.toISOString()}
            role="group"
            aria-label={`Mark available times on ${dayLabel}`}
            inert={!isOnScreen}
            className="relative h-full cursor-cell"
            onPointerDown={(e) => handleColumnPointerDown(e, dayIndex)}
          >
            {gaps.map((gap) => (
              <div
                key={gap.startMinutes}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-x-0",
                  HATCH_CLASS,
                )}
                style={spanStyle(gap)}
              />
            ))}
            {dayRanges.map((range) => {
              const timeLabel = formatAvailabilityTimeRange(
                range,
                hourCycle,
                locale,
              );
              const isSelected = scheduling.selectedRangeId === range.id;
              return (
                <div
                  key={range.id}
                  role="group"
                  aria-label={`Available ${dayLabel}, ${timeLabel}`}
                  data-selected={isSelected || undefined}
                  className={cn(
                    "group/range absolute inset-x-0 cursor-grab rounded-sm border border-transparent",
                    isSelected && accent.borderLine,
                  )}
                  style={spanStyle(getRangeMinutes(range))}
                  onPointerDown={(e) =>
                    handleRangePointerDown(e, range, dayIndex, "move")
                  }
                >
                  <div
                    aria-hidden
                    className={cn(
                      "absolute top-0.5 bottom-0.5 left-0.5 w-1 rounded-full",
                      accent.border,
                    )}
                  />
                  <p className="text-muted-foreground pointer-events-none truncate pt-0.5 pr-6 pl-3 text-[11px] leading-4 font-medium">
                    {timeLabel}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${timeLabel}`}
                    className={cn(
                      "text-muted-foreground hover:bg-foreground/10 hover:text-foreground absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-sm opacity-0 transition-opacity group-hover/range:opacity-100 focus-visible:opacity-100",
                      isSelected && "opacity-100",
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      scheduling.removeRange(range.id);
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                  <div
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize"
                    onPointerDown={(e) =>
                      handleRangePointerDown(e, range, dayIndex, "resize-start")
                    }
                  />
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize"
                    onPointerDown={(e) =>
                      handleRangePointerDown(e, range, dayIndex, "resize-end")
                    }
                  />
                </div>
              );
            })}
            {preview && (
              <div
                aria-hidden
                data-testid="availability-preview"
                className={cn(
                  "pointer-events-none absolute inset-x-0 rounded-sm border",
                  accent.borderLine,
                )}
                style={spanStyle(preview)}
              >
                <div
                  className={cn(
                    "absolute top-0.5 bottom-0.5 left-0.5 w-1 rounded-full",
                    accent.border,
                  )}
                />
                <p className="text-muted-foreground truncate pt-0.5 pl-3 text-[11px] leading-4 font-medium">
                  {formatAvailabilityTimeRange(
                    {
                      start: atMinutesOfDay(day.date, preview.startMinutes),
                      end: atMinutesOfDay(day.date, preview.endMinutes),
                    },
                    hourCycle,
                    locale,
                  )}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
