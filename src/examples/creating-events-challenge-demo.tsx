"use client";

import * as React from "react";
import { addDays, differenceInMinutes, startOfWeek } from "date-fns";

import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import type { CalendarEvent } from "@/components/calendar-types";
import { useChallenge } from "@/components/docs/challenge";

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

/** A few events, with Wednesday morning left free */
function createEvents(): CalendarEvent[] {
  return [
    {
      id: "standup",
      title: "Standup",
      start: thisWeek(0, 9),
      end: thisWeek(0, 9, 30),
      color: "blue",
    },
    {
      id: "planning",
      title: "Sprint planning",
      start: thisWeek(1, 10),
      end: thisWeek(1, 12),
      color: "orange",
    },
    {
      id: "lunch",
      title: "Team lunch",
      start: thisWeek(2, 12, 30),
      end: thisWeek(2, 13, 30),
      color: "green",
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

export function CreatingEventsChallengeDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createEvents);

  return (
    <CalendarProvider defaultEvents={initialEvents}>
      <div className="h-[560px]">
        <WeekView scrollToHour={7} />
      </div>
      <CreatedEventCheck initialEvents={initialEvents} />
    </CalendarProvider>
  );
}

/** Done once a new event (or its draft) is 1 hour long on a Wednesday morning */
function CreatedEventCheck({
  initialEvents,
}: {
  initialEvents: CalendarEvent[];
}) {
  const { events, eventDraft } = useCalendar();
  const { step, complete } = useChallenge();

  // A drawn event is a draft until its first edit, so count the draft too
  const created = [
    ...(eventDraft ? [eventDraft] : []),
    ...events.filter((event) => !initialEvents.some((e) => e.id === event.id)),
  ];
  const isDone = created.some(
    (event) =>
      !event.isAllDay &&
      event.start.getDay() === 3 &&
      event.start.getHours() < 12 &&
      differenceInMinutes(event.end, event.start) === 60,
  );

  React.useEffect(() => {
    if (step === 0 && isDone) complete();
  }, [step, isDone, complete]);

  return null;
}
