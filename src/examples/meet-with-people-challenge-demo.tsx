"use client";

import * as React from "react";
import { addDays, startOfDay, startOfWeek } from "date-fns";

import { useCalendarPeople } from "@/components/calendar-people";
import { CalendarProvider, useCalendar } from "@/components/calendar-provider";
import { WeekView } from "@/components/week-view";
import { Button } from "@/components/ui/button";
import type {
  DetailedCalendarEvent,
  EventContact,
} from "@/components/calendar-types";
import { useChallenge } from "@/components/docs/challenge";
import { getSharedFreeTime } from "@/lib/free-busy";

/** Priya's address: her events are keyed by it */
const PRIYA = "priya@example.com";

/** The person you can meet with */
const CONTACTS: EventContact[] = [{ name: "Priya Shah", email: PRIYA }];

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

/** One event on each weekday, Monday to Friday */
function everyWeekday(
  id: string,
  title: string,
  from: [number, number],
  to: [number, number],
  extra: Partial<DetailedCalendarEvent> = {},
): DetailedCalendarEvent[] {
  return [0, 1, 2, 3, 4].map((offset) => ({
    id: `${id}-${offset}`,
    title,
    start: thisWeek(offset, ...from),
    end: thisWeek(offset, ...to),
    ...extra,
  }));
}

/** Your mornings and early afternoons are taken */
function createEvents(): DetailedCalendarEvent[] {
  return [
    ...everyWeekday("focus", "Focus time", [9, 0], [11, 0], { color: "blue" }),
    ...everyWeekday("calls", "Customer calls", [13, 0], [15, 0], {
      color: "green",
    }),
  ];
}

/** Priya is busy late mornings and late afternoons: you're both free from 4:30 */
function createPriyaEvents(): Record<string, DetailedCalendarEvent[]> {
  return {
    [PRIYA]: [
      ...everyWeekday("interviews", "Interviews", [11, 0], [13, 0], {
        calendarEmail: PRIYA,
      }),
      ...everyWeekday("sync", "Design sync", [15, 0], [16, 30], {
        calendarEmail: PRIYA,
      }),
    ],
  };
}

export function MeetWithPeopleChallengeDemo() {
  // The provider reads its initial events once, so create them once
  const [initialEvents] = React.useState(createEvents);
  const [contactEvents] = React.useState(createPriyaEvents);

  return (
    <CalendarProvider
      defaultEvents={initialEvents}
      contacts={CONTACTS}
      contactEvents={contactEvents}
    >
      <div className="flex h-[600px] flex-col">
        <MeetWithBar />
        <div className="min-h-0 flex-1">
          <WeekView scrollToHour={11} />
        </div>
      </div>
      <FreeTimeCheck
        initialEvents={initialEvents}
        contactEvents={contactEvents}
      />
    </CalendarProvider>
  );
}

/** Meeting with Priya highlights the times you're both free */
function MeetWithBar() {
  const { meetWith, addMeetWith, removeMeetWith } = useCalendarPeople();
  const isIn = meetWith.includes(PRIYA);

  return (
    <div className="flex min-h-12 shrink-0 items-center gap-2 border-b px-3 py-2">
      <p className="text-sm text-muted-foreground">Meet with</p>
      <Button
        variant={isIn ? "secondary" : "outline"}
        size="sm"
        aria-pressed={isIn}
        onClick={() => (isIn ? removeMeetWith(PRIYA) : addMeetWith(PRIYA))}
      >
        Priya Shah
      </Button>
    </div>
  );
}

interface FreeTimeCheckProps {
  initialEvents: DetailedCalendarEvent[];
  contactEvents: Record<string, DetailedCalendarEvent[]>;
}

/** Done once a new event (or its draft) with Priya sits in time you're both free */
function FreeTimeCheck({ initialEvents, contactEvents }: FreeTimeCheckProps) {
  const { events, eventDraft } = useCalendar<DetailedCalendarEvent>();
  const { meetWith } = useCalendarPeople();
  const { step, complete } = useChallenge();

  const isInitial = (event: DetailedCalendarEvent) =>
    initialEvents.some((e) => e.id === event.id);
  const created = [
    ...(eventDraft ? [eventDraft] : []),
    ...events.filter((event) => !isInitial(event)),
  ];
  const yours = events.filter(isInitial);
  const isDone =
    meetWith.includes(PRIYA) &&
    created.some((event) => {
      if (event.isAllDay) return false;
      const free = getSharedFreeTime(
        [yours, contactEvents[PRIYA] ?? []],
        [startOfDay(event.start)],
      );
      return free.some(
        (span) => span.start <= event.start && event.end <= span.end,
      );
    });

  React.useEffect(() => {
    if (step === 0 && isDone) complete();
  }, [step, isDone, complete]);

  return null;
}
