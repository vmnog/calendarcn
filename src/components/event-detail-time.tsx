"use client";

import * as React from "react";
import { addDays, differenceInCalendarDays } from "date-fns";
import { Clock9 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useCalendarConfig } from "./calendar-provider";
import { EventDetailDateField } from "./event-detail-date-field";
import {
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_ROW_HEIGHT_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailRow,
  EventDetailSection,
} from "./event-detail-parts";
import { EventDetailTimeField } from "./event-detail-time-field";
import { formatTime } from "@/lib/event-utils";
import {
  applyTimeToDate,
  endsOnLaterDay,
  formatDuration,
  getEndTimeOptions,
  getStartTimeOptions,
  hasTimeOfDay,
  matchEndTimes,
  matchStartTimes,
} from "@/lib/time-input";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** Start hour given to an all-day event switched to timed when it has no times */
const DEFAULT_START_HOUR = 9;

/** End hour given to an all-day event switched to timed when it has no times */
const DEFAULT_END_HOUR = 10;

/** The clock and arrow of an all-day event, fainter than its times */
const ALL_DAY_ICON_CLASS = "text-[#EEEEEE] dark:text-[#303030]";

/** The duration of an all-day event, between its icons and its times */
const ALL_DAY_DURATION_CLASS = "text-[#D2D2D2] dark:text-[#373737]";

/**
 * The arrow between the times: Notion Calendar's is 13px wide and 10.5px
 * tall with 1.25px strokes, flatter than lucide's ArrowRight
 */
function TimeArrow({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      width="14"
      height="12"
      viewBox="0 0 14 12"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      <path d="M0.75 6h12.5M8.5 1.5 13.25 6 8.5 10.5" />
    </svg>
  );
}

/**
 * Start and end time with the duration, then the date, laid out on Notion
 * Calendar's columns: the times' text at 45px and 156px from the panel's
 * edge, the dates' under them. An all-day event shows its times muted and
 * inert (or none, when it has none) and its end date; so does a timed event
 * that ends on a later day. Without `onEventChange`, the fields only show
 * the event.
 */
export function EventDetailTime<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { hourCycle, locale } = useCalendarConfig();
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const allDay = event.isAllDay ?? false;
  const showTimes = !allDay || hasTimeOfDay(event);
  const showEndDate = allDay || endsOnLaterDay(event.start, event.end);
  const readOnly = !onEventChange;

  /** "3 PM" / "3:30 PM", or "15:00" / "15:30" on a 24-hour clock */
  const formatTimeValue = React.useCallback(
    (date: Date) => formatTime(date, hourCycle, locale),
    [hourCycle, locale],
  );

  const startMs = event.start.getTime();
  const endMs = event.end.getTime();

  const getStartOptions = React.useCallback(
    () => getStartTimeOptions(new Date(startMs), formatTimeValue),
    [startMs, formatTimeValue],
  );

  const getEndOptions = React.useCallback(
    () =>
      getEndTimeOptions(new Date(startMs), new Date(endMs), formatTimeValue),
    [startMs, endMs, formatTimeValue],
  );

  const getStartMatches = React.useCallback(
    (typed: string) =>
      matchStartTimes(typed, new Date(startMs), hourCycle, formatTimeValue),
    [startMs, hourCycle, formatTimeValue],
  );

  const getEndMatches = React.useCallback(
    (typed: string) =>
      matchEndTimes(
        typed,
        new Date(startMs),
        new Date(endMs),
        hourCycle,
        formatTimeValue,
      ),
    [startMs, endMs, hourCycle, formatTimeValue],
  );

  /** A new start keeps the duration, as in Notion Calendar */
  const commitStart = (date: Date) => {
    onEventChange?.({
      ...event,
      start: date,
      end: new Date(date.getTime() + (endMs - startMs)),
    });
    return true;
  };

  const commitEnd = (date: Date) => {
    if (date.getTime() <= startMs) return false;
    onEventChange?.({ ...event, end: date });
    return true;
  };

  /** A new start date moves the whole event */
  const commitStartDate = (day: Date) => {
    const dayDiff = differenceInCalendarDays(day, event.start);
    onEventChange?.({
      ...event,
      start: addDays(event.start, dayDiff),
      end: addDays(event.end, dayDiff),
    });
    return true;
  };

  /** A new end date keeps the end time; it can't come before the start */
  const commitEndDate = (day: Date) => {
    const end = addDays(event.end, differenceInCalendarDays(day, event.end));
    const isBeforeStart = allDay
      ? differenceInCalendarDays(end, event.start) < 0
      : end.getTime() <= startMs;
    if (isBeforeStart) return false;
    onEventChange?.({ ...event, end });
    return true;
  };

  const iconClass = allDay ? ALL_DAY_ICON_CLASS : EVENT_DETAIL_MUTED_CLASS;

  return (
    <EventDetailSection ref={sectionRef} name="time">
      {showTimes && (
        <div className={cn("flex items-center", EVENT_DETAIL_ROW_HEIGHT_CLASS)}>
          {/* Clock ink at 18.5-34px, text at 45px */}
          <EventDetailTimeField
            value={event.start}
            getOptions={getStartOptions}
            getMatches={getStartMatches}
            onCommit={commitStart}
            formatValue={formatTimeValue}
            label="Start time"
            testId="event-start-time"
            panelRef={sectionRef}
            disabled={allDay}
            readOnly={readOnly}
            className="ml-[7px] w-[105px] shrink-0 gap-[10px] pl-[10px]"
            leading={
              <Clock9
                absoluteStrokeWidth
                strokeWidth={1.25}
                className={cn("size-[17px] shrink-0", iconClass)}
              />
            }
          />
          {/* Arrow ink at 129.5px, text at 156px; the box runs to 10px from the edge */}
          <EventDetailTimeField
            value={event.end}
            getOptions={getEndOptions}
            getMatches={getEndMatches}
            onCommit={commitEnd}
            formatValue={formatTimeValue}
            label="End time"
            testId="event-end-time"
            panelRef={sectionRef}
            disabled={allDay}
            readOnly={readOnly}
            fitText
            className="mr-[10px] ml-[5px] flex-1 gap-[12.5px] pl-[11.5px]"
            leading={<TimeArrow className={iconClass} />}
            trailing={
              <span
                className={cn(
                  "ml-1 shrink-0 whitespace-nowrap",
                  allDay
                    ? ALL_DAY_DURATION_CLASS
                    : EVENT_DETAIL_SECONDARY_CLASS,
                )}
              >
                {formatDuration(event.start, event.end)}
              </span>
            }
          />
        </div>
      )}

      <div className={cn("flex items-center", EVENT_DETAIL_ROW_HEIGHT_CLASS)}>
        {/* Text at 45px, under the start time */}
        <EventDetailDateField
          value={event.start}
          onCommit={commitStartDate}
          label="Start date"
          testId="event-start-date"
          panelRef={sectionRef}
          readOnly={readOnly}
          className="ml-[36px] w-[105px] shrink-0"
        />
        {/* The end date's text at 156px, under the end time */}
        {showEndDate && (
          <EventDetailDateField
            value={event.end}
            onCommit={commitEndDate}
            minDate={event.start}
            label="End date"
            testId="event-end-date"
            panelRef={sectionRef}
            readOnly={readOnly}
            className="mr-[10px] ml-[6px] flex-1"
          />
        )}
      </div>
    </EventDetailSection>
  );
}

/**
 * The all-day switch. The event keeps its times while it's all-day, and
 * switching off brings them back (9–10 AM for an event that has none).
 */
export function EventDetailAllDay<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const allDay = event.isAllDay ?? false;

  const handleAllDayToggle = (checked: boolean) => {
    if (checked) {
      onEventChange?.({ ...event, isAllDay: true });
      return;
    }

    if (hasTimeOfDay(event)) {
      onEventChange?.({ ...event, isAllDay: false });
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
      <EventDetailRow
        className="cursor-default"
        onClick={onEventChange ? () => handleAllDayToggle(!allDay) : undefined}
        leading={
          <Switch
            size="sm"
            checked={allDay}
            disabled={!onEventChange}
            onCheckedChange={handleAllDayToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label="All-day"
            // data-[state=*] is the Radix switch, data-checked/data-unchecked
            // Base UI's. Notion's is 18x11 with a 9px white thumb
            className="data-[size=sm]:h-[11px] data-[size=sm]:w-[18px] **:data-[slot=switch-thumb]:!size-[9px] **:data-[slot=switch-thumb]:!bg-white data-[state=unchecked]:!bg-[#C7C5C1] data-unchecked:!bg-[#C7C5C1] dark:data-[state=unchecked]:!bg-[#595959] dark:data-unchecked:!bg-[#595959] data-[state=checked]:!bg-[#3A85D3] data-checked:!bg-[#3A85D3]"
          />
        }
      >
        <span className={EVENT_DETAIL_TEXT_CLASS}>All-day</span>
      </EventDetailRow>
    </EventDetailSection>
  );
}
