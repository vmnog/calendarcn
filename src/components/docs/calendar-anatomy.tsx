"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { EVENT_COLOR_CLASSES } from "@/components/calendar-event-item";
import type { EventColor } from "@/components/calendar-types";
import { getEventColorStyle } from "@/lib/event-utils";

/** Width of the drawn week grid, in px */
const ANATOMY_WIDTH = 420;

/** Height of the drawn week grid, in px */
const ANATOMY_HEIGHT = 280;

/** Width of the time axis on the left, in px (the real one is `w-16`, scaled down) */
const ANATOMY_AXIS_WIDTH = 44;

/** Height of the day headers, in px */
const ANATOMY_HEADER_HEIGHT = 36;

/** Height of the all-day row, in px */
const ANATOMY_ALL_DAY_HEIGHT = 26;

/** First hour the drawing shows */
const ANATOMY_FIRST_HOUR = 9;

/** Hours the drawing shows */
const ANATOMY_HOURS = 6;

/** Days the drawing shows */
const ANATOMY_DAYS = [
  { weekday: "Wed", date: 3 },
  { weekday: "Thu", date: 4 },
  { weekday: "Fri", date: 5 },
];

/** The drawing's today: Thursday, the middle column */
const ANATOMY_TODAY = 1;

/** Where the now line sits, in hours from the first hour */
const ANATOMY_NOW_HOURS = 2.4;

/** The drawing's three timed events: day index, start and length in hours */
const ANATOMY_EVENTS: {
  title: string;
  day: number;
  start: number;
  length: number;
  color: EventColor;
}[] = [
  { title: "Team standup", day: 0, start: 0.5, length: 1, color: "blue" },
  { title: "Customer call", day: 1, start: 3, length: 1.5, color: "green" },
  { title: "Focus time", day: 2, start: 1, length: 2.5, color: "purple" },
];

/** Slider value the page opens on: a little apart, so the idea shows at once */
const ANATOMY_DEFAULT_SPREAD = 40;

/** Distance between two layers along Z, in px per slider step */
const ANATOMY_Z_PER_STEP = 0.6;

/** Tilt of the fully separated stack, in degrees */
const ANATOMY_TILT_X = 55;

/** Turn of the fully separated stack, in degrees */
const ANATOMY_TILT_Z = -35;

/** How far the separated stack moves down, in px: the layers rise toward the reader */
const ANATOMY_DROP = 95;

/** How much the separated stack shrinks, so its top layers stay in the frame */
const ANATOMY_SHRINK = 0.3;

/** Height of the stage the stack stands on, in px */
const ANATOMY_STAGE_HEIGHT = 440;

/** Height of the grid's body: below the header and the all-day row, in px */
const BODY_HEIGHT =
  ANATOMY_HEIGHT - ANATOMY_HEADER_HEIGHT - ANATOMY_ALL_DAY_HEIGHT;

/** Height of one hour, in px */
const HOUR_HEIGHT = BODY_HEIGHT / ANATOMY_HOURS;

/** Width of one day column, in px */
const DAY_WIDTH = (ANATOMY_WIDTH - ANATOMY_AXIS_WIDTH) / ANATOMY_DAYS.length;

/** Top of the grid's body, in px */
const BODY_TOP = ANATOMY_HEADER_HEIGHT + ANATOMY_ALL_DAY_HEIGHT;

/** One layer of the drawing: what it is, the file that draws it, and its look */
interface AnatomyLayer {
  id: string;
  name: string;
  file: string;
  Drawing: () => React.ReactNode;
}

/** Hour and day lines (`week-view-grid.tsx`) */
function GridLinesDrawing() {
  return (
    <>
      {/* The back layer carries the page: the ones above stay see-through */}
      <div className="absolute inset-0 rounded-[inherit] bg-background" />
      {Array.from({ length: ANATOMY_HOURS + 1 }, (_, hour) => (
        <div
          key={`hour-${hour}`}
          className="absolute right-0 border-t border-border"
          style={{
            top: BODY_TOP + hour * HOUR_HEIGHT,
            left: ANATOMY_AXIS_WIDTH,
          }}
        />
      ))}
      {ANATOMY_DAYS.map((day, index) => (
        <div
          key={`day-${day.date}`}
          className="absolute bottom-0 border-l border-border"
          style={{ top: 0, left: ANATOMY_AXIS_WIDTH + index * DAY_WIDTH }}
        />
      ))}
    </>
  );
}

/** The day columns, today's tinted (`week-view-grid.tsx`) */
function DayColumnsDrawing() {
  return (
    <>
      {ANATOMY_DAYS.map((day, index) => (
        <div
          key={day.date}
          className={cn("absolute", index === ANATOMY_TODAY && "bg-muted/60")}
          style={{
            top: BODY_TOP,
            bottom: 0,
            left: ANATOMY_AXIS_WIDTH + index * DAY_WIDTH,
            width: DAY_WIDTH,
          }}
        />
      ))}
    </>
  );
}

/** Hour labels on the left (`week-view-time-axis.tsx`) */
function TimeAxisDrawing() {
  return (
    <div
      className="absolute left-0 text-right text-xxs text-muted-foreground"
      style={{ top: BODY_TOP, width: ANATOMY_AXIS_WIDTH, height: BODY_HEIGHT }}
    >
      {Array.from({ length: ANATOMY_HOURS }, (_, index) => {
        const hour = ANATOMY_FIRST_HOUR + index;
        if (index === 0) return null;
        return (
          <span
            key={hour}
            className="absolute right-1.5 -translate-y-1/2 leading-none whitespace-nowrap"
            style={{ top: index * HOUR_HEIGHT }}
          >
            {hour > 12 ? hour - 12 : hour} {hour >= 12 ? "PM" : "AM"}
          </span>
        );
      })}
    </div>
  );
}

/** The timed events (`calendar-event-item.tsx`) */
function EventsDrawing() {
  return (
    <>
      {ANATOMY_EVENTS.map((event) => (
        <div
          key={event.title}
          className={cn(
            "absolute flex overflow-hidden rounded-sm",
            EVENT_COLOR_CLASSES.bg,
          )}
          style={{
            ...getEventColorStyle(event.color),
            top: BODY_TOP + event.start * HOUR_HEIGHT + 1,
            height: event.length * HOUR_HEIGHT - 2,
            left: ANATOMY_AXIS_WIDTH + event.day * DAY_WIDTH + 2,
            width: DAY_WIDTH - 5,
          }}
        >
          <div className={cn("w-[3px] shrink-0", EVENT_COLOR_CLASSES.border)} />
          {/* Sized on its own element: `cn` would drop the size beside `text-event` */}
          <span className="truncate px-1.5 py-1 text-xxs font-medium">
            <span className={EVENT_COLOR_CLASSES.text}>{event.title}</span>
          </span>
        </div>
      ))}
    </>
  );
}

/** The red line at the current time (`week-view-time-indicator.tsx`) */
function NowLineDrawing() {
  return (
    <div
      className="absolute flex items-center"
      style={{
        top: BODY_TOP + ANATOMY_NOW_HOURS * HOUR_HEIGHT,
        left: ANATOMY_AXIS_WIDTH + ANATOMY_TODAY * DAY_WIDTH,
        width: DAY_WIDTH,
      }}
    >
      <div className="h-3 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
      <div className="h-px flex-1 -translate-y-1/2 bg-primary" />
    </div>
  );
}

/** The all-day row under the headers (`week-view-all-day-row.tsx`) */
function AllDayRowDrawing() {
  return (
    <div
      className="absolute right-0 left-0 border-b border-border bg-background"
      style={{ top: ANATOMY_HEADER_HEIGHT, height: ANATOMY_ALL_DAY_HEIGHT }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 pr-1.5 text-right text-xxs text-muted-foreground"
        style={{ width: ANATOMY_AXIS_WIDTH }}
      >
        All day
      </span>
      <div
        className={cn(
          "absolute top-1 bottom-1 flex items-center rounded-sm px-1.5 text-xxs font-medium",
          EVENT_COLOR_CLASSES.bg,
        )}
        style={{
          ...getEventColorStyle("orange"),
          left: ANATOMY_AXIS_WIDTH + DAY_WIDTH + 2,
          width: DAY_WIDTH * 2 - 5,
        }}
      >
        <span className={EVENT_COLOR_CLASSES.text}>Product offsite</span>
      </div>
    </div>
  );
}

/** Weekday and date above each column (`calendar-day-headers.tsx`) */
function HeaderDrawing() {
  return (
    <div
      className="absolute top-0 right-0 left-0 flex rounded-t-[inherit] border-b border-border bg-background"
      style={{ height: ANATOMY_HEADER_HEIGHT, paddingLeft: ANATOMY_AXIS_WIDTH }}
    >
      {ANATOMY_DAYS.map((day, index) => (
        <div
          key={day.date}
          className="flex flex-1 items-center justify-center gap-1 text-xs"
        >
          <span className="text-muted-foreground">{day.weekday}</span>
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-sm font-medium",
              index === ANATOMY_TODAY
                ? "bg-primary text-primary-foreground"
                : "text-foreground",
            )}
          >
            {day.date}
          </span>
        </div>
      ))}
    </div>
  );
}

/** The layers, back to front */
const ANATOMY_LAYERS: AnatomyLayer[] = [
  {
    id: "grid-lines",
    name: "Grid lines",
    file: "week-view-grid.tsx",
    Drawing: GridLinesDrawing,
  },
  {
    id: "day-columns",
    name: "Day columns",
    file: "week-view-grid.tsx",
    Drawing: DayColumnsDrawing,
  },
  {
    id: "time-axis",
    name: "Time axis",
    file: "week-view-time-axis.tsx",
    Drawing: TimeAxisDrawing,
  },
  {
    id: "events",
    name: "Events",
    file: "calendar-event-item.tsx",
    Drawing: EventsDrawing,
  },
  {
    id: "now-line",
    name: "Now line",
    file: "week-view-time-indicator.tsx",
    Drawing: NowLineDrawing,
  },
  {
    id: "all-day-row",
    name: "All-day row",
    file: "week-view-all-day-row.tsx",
    Drawing: AllDayRowDrawing,
  },
  {
    id: "header",
    name: "Day headers",
    file: "calendar-day-headers.tsx",
    Drawing: HeaderDrawing,
  },
];

/**
 * The time grid taken apart: a drawing of a three-day week (plain divs with
 * the real grid's tokens, not the grid itself) as seven stacked layers. The
 * slider tilts the stack and pulls the layers apart, each labelled with the
 * file that draws it; hovering or focusing a label lights its layer.
 */
export function CalendarAnatomy() {
  const [spread, setSpread] = React.useState(ANATOMY_DEFAULT_SPREAD);
  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(null);
  const sliderId = React.useId();

  const amount = spread / 100;
  const stackTransform = `translateY(${ANATOMY_DROP * amount}px) scale(${1 - ANATOMY_SHRINK * amount}) rotateX(${ANATOMY_TILT_X * amount}deg) rotateZ(${ANATOMY_TILT_Z * amount}deg)`;
  // The labels turn back toward the reader, so the tilt doesn't squash them
  const labelTransform = `rotateZ(${-ANATOMY_TILT_Z * amount}deg) rotateX(${-ANATOMY_TILT_X * amount}deg)`;

  return (
    <figure
      data-anatomy
      className="docs-surface not-prose my-6 overflow-hidden rounded-xl bg-fd-card"
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: ANATOMY_STAGE_HEIGHT, perspective: 1600 }}
      >
        <div
          className="relative shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none max-sm:-translate-x-16 max-sm:scale-[0.7]"
          style={{
            width: ANATOMY_WIDTH,
            height: ANATOMY_HEIGHT,
            transform: stackTransform,
            transformStyle: "preserve-3d",
          }}
        >
          {ANATOMY_LAYERS.map((layer, index) => {
            const isActive = activeLayerId === layer.id;
            const isDimmed = activeLayerId !== null && !isActive;
            return (
              <div
                key={layer.id}
                data-anatomy-layer={layer.id}
                data-active={isActive || undefined}
                className={cn(
                  "absolute inset-0 rounded-lg transition-[transform,opacity,box-shadow] duration-300 ease-out motion-reduce:transition-none",
                  isDimmed && "opacity-25",
                  isActive && "shadow-[0_0_0_2px_var(--color-fd-primary)]",
                )}
                style={{
                  transform: `translateZ(${index * spread * ANATOMY_Z_PER_STEP}px)`,
                  transformStyle: "preserve-3d",
                  // Each plane's edge shows once the layers come apart
                  outline:
                    spread > 0
                      ? `1px dashed color-mix(in oklab, var(--color-fd-muted-foreground) ${Math.round(amount * 60)}%, transparent)`
                      : undefined,
                }}
              >
                <layer.Drawing />
                <span
                  aria-hidden
                  data-anatomy-tag={layer.id}
                  className={cn(
                    "pointer-events-none absolute top-1/2 left-full ml-8 -translate-y-1/2 origin-left rounded-md bg-fd-background px-2 py-1 font-mono text-[11px] whitespace-nowrap text-fd-foreground shadow-(--shadow-border) transition-opacity duration-300 motion-reduce:transition-none",
                    spread < 15 ? "opacity-0" : "opacity-100",
                  )}
                  style={{ transform: labelTransform }}
                >
                  {layer.file}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="flex flex-col gap-4 border-t border-fd-border p-4">
        <div className="flex items-center gap-4">
          <label
            htmlFor={sliderId}
            className="shrink-0 text-sm font-medium text-fd-foreground"
          >
            Separate the layers
          </label>
          <input
            id={sliderId}
            type="range"
            data-anatomy-slider
            min={0}
            max={100}
            step={1}
            value={spread}
            onChange={(e) => setSpread(Number(e.target.value))}
            className="h-1.5 min-w-0 flex-1 cursor-pointer accent-fd-primary"
          />
          <span className="w-8 text-right font-mono text-xs text-fd-muted-foreground tabular-nums">
            {spread}
          </span>
        </div>
        <ol className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {[...ANATOMY_LAYERS].reverse().map((layer) => (
            <li key={layer.id}>
              <button
                type="button"
                data-anatomy-label={layer.id}
                onPointerEnter={() => setActiveLayerId(layer.id)}
                onPointerLeave={() => setActiveLayerId(null)}
                onFocus={() => setActiveLayerId(layer.id)}
                onBlur={() => setActiveLayerId(null)}
                className={cn(
                  "flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-fd-accent focus-visible:bg-fd-accent focus-visible:outline-none",
                  activeLayerId === layer.id && "bg-fd-accent",
                )}
              >
                <span className="text-fd-foreground">{layer.name}</span>
                <span className="truncate font-mono text-xs text-fd-muted-foreground">
                  {layer.file}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
