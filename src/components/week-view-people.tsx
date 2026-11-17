"use client";

import * as React from "react";
import { addDays, startOfDay } from "date-fns";

import { cn } from "@/lib/utils";
import { eventColorStyles } from "./calendar-event-item";
import { useCalendarPeople } from "./calendar-people";
import { useCalendarConfig } from "./calendar-provider";
import { formatTimeRange, isMultiDayEvent } from "@/lib/event-utils";
import { getSharedFreeTime } from "@/lib/free-busy";
import { getPersonInitial, getPersonName } from "@/lib/people";
import { expandRecurringEvents } from "@/lib/recurrence";
import { toDisplayEvent } from "@/lib/time-zones";
import type {
  CalendarEvent,
  DetailedCalendarEvent,
  PersonCalendarEvent,
  PositionedEvent,
  TimeSpan,
  VisibleRange,
} from "./week-view-types";

/** Nobody's events and no free time: nobody is shown (stable identity) */
const NO_PERSON_EVENTS: PersonCalendarEvent[] = [];

/** No free time to highlight (stable identity) */
const NO_FREE_TIMES: TimeSpan[] = [];

/**
 * Diagonal stripes in the text color, Notion Calendar's mark for time
 * someone else is busy
 */
const BUSY_HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 7px)",
};

/** Shortest block, in pixels, that also shows the time under the title */
const PERSON_EVENT_TIME_MIN_HEIGHT = 36;

/** Shortest free-time block, in pixels, that shows its "Free" label */
const FREE_TIME_LABEL_MIN_HEIGHT = 20;

/** Whether a grid event is someone else's, drawn by `PersonEventItem` */
export function isPersonEvent(
  event: CalendarEvent,
): event is PersonCalendarEvent {
  return "calendarPerson" in event;
}

/**
 * What the time grid draws for the people whose calendars show: their timed
 * events in `range` (repeating ones on each date, all-day and multi-day
 * events left out), and, while you meet with someone, the free time you all
 * share on `days` (`getSharedFreeTime`, within the working hours). Like
 * `yourEvents`, `range` and `days` read on the calendar's clock
 * (`useCalendarConfig().timeZone`), and their events are mapped to it.
 */
export function usePeopleInTimeGrid(
  yourEvents: DetailedCalendarEvent[],
  range: VisibleRange,
  days: Date[],
): { personEvents: PersonCalendarEvent[]; freeTimes: TimeSpan[] } {
  const { shownPeople, meetWith, getPersonEvents, workingHours } =
    useCalendarPeople();
  const { timeZone } = useCalendarConfig();
  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();

  /** Someone's events on the calendar's clock, as `yourEvents` are */
  const getShownEvents = React.useCallback(
    (email: string) => {
      const events = getPersonEvents(email);
      if (!timeZone) return events;
      return events.map((event) => toDisplayEvent(event, timeZone));
    },
    [getPersonEvents, timeZone],
  );

  const personEvents = React.useMemo(() => {
    if (shownPeople.length === 0) return NO_PERSON_EVENTS;
    const expandRange = {
      start: new Date(rangeStart),
      end: new Date(rangeEnd),
    };
    return shownPeople.flatMap((person) =>
      expandRecurringEvents(getShownEvents(person.email), expandRange, timeZone)
        .filter((event) => !event.isAllDay && !isMultiDayEvent(event))
        .map(
          (event): PersonCalendarEvent => ({
            ...event,
            id: `person:${person.email}:${event.id}`,
            color: person.color,
            calendarPerson: person,
          }),
        ),
    );
  }, [shownPeople, getShownEvents, rangeStart, rangeEnd, timeZone]);

  const freeTimes = React.useMemo(() => {
    if (meetWith.length === 0) return NO_FREE_TIMES;
    return getSharedFreeTime(
      [yourEvents, ...meetWith.map((email) => getShownEvents(email))],
      days,
      { workingHours, timeZone },
    );
  }, [meetWith, yourEvents, getShownEvents, days, workingHours, timeZone]);

  return { personEvents, freeTimes };
}

/** The free times that fall on a day, clipped to it */
export function getDayFreeTimes(freeTimes: TimeSpan[], day: Date): TimeSpan[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return freeTimes
    .filter((span) => span.start < dayEnd && span.end > dayStart)
    .map((span) => ({
      start: span.start < dayStart ? dayStart : span.start,
      end: span.end > dayEnd ? dayEnd : span.end,
    }));
}

interface FreeTimeBlockProps {
  /** The free stretch, on one day */
  span: TimeSpan;
  /** Height of an hour row in pixels */
  hourHeight: number;
}

/**
 * A stretch of free time everyone shares, under the events of a day column:
 * a soft green band labelled "Free". It lets clicks through to the column,
 * so clicking it creates an event there.
 */
export function FreeTimeBlock({ span, hourHeight }: FreeTimeBlockProps) {
  const { dayStartHour, dayEndHour, hourCycle, locale } = useCalendarConfig();
  const dayStart = startOfDay(span.start);
  const visibleStart = dayStartHour * 60;
  const visibleEnd = dayEndHour * 60;
  // Wall-clock minutes, so a day when the clocks change lines up with the rows
  const startMinutes = span.start.getHours() * 60 + span.start.getMinutes();
  const endMinutes =
    span.end.getTime() === addDays(dayStart, 1).getTime()
      ? 24 * 60
      : span.end.getHours() * 60 + span.end.getMinutes();
  const top = Math.max(startMinutes, visibleStart) - visibleStart;
  const bottom = Math.min(endMinutes, visibleEnd) - visibleStart;
  if (bottom <= top) return null;
  const heightPx = ((bottom - top) / 60) * hourHeight;
  const label = formatTimeRange(span.start, span.end, hourCycle, locale);

  return (
    <div
      data-free-time=""
      role="note"
      aria-label={`Everyone free, ${label}`}
      className="pointer-events-none absolute inset-x-0 overflow-hidden rounded-sm border border-dashed border-event-green-border/60 bg-event-green-bg/40 dark:bg-event-green-bg/30"
      style={{ top: (top / 60) * hourHeight, height: heightPx }}
    >
      {heightPx >= FREE_TIME_LABEL_MIN_HEIGHT && (
        <span
          aria-hidden
          className="text-event-green block truncate px-1 pt-0.5 text-[10px] leading-tight font-medium"
        >
          Free
        </span>
      )}
    </div>
  );
}

interface PersonEventItemProps {
  /** Someone else's event, positioned in its day column */
  positionedEvent: PositionedEvent;
  /** Height of an hour row in pixels */
  hourHeight: number;
}

/**
 * Someone else's event in a day column, behind yours as Notion Calendar
 * draws the people you meet with: hatched in their color, with their
 * initial, the title and (when there's room) the time. Read-only: it can't
 * be selected, moved or opened, and clicks pass through to the column.
 */
export function PersonEventItem({
  positionedEvent,
  hourHeight,
}: PersonEventItemProps) {
  const { dayStartHour, dayEndHour, hourCycle, locale } = useCalendarConfig();
  const { event } = positionedEvent;
  if (!isPersonEvent(event)) return null;
  const person = event.calendarPerson;
  const styles = eventColorStyles[person.color];
  const heightPx =
    (positionedEvent.height / 100) * (dayEndHour - dayStartHour) * hourHeight;
  const time = formatTimeRange(event.start, event.end, hourCycle, locale);
  const name = getPersonName(person);

  return (
    <div
      data-person-event=""
      title={`${name}: ${event.title}, ${time}`}
      className={cn(
        "pointer-events-none absolute flex overflow-hidden rounded-sm border",
        styles.borderLine,
        styles.text,
      )}
      style={{
        top: `${positionedEvent.top}%`,
        height: `${positionedEvent.height}%`,
        left: `${positionedEvent.left}%`,
        width: `${positionedEvent.width}%`,
        minHeight: "20px",
        // Under every event of yours, which come later at z-index 0 and up
        zIndex: 0,
      }}
    >
      <div aria-hidden className="bg-background absolute inset-0" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-25"
        style={BUSY_HATCH_STYLE}
      />
      <div
        className={cn(
          "relative flex min-w-0 flex-1 gap-1 px-1 py-0.5",
          heightPx < PERSON_EVENT_TIME_MIN_HEIGHT && "items-center",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-3.5 shrink-0 items-center justify-center rounded-full text-[8px] leading-none font-semibold text-white",
            styles.border,
          )}
        >
          {getPersonInitial(person)}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[0.625rem] leading-tight font-medium">
            <span className="sr-only">{name}: </span>
            {event.title}
          </span>
          {heightPx >= PERSON_EVENT_TIME_MIN_HEIGHT && (
            <span className="truncate text-[0.625rem] leading-tight opacity-80">
              {time}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
