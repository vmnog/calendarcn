"use client";

import * as React from "react";
import { format } from "date-fns";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CalendarProvider,
  useCalendar,
  useCalendarConfig,
} from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type {
  DetailedCalendarEvent,
  EventColor,
  EventDetailsRenderProps,
} from "@/components/calendar-types";
import { createSampleEvents } from "@/lib/sample-events";

/** Colors offered by the details popover, in display order */
const COLORS: EventColor[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

/** Swatch class per event color, from the `--event-*-border` theme tokens */
const SWATCH_CLASS: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
};

export function CustomEventDetailsDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(() => createSampleEvents(new Date()));

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      renderEventDetails={renderEventDetails}
    >
      <WeekView />
    </CalendarProvider>
  );
}

/** Replaces the body of the popover that opens beside a selected event */
function renderEventDetails(
  props: EventDetailsRenderProps<DetailedCalendarEvent>,
) {
  return <EventDetails {...props} />;
}

/**
 * The popover body. A component rather than inline JSX, so it can use hooks:
 * `useCalendar()` to save edits, `useCalendarConfig()` to format times the
 * way the calendar does.
 */
function EventDetails({
  event,
  close,
  isNew,
}: EventDetailsRenderProps<DetailedCalendarEvent>) {
  const { updateEvent } = useCalendar<DetailedCalendarEvent>();
  const { hourCycle, locale } = useCalendarConfig();
  const timeFormat = hourCycle === 24 ? "HH:mm" : "h:mm a";

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <input
          aria-label="Title"
          value={event.title}
          // A click-created event opens with its title ready to type
          autoFocus={isNew}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => updateEvent({ ...event, title: e.target.value })}
          className="min-w-0 flex-1 rounded-sm bg-transparent px-1 py-0.5 text-sm font-semibold transition-colors duration-150 ease-out outline-none hover:bg-accent focus:bg-accent"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close"
          className="size-7"
          onClick={close}
        >
          <XIcon />
        </Button>
      </div>
      <p className="px-1 text-xs text-muted-foreground tabular-nums">
        {event.isAllDay
          ? `${format(event.start, "EEEE, MMM d", { locale })} · All day`
          : `${format(event.start, `EEEE, MMM d · ${timeFormat}`, { locale })} – ${format(event.end, timeFormat, { locale })}`}
      </p>
      <div
        role="radiogroup"
        aria-label="Color"
        className="flex items-center gap-1.5 px-1"
      >
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={(event.color ?? "blue") === color}
            aria-label={color}
            onClick={() => updateEvent({ ...event, color })}
            className={cn(
              "size-5 rounded-full ring-offset-2 ring-offset-popover transition-[box-shadow,scale] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96] motion-reduce:active:scale-100",
              SWATCH_CLASS[color],
              (event.color ?? "blue") === color && "ring-2 ring-foreground/60",
            )}
          />
        ))}
      </div>
    </div>
  );
}
