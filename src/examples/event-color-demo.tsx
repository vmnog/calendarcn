"use client";

import * as React from "react";

import { Calendar } from "@/components/calendar";
import type {
  DetailedCalendarEvent,
  EventColor,
} from "@/components/calendar-types";
import { EVENT_COLORS } from "@/lib/event-utils";
import { createSampleEvents } from "@/lib/sample-events";

/**
 * Two colors beyond the seven that ship. A color is a name and three CSS
 * variables per theme: its text, its background and its bar. In your project
 * these lines go in your global CSS file.
 *
 * `--event-<name>-strong` and `--event-<name>-muted` are optional: they are
 * the title and time of a timed event in month view, and default to the
 * color's text. Teal sets them, rose doesn't.
 */
const EXTRA_COLORS = `
:root {
  --event-teal: #0f766e;
  --event-teal-bg: #ccfbf1;
  --event-teal-border: #14b8a6;
  --event-teal-strong: #134e4a;
  --event-teal-muted: #0f766e;

  --event-rose: #be123c;
  --event-rose-bg: #ffe4e6;
  --event-rose-border: #f43f5e;
}

.dark {
  --event-teal: #2dd4bf;
  --event-teal-bg: #134e4a;
  --event-teal-border: #2dd4bf;
  --event-teal-strong: #ccfbf1;
  --event-teal-muted: #5eead4;

  --event-rose: #fb7185;
  --event-rose-bg: #5c1a2b;
  --event-rose-border: #fb7185;
}
`;

/** What the color pickers offer: the seven that ship, then the two above */
const PICKER_COLORS: EventColor[] = [...EVENT_COLORS, "teal", "rose"];

/** The sample events' blue and purple, swapped for the two new colors */
const RECOLORED: Partial<Record<EventColor, EventColor>> = {
  blue: "teal",
  purple: "rose",
};

export function EventColorDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState<DetailedCalendarEvent[]>(() =>
    createSampleEvents(new Date()).map((event) => ({
      ...event,
      color: (event.color && RECOLORED[event.color]) ?? event.color,
    })),
  );

  return (
    <>
      <style>{EXTRA_COLORS}</style>
      {/* Two calendars share this page: their single-key shortcuts are off */}
      <Calendar
        defaultEvents={initialEvents}
        eventColors={PICKER_COLORS}
        shortcuts={false}
      />
    </>
  );
}
