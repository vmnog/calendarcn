"use client";

import * as React from "react";
import { addDays, startOfWeek } from "date-fns";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import type { DetailedCalendarEvent } from "@/components/calendar-types";
import { useChallenge } from "@/components/docs/challenge";
import {
  getEventRecurrenceRule,
  normalizeRecurrenceRule,
} from "@/lib/recurrence";

/** The event the challenge turns into a series */
const STANDUP_ID = "standup";

/** This week's day `offset` days after Monday, at `hour:minute` */
function thisWeek(offset: number, hour: number, minute = 0): Date {
  const day = addDays(startOfWeek(new Date()), 1 + offset);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
  );
}

/** Standup on Monday, not repeating yet, and two events around it */
function createEvents(): DetailedCalendarEvent[] {
  return [
    {
      id: STANDUP_ID,
      title: "Standup",
      start: thisWeek(0, 9, 30),
      end: thisWeek(0, 10),
      color: "blue",
    },
    {
      id: "planning",
      title: "Sprint planning",
      start: thisWeek(1, 13),
      end: thisWeek(1, 14, 30),
      color: "orange",
    },
    {
      id: "review",
      title: "Design review",
      start: thisWeek(3, 14),
      end: thisWeek(3, 15),
      color: "purple",
    },
  ];
}

export function RepeatingEventsChallengeDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createEvents);

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="h-[600px]">
        <WeekView scrollToHour={8} />
      </div>
      <SeriesCheck />
    </CalendarProvider>
  );
}

/** First: Standup repeats every weekday. Then: only Wednesday's date moved */
function SeriesCheck() {
  const { events } = useCalendar<DetailedCalendarEvent>();
  const { step, complete } = useChallenge();

  const standup = events.find((event) => event.id === STANDUP_ID);
  const rule = standup ? getEventRecurrenceRule(standup) : null;
  const normalized =
    standup && rule ? normalizeRecurrenceRule(rule, standup.start) : null;
  const repeatsOnWeekdays =
    normalized?.frequency === "weekly" &&
    normalized.interval === 1 &&
    normalized.weekdays.join() === "1,2,3,4,5";

  // "This event" stores the date as an event of its own, with the start it had
  const movedWednesday = events.some(
    (event) =>
      event.seriesId === STANDUP_ID &&
      event.originalStart?.getDay() === 3 &&
      event.start.getTime() !== event.originalStart.getTime(),
  );

  React.useEffect(() => {
    if (step === 0 && repeatsOnWeekdays) complete();
    if (step === 1 && repeatsOnWeekdays && movedWednesday) complete();
  }, [step, repeatsOnWeekdays, movedWednesday, complete]);

  return null;
}
