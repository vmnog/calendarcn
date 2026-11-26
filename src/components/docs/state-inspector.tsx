"use client";

import * as React from "react";
import { format, isSameDay, subMilliseconds } from "date-fns";

import { Calendar } from "@/components/calendar";
import {
  useCalendar,
  useCalendarEventDraft,
} from "@/components/calendar-provider";
import type { CalendarEvent } from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Height of the inspector's calendar, in px */
const INSPECTOR_HEIGHT = 480;

/** Hour the calendar starts scrolled to */
const INSPECTOR_SCROLL_HOUR = 9;

/** How long a value flashes after it changes, in ms */
const INSPECTOR_FLASH_MS = 300;

/** What the panel shows before anything changed */
const NO_CHANGE = "nothing yet";

/** A day and time, short: "Thu 10:00 AM" */
function formatShortTime(date: Date): string {
  return format(date, "EEE p");
}

/** A range, short: "Thu 10:00 AM – 11:00 AM", or each day named when it spans days */
function formatShortRange(start: Date, end: Date, isAllDay?: boolean): string {
  if (isAllDay) {
    if (isSameDay(start, end)) return `${format(start, "EEE MMM d")}, all day`;
    return `${format(start, "EEE MMM d")} – ${format(end, "EEE MMM d")}, all day`;
  }
  if (isSameDay(start, end)) {
    return `${formatShortTime(start)} – ${format(end, "p")}`;
  }
  return `${formatShortTime(start)} – ${formatShortTime(end)}`;
}

/**
 * The latest change between two event lists, in a few words: "moved
 * 'Team standup' to Thu 10:00 AM", "resized …", "created …", "deleted …",
 * "edited …". `null` when nothing a reader would notice changed.
 */
function describeLatestChange(
  previous: CalendarEvent[],
  next: CalendarEvent[],
): string | null {
  const previousById = new Map(previous.map((event) => [event.id, event]));
  const nextIds = new Set(next.map((event) => event.id));

  for (const event of next) {
    const before = previousById.get(event.id);
    if (!before) return `created '${event.title || "Untitled"}'`;
    if (before === event) continue;

    const title = event.title || "Untitled";
    const lengthBefore = before.end.getTime() - before.start.getTime();
    const lengthAfter = event.end.getTime() - event.start.getTime();
    const hasMoved = before.start.getTime() !== event.start.getTime();
    if (lengthBefore !== lengthAfter) {
      return `resized '${title}' to ${formatShortRange(event.start, event.end, event.isAllDay)}`;
    }
    if (hasMoved) {
      if (event.isAllDay) {
        return `moved '${title}' to ${format(event.start, "EEE MMM d")}`;
      }
      return `moved '${title}' to ${formatShortTime(event.start)}`;
    }
    return `edited '${title}'`;
  }

  const deleted = previous.find((event) => !nextIds.has(event.id));
  if (deleted) return `deleted '${deleted.title || "Untitled"}'`;
  return null;
}

/**
 * A real week view beside a panel that prints, live, what the provider
 * holds: the view, the visible range, the selection, the event being
 * created and the last change. Drag, resize or double-click in the calendar
 * and watch the values change.
 */
export function StateInspector() {
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <div
      data-state-inspector
      className="docs-surface docs-preview not-prose my-6 grid overflow-hidden rounded-xl bg-background text-foreground md:grid-cols-[minmax(0,1fr)_15rem]"
      style={{ gridTemplateRows: `${INSPECTOR_HEIGHT}px` }}
    >
      <Calendar
        defaultEvents={initialEvents}
        defaultView="week"
        scrollToHour={INSPECTOR_SCROLL_HOUR}
        className="min-w-0"
      >
        <StatePanel />
      </Calendar>
    </div>
  );
}

/** The panel: reads the provider, so it renders inside the calendar */
function StatePanel() {
  const { view, visibleRange, events, selectedEventIds } = useCalendar();
  const { event: draft, isDraft } = useCalendarEventDraft();
  const previousEventsRef = React.useRef(events);
  const [lastChange, setLastChange] = React.useState(NO_CHANGE);

  // Compares each new event list with the one before it
  React.useEffect(() => {
    const previous = previousEventsRef.current;
    previousEventsRef.current = events;
    if (previous === events) return;
    const change = describeLatestChange(previous, events);
    if (change) setLastChange(change);
  }, [events]);

  const selectedTitles = React.useMemo(() => {
    const titles = selectedEventIds
      .map((id) => events.find((event) => event.id === id)?.title)
      .filter((title): title is string => title !== undefined);
    if (titles.length === 0) return "none";
    return titles.map((title) => `'${title || "Untitled"}'`).join(", ");
  }, [events, selectedEventIds]);

  // The range's end is exclusive: show the last day it includes
  const range = `${format(visibleRange.start, "MMM d")} – ${format(subMilliseconds(visibleRange.end, 1), "MMM d")}`;
  const draftText =
    draft && isDraft
      ? formatShortRange(draft.start, draft.end, draft.isAllDay)
      : "none";

  return (
    <aside
      aria-label="Calendar state"
      data-state-panel
      className="border-t border-border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed max-md:min-h-48 md:border-t-0 md:border-l"
    >
      <p className="mb-3 font-sans text-xs font-medium tracking-wide text-muted-foreground uppercase">
        useCalendar()
      </p>
      <dl className="flex flex-col gap-2.5">
        <StateRow name="view" value={view} />
        <StateRow name="visibleRange" value={range} />
        <StateRow name="selected" value={selectedTitles} />
        <StateRow name="draft" value={draftText} />
        <StateRow name="last change" value={lastChange} />
      </dl>
    </aside>
  );
}

interface StateRowProps {
  name: string;
  value: string;
}

/** One value of the panel, which flashes when it changes (motion allowed) */
function StateRow({ name, value }: StateRowProps) {
  const valueRef = React.useRef<HTMLElement>(null);
  const isFirstRenderRef = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    const element = valueRef.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    element.animate(
      [
        { backgroundColor: "var(--color-calendar-highlight)" },
        { backgroundColor: "transparent" },
      ],
      { duration: INSPECTOR_FLASH_MS, easing: "ease-out" },
    );
  }, [value]);

  return (
    <div data-state-row={name}>
      <dt className="text-muted-foreground">{name}</dt>
      <dd
        ref={valueRef}
        data-state-value={name}
        className="-mx-1 rounded-sm px-1 break-words text-foreground"
      >
        {value}
      </dd>
    </div>
  );
}
