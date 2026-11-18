"use client";

import * as React from "react";
import { addDays, addHours } from "date-fns";

import { cn } from "@/lib/utils";
import { Calendar } from "@/components/calendar";
import { useCalendar } from "@/components/calendar-provider";
import { createSampleEvents } from "@/lib/sample-events";

/**
 * The sample event the script drags: Wednesday's customer call, 2 to 3 PM.
 * If the sample data drops it, the script does nothing and the hint shows.
 */
const HERO_EVENT_ID = "sample-customer-call";

/** Length of the drag, the script's longest step, in ms */
const HERO_STEP_MS = 700;

/** How long the cursor takes to glide onto the event, in ms */
const HERO_GLIDE_MS = 600;

/** Fades and presses: the cursor appearing, pressing, releasing, leaving, in ms */
const HERO_FADE_MS = 200;

/** Pause after the hero comes into view, before the cursor shows, in ms */
const HERO_START_DELAY_MS = 500;

/** How long the opened details stay with the cursor before it leaves, in ms */
const HERO_LOOK_MS = 900;

/** Height of the hero's calendar, in px */
const HERO_HEIGHT = 520;

/** Hour the grid starts scrolled to: the customer call and its target show */
const HERO_SCROLL_HOUR = 11;

/** Share of the hero that must be on screen before the script plays */
const HERO_VISIBLE_THRESHOLD = 0.5;

/** The docs' ease-out (a strong one, as `--ease-out` in transitions.dev) */
const HERO_EASE = "cubic-bezier(0.23, 1, 0.32, 1)";

/** Day columns of the time grid: the ones on screen, not the scroll buffer */
const DAY_COLUMN_SELECTOR = '[role="group"][aria-label]:not([inert])';

/** Hours in a day column, to turn its height into an hour's */
const HOURS_PER_DAY = 24;

/**
 * Where the script is: waiting to come into view, playing, handed over
 * (the hint shows), or touched (someone pressed in the calendar)
 */
type HeroPhase = "waiting" | "playing" | "handed" | "touched";

/**
 * The Introduction's opening: a week view that plays one move by itself
 * when it first scrolls into view (a cursor drags an event one day right
 * and one hour down, then opens its details) and hands over with a hint.
 * Pressing anywhere in it first stops the script and gives control at once.
 * Under reduced motion only the hint shows.
 */
export function PlayableHero() {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const cursorRef = React.useRef<HTMLDivElement>(null);
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));
  const [phase, setPhase] = React.useState<HeroPhase>("waiting");

  // Plays once, when at least half the hero is on screen
  React.useEffect(() => {
    const root = rootRef.current;
    if (phase !== "waiting" || !root) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("handed");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setPhase("playing");
      },
      { threshold: HERO_VISIBLE_THRESHOLD },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [phase]);

  // A real press stops the script, or hides the hint after it
  React.useEffect(() => {
    const root = rootRef.current;
    if (phase === "touched" || !root) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.isTrusted) setPhase("touched");
    };
    root.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      root.removeEventListener("pointerdown", handlePointerDown, true);
  }, [phase]);

  const handleScriptEnd = React.useCallback(() => {
    setPhase((current) => (current === "playing" ? "handed" : current));
  }, []);

  return (
    <div className="docs-wide not-prose my-6">
      <div
        ref={rootRef}
        data-hero
        data-phase={phase}
        className="docs-surface docs-preview relative isolate overflow-hidden rounded-xl bg-background text-foreground"
        style={{ height: HERO_HEIGHT }}
      >
        <Calendar
          defaultEvents={initialEvents}
          defaultView="week"
          scrollToHour={HERO_SCROLL_HOUR}
        >
          <HeroScript
            isPlaying={phase === "playing"}
            rootRef={rootRef}
            cursorRef={cursorRef}
            onEnd={handleScriptEnd}
          />
        </Calendar>
        <HeroCursor ref={cursorRef} />
      </div>
      <div className="mt-3 flex justify-center">
        <p
          data-hero-hint
          aria-hidden={phase !== "handed"}
          className={cn(
            "rounded-full bg-fd-secondary px-3.5 py-1.5 text-sm text-fd-muted-foreground shadow-(--shadow-border)",
            "transition-[opacity,translate,visibility] duration-200 ease-out motion-reduce:transition-none",
            phase === "handed"
              ? "visible translate-y-0 opacity-100"
              : "invisible translate-y-1 opacity-0",
          )}
        >
          <span className="font-medium text-fd-foreground">Your turn:</span>{" "}
          drag an event, or double-click to create one.
        </p>
      </div>
    </div>
  );
}

interface HeroScriptProps {
  isPlaying: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  cursorRef: React.RefObject<HTMLDivElement | null>;
  /** Called once the script has played to its end, or found nothing to play */
  onEnd: () => void;
}

/**
 * Plays the script inside the calendar's provider: the cursor and the event
 * move with the Web Animations API, and the move itself is one
 * `updateEvent`, so it is a real change the reader can undo. Stopping
 * mid-way cancels every animation before anything changed.
 */
function HeroScript({ isPlaying, rootRef, cursorRef, onEnd }: HeroScriptProps) {
  const { events, updateEvent, selectEvent } = useCalendar();
  const eventsRef = React.useRef(events);
  const updateEventRef = React.useRef(updateEvent);
  const selectEventRef = React.useRef(selectEvent);
  const onEndRef = React.useRef(onEnd);

  React.useEffect(() => {
    eventsRef.current = events;
    updateEventRef.current = updateEvent;
    selectEventRef.current = selectEvent;
    onEndRef.current = onEnd;
  }, [events, updateEvent, selectEvent, onEnd]);

  React.useEffect(() => {
    const root = rootRef.current;
    const cursor = cursorRef.current;
    if (!isPlaying || !root || !cursor) return;

    let isStopped = false;
    const timers: number[] = [];
    const animations: Animation[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    const animate = (
      element: Element,
      keyframes: Keyframe[],
      duration: number,
    ) => {
      const animation = element.animate(keyframes, {
        duration,
        easing: HERO_EASE,
        fill: "forwards",
      });
      animations.push(animation);
      return animation.finished;
    };

    async function play(root: HTMLElement, cursor: HTMLElement) {
      await wait(HERO_START_DELAY_MS);
      if (isStopped) return;

      const event = eventsRef.current.find((e) => e.id === HERO_EVENT_ID);
      const eventElement = root.querySelector<HTMLElement>(
        `[data-event-id="${HERO_EVENT_ID}"]`,
      );
      const column = eventElement?.closest<HTMLElement>(DAY_COLUMN_SELECTOR);
      if (!event || !eventElement || !column) return;
      const columns = Array.from(
        root.querySelectorAll<HTMLElement>(DAY_COLUMN_SELECTOR),
      );
      const nextColumn = columns[columns.indexOf(column) + 1];
      if (!nextColumn) return;

      const rootBox = root.getBoundingClientRect();
      const eventBox = eventElement.getBoundingClientRect();
      const columnBox = column.getBoundingClientRect();
      const dx = nextColumn.getBoundingClientRect().left - columnBox.left;
      const dy = columnBox.height / HOURS_PER_DAY;

      // The cursor's tip lands inside the event, near its title
      const from = { x: rootBox.width * 0.78, y: rootBox.height * 0.88 };
      const on = {
        x: eventBox.left - rootBox.left + Math.min(28, eventBox.width / 3),
        y: eventBox.top - rootBox.top + Math.min(18, eventBox.height / 2),
      };
      const at = (point: { x: number; y: number }, scale = 1) =>
        `translate(${point.x}px, ${point.y}px) scale(${scale})`;

      // 1. The cursor shows and glides onto the event
      await animate(
        cursor,
        [
          { opacity: 0, transform: at(from) },
          { opacity: 1, transform: at(from) },
        ],
        HERO_FADE_MS,
      );
      await animate(
        cursor,
        [{ transform: at(from) }, { transform: at(on) }],
        HERO_GLIDE_MS,
      );
      await animate(
        cursor,
        [{ transform: at(on) }, { transform: at(on, 0.9) }],
        HERO_FADE_MS / 2,
      );

      // 2. It drags the event a day right and an hour down
      const dropped = { x: on.x + dx, y: on.y + dy };
      await Promise.all([
        animate(
          cursor,
          [{ transform: at(on, 0.9) }, { transform: at(dropped, 0.9) }],
          HERO_STEP_MS,
        ),
        animate(
          eventElement,
          [
            { transform: "translate(0, 0)" },
            { transform: `translate(${dx}px, ${dy}px)` },
          ],
          HERO_STEP_MS,
        ),
      ]);
      if (isStopped) return;
      updateEventRef.current({
        ...event,
        start: addHours(addDays(event.start, 1), 1),
        end: addHours(addDays(event.end, 1), 1),
      });

      // 3. It lets go, and the event's details open
      await animate(
        cursor,
        [{ transform: at(dropped, 0.9) }, { transform: at(dropped) }],
        HERO_FADE_MS / 2,
      );
      if (isStopped) return;
      selectEventRef.current(HERO_EVENT_ID);
      await wait(HERO_LOOK_MS);

      // 4. The cursor leaves; the hint takes over
      await animate(
        cursor,
        [
          { opacity: 1, transform: at(dropped) },
          { opacity: 0, transform: at(dropped) },
        ],
        HERO_FADE_MS,
      );
    }

    play(root, cursor)
      // A cancelled animation rejects its `finished`: the script was stopped
      .catch(() => {})
      .finally(() => {
        if (!isStopped) onEndRef.current();
      });

    return () => {
      isStopped = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      animations.forEach((animation) => animation.cancel());
    };
  }, [isPlaying, rootRef, cursorRef]);

  return null;
}

/** The script's pointer: an arrow over the calendar that ignores the mouse */
function HeroCursor({ ref }: { ref: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      aria-hidden
      data-hero-cursor
      className="pointer-events-none absolute top-0 left-0 z-50 opacity-0"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        className="drop-shadow-[0_1px_2px_rgb(0_0_0/0.3)]"
      >
        <path
          d="M3 2.5v13.2l3.6-3.4 2.3 5.3 2.4-1-2.3-5.2H14L3 2.5Z"
          fill="black"
          stroke="white"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
