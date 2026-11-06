"use client";

import * as React from "react";
import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  parse,
} from "date-fns";
import type { Locale } from "date-fns";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { useInlineEdit } from "@/hooks/use-inline-edit";
import { Switch } from "@/components/ui/switch";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EventDetailSection,
} from "./event-detail-parts";
import { formatTime } from "@/lib/event-utils";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** Start hour given to an all-day event switched to timed without saved times */
const DEFAULT_START_HOUR = 9;

/** End hour given to an all-day event switched to timed without saved times */
const DEFAULT_END_HOUR = 10;

/** "45min", "2h" or "1h 30min" */
function formatDuration(start: Date, end: Date): string {
  const totalMinutes = differenceInMinutes(end, start);

  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}min`;
}

interface ParsedTime {
  hours: number;
  minutes: number;
}

/**
 * Parses a user-typed time string into hours and minutes.
 * Accepts formats: "3 PM", "3:30 PM", "15:00", "3pm", "330pm", "3:30pm".
 * Returns null if the input cannot be parsed.
 */
function parseTimeInput(input: string): ParsedTime | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) {
    return null;
  }

  const isPM = /pm$/.test(trimmed);
  const isAM = /am$/.test(trimmed);
  const stripped = trimmed.replace(/\s*(am|pm)\s*$/, "").trim();

  if (stripped.length === 0) {
    return null;
  }

  let hours: number;
  let minutes: number;

  if (stripped.includes(":")) {
    const parts = stripped.split(":");
    if (parts.length !== 2) {
      return null;
    }
    hours = Number.parseInt(parts[0], 10);
    minutes = Number.parseInt(parts[1], 10);
  } else {
    const num = Number.parseInt(stripped, 10);
    if (Number.isNaN(num)) {
      return null;
    }
    if (stripped.length > 2 && num > 99) {
      // e.g., "330" → 3:30, "1230" → 12:30
      minutes = num % 100;
      hours = Math.floor(num / 100);
    } else {
      hours = num;
      minutes = 0;
    }
  }

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  // Apply AM/PM conversion
  if (isPM && hours < 12) {
    hours += 12;
  }
  if (isAM && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours, minutes };
}

/**
 * Returns a new Date with the same year/month/day as `base`
 * but with hours and minutes replaced.
 */
function applyTimeToDate(base: Date, hours: number, minutes: number): Date {
  const result = new Date(base);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

function formatDateDisplay(date: Date, locale: Locale): string {
  return format(date, "EEE MMM d", { locale });
}

/**
 * Parses a user-typed date string into a Date.
 * Strips any leading weekday name and parses "MMM d" (e.g., "Mar 11") in
 * the calendar's locale. Uses the reference date's year. Returns null if
 * unparseable.
 */
function parseDateInput(
  input: string,
  referenceDate: Date,
  locale: Locale,
): Date | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Strip an optional leading weekday ("Tue ", "sáb ") when a month name follows
  const withoutWeekday = trimmed.replace(/^[^\s\d]+\s+(?=[^\s\d])/, "");

  const parsed = parse(withoutWeekday, "MMM d", referenceDate, { locale });
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

/** Whether the event has a time of day (an all-day event's are all midnight) */
function hasTimeOfDay(event: DetailedCalendarEvent): boolean {
  return (
    event.start.getHours() !== 0 ||
    event.start.getMinutes() !== 0 ||
    event.end.getHours() !== 0 ||
    event.end.getMinutes() !== 0
  );
}

/**
 * Start and end time with the duration, then the date (start and end date
 * for an all-day event). Times are muted and read-only on all-day events.
 */
export function EventDetailTime<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { hourCycle, locale } = useCalendarConfig();
  const timed = hasTimeOfDay(event);

  /** "3 PM" / "3:30 PM", or "15:00" / "15:30" on a 24-hour clock */
  const formatTimeValue = (date: Date) => formatTime(date, hourCycle, locale);

  /** "Tue Mar 11" in the calendar's locale */
  const formatDateValue = (date: Date) => formatDateDisplay(date, locale);

  const startTimeRef = React.useRef<HTMLInputElement>(null);
  const startTime = useInlineEdit({
    inputRef: startTimeRef,
    value: formatTimeValue(event.start),
    selectOnFocus: true,
    onCommit: (text) => {
      const parsed = parseTimeInput(text);
      if (!parsed) return null;
      const newStart = applyTimeToDate(
        event.start,
        parsed.hours,
        parsed.minutes,
      );
      if (newStart.getTime() >= event.end.getTime()) return null;
      onEventChange?.({ ...event, start: newStart });
      return formatTimeValue(newStart);
    },
  });

  const endTimeRef = React.useRef<HTMLInputElement>(null);
  const endTime = useInlineEdit({
    inputRef: endTimeRef,
    value: formatTimeValue(event.end),
    selectOnFocus: true,
    onCommit: (text) => {
      const parsed = parseTimeInput(text);
      if (!parsed) return null;
      const newEnd = applyTimeToDate(event.end, parsed.hours, parsed.minutes);
      if (newEnd.getTime() <= event.start.getTime()) return null;
      onEventChange?.({ ...event, end: newEnd });
      return formatTimeValue(newEnd);
    },
  });

  const startDateRef = React.useRef<HTMLInputElement>(null);
  const startDate = useInlineEdit({
    inputRef: startDateRef,
    value: formatDateValue(event.start),
    selectOnFocus: true,
    onCommit: (text) => {
      const parsed = parseDateInput(text, event.start, locale);
      if (!parsed) return null;
      const dayDiff = differenceInCalendarDays(parsed, event.start);
      if (dayDiff === 0) return formatDateValue(event.start);
      const newStart = addDays(event.start, dayDiff);
      const newEnd = addDays(event.end, dayDiff);
      onEventChange?.({ ...event, start: newStart, end: newEnd });
      return formatDateValue(newStart);
    },
  });

  const endDateRef = React.useRef<HTMLInputElement>(null);
  const endDate = useInlineEdit({
    inputRef: endDateRef,
    value: formatDateValue(event.end),
    selectOnFocus: true,
    onCommit: (text) => {
      const parsed = parseDateInput(text, event.end, locale);
      if (!parsed) return null;
      const dayDiff = differenceInCalendarDays(parsed, event.end);
      if (dayDiff === 0) return formatDateValue(event.end);
      const newEnd = addDays(event.end, dayDiff);
      if (newEnd.getTime() < event.start.getTime()) return null;
      onEventChange?.({ ...event, end: newEnd });
      return formatDateValue(newEnd);
    },
  });

  return (
    <EventDetailSection name="time" className="gap-3">
      {/* Time — muted and non-interactive for all-day events */}
      {timed && (
        <div className="flex min-w-0 items-center gap-1 px-2 text-xs">
          {/* Start time group — Clock icon + input in one bordered container */}
          <div
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-sm border border-transparent px-2 py-1.5",
              event.isAllDay
                ? "cursor-default"
                : EVENT_DETAIL_INPUT_GROUP_CLASS,
            )}
            onClick={
              event.isAllDay ? undefined : () => startTimeRef.current?.focus()
            }
          >
            <Clock
              className={cn("size-4 shrink-0", EVENT_DETAIL_MUTED_CLASS)}
            />
            <input
              ref={startTimeRef}
              {...startTime.inputProps}
              data-testid="event-start-time"
              type="text"
              readOnly={event.isAllDay}
              tabIndex={event.isAllDay ? -1 : undefined}
              className={cn(
                "w-[8ch] font-medium text-xs",
                EVENT_DETAIL_GROUPED_INPUT_CLASS,
                event.isAllDay
                  ? cn(EVENT_DETAIL_MUTED_CLASS, "pointer-events-none")
                  : "text-foreground",
              )}
            />
          </div>
          {/* End time group — arrow + input + duration in one bordered container */}
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center rounded-sm border border-transparent px-2 py-1.5",
              event.isAllDay
                ? "cursor-default"
                : EVENT_DETAIL_INPUT_GROUP_CLASS,
            )}
            onClick={
              event.isAllDay ? undefined : () => endTimeRef.current?.focus()
            }
          >
            <span
              className={cn(
                "mr-2 shrink-0 text-base leading-4",
                EVENT_DETAIL_MUTED_CLASS,
              )}
            >
              →
            </span>
            <input
              ref={endTimeRef}
              {...endTime.inputProps}
              data-testid="event-end-time"
              type="text"
              readOnly={event.isAllDay}
              tabIndex={event.isAllDay ? -1 : undefined}
              className={cn(
                "min-w-0 font-medium text-xs",
                EVENT_DETAIL_GROUPED_INPUT_CLASS,
                event.isAllDay
                  ? cn(EVENT_DETAIL_MUTED_CLASS, "pointer-events-none")
                  : "text-foreground",
              )}
              size={endTime.text.length}
            />
            <span className={cn("shrink-0", EVENT_DETAIL_MUTED_CLASS)}>
              {formatDuration(event.start, event.end)}
            </span>
          </div>
        </div>
      )}

      {/* Date — editable inline input(s), indented to align with time text */}
      <div
        className={cn("flex items-center gap-2 -mt-2", timed ? "ml-8" : "ml-4")}
      >
        {/* Start date */}
        <div
          className={cn(
            "flex min-w-[6.5rem] self-start items-center px-2 py-1.5",
            EVENT_DETAIL_INPUT_GROUP_CLASS,
          )}
          onClick={() => startDateRef.current?.focus()}
        >
          <input
            ref={startDateRef}
            {...startDate.inputProps}
            data-testid="event-start-date"
            type="text"
            className={cn(
              "text-foreground text-xs",
              EVENT_DETAIL_GROUPED_INPUT_CLASS,
            )}
            size={startDate.text.length}
          />
        </div>
        {/* End date — only visible for all-day events */}
        {event.isAllDay && (
          <div
            className={cn(
              "flex min-w-[6.5rem] self-start items-center px-2 py-1.5",
              EVENT_DETAIL_INPUT_GROUP_CLASS,
            )}
            onClick={() => endDateRef.current?.focus()}
          >
            <input
              ref={endDateRef}
              {...endDate.inputProps}
              data-testid="event-end-date"
              type="text"
              className={cn(
                "text-foreground text-xs",
                EVENT_DETAIL_GROUPED_INPUT_CLASS,
              )}
              size={endDate.text.length}
            />
          </div>
        )}
      </div>
    </EventDetailSection>
  );
}

/**
 * The all-day switch. Switching on keeps the times aside, switching off
 * puts them back (9–10 AM for an event that was all-day from the start).
 */
export function EventDetailAllDay<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  /**
   * Stores the original hours/minutes before toggling to all-day.
   * When toggling off, these are applied to the current (possibly resized) dates.
   */
  const savedTimeOfDayRef = React.useRef<{
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
  } | null>(null);

  const handleAllDayToggle = (checked: boolean) => {
    if (checked) {
      savedTimeOfDayRef.current = {
        startHours: event.start.getHours(),
        startMinutes: event.start.getMinutes(),
        endHours: event.end.getHours(),
        endMinutes: event.end.getMinutes(),
      };
      onEventChange?.({ ...event, isAllDay: true });
      return;
    }

    if (savedTimeOfDayRef.current) {
      const { startHours, startMinutes, endHours, endMinutes } =
        savedTimeOfDayRef.current;
      onEventChange?.({
        ...event,
        isAllDay: false,
        start: applyTimeToDate(event.start, startHours, startMinutes),
        end: applyTimeToDate(event.end, endHours, endMinutes),
      });
      savedTimeOfDayRef.current = null;
      return;
    }

    onEventChange?.({
      ...event,
      isAllDay: false,
      start: applyTimeToDate(event.start, DEFAULT_START_HOUR, 0),
      end: applyTimeToDate(event.end, DEFAULT_END_HOUR, 0),
    });
  };

  return (
    <EventDetailSection name="all-day">
      {/* Clicking the label or the row toggles too */}
      <div
        className="flex cursor-default items-center gap-3 px-4"
        onClick={() => handleAllDayToggle(!(event.isAllDay ?? false))}
      >
        <Switch
          size="sm"
          checked={event.isAllDay ?? false}
          onCheckedChange={handleAllDayToggle}
          onClick={(e) => e.stopPropagation()}
          aria-label="All-day"
          // data-[state=*] is the Radix switch, data-checked/data-unchecked Base UI's
          className="data-[state=unchecked]:!bg-[#C7C5C1] data-unchecked:!bg-[#C7C5C1] dark:data-[state=unchecked]:!bg-[#595959] dark:data-unchecked:!bg-[#595959] data-[state=checked]:!bg-[#3A85D3] data-checked:!bg-[#3A85D3]"
        />
        <span className="text-foreground text-xs">All-day</span>
      </div>
    </EventDetailSection>
  );
}
