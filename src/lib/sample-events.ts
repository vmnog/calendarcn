import { addDays, startOfWeek } from "date-fns";

import type {
  DetailedCalendarEvent,
  WeekStartsOn,
} from "@/components/calendar-types";

/**
 * Builds a local date `dayOffset` days after the week's Monday, at
 * `hour:minute`. Offset 0 is Monday, 4 is Friday.
 */
type SampleDate = (dayOffset: number, hour?: number, minute?: number) => Date;

function createSampleDate(monday: Date): SampleDate {
  return (dayOffset, hour = 0, minute = 0) => {
    const day = addDays(monday, dayOffset);
    return new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      hour,
      minute,
    );
  };
}

/**
 * About fifteen events spread over the week that contains `referenceDate`,
 * for docs examples and tests: timed, overlapping, all-day and multi-day
 * events in every color, with timed events on every day so a day view always
 * has something to show. The same week always gets the same events (fixed
 * ids, titles and times), so examples render predictably.
 *
 * All-day events use the calendar's convention: `end` is the start of the
 * last day, so a one-day event has `start` equal to `end`.
 */
export function createSampleEvents(
  referenceDate: Date,
  weekStartsOn: WeekStartsOn = 0,
): DetailedCalendarEvent[] {
  const weekStart = startOfWeek(referenceDate, { weekStartsOn });
  const monday = addDays(weekStart, (8 - weekStartsOn) % 7);
  const at = createSampleDate(monday);
  // Sunday is the day before Monday, except in weeks that start on Monday
  const sunday = weekStartsOn === 1 ? 6 : -1;

  return [
    {
      id: "sample-standup",
      title: "Team standup",
      start: at(0, 9),
      end: at(0, 9, 30),
      color: "blue",
      recurrence: "Every weekday",
      location: "Google Meet",
    },
    {
      id: "sample-design-review",
      title: "Design review",
      start: at(0, 10),
      end: at(0, 11, 30),
      color: "purple",
      description: "Walk through the new onboarding flow.",
    },
    {
      id: "sample-one-on-one",
      title: "1:1 with Ana",
      start: at(0, 10, 30),
      end: at(0, 11),
      color: "green",
    },
    {
      id: "sample-sprint-planning",
      title: "Sprint planning",
      start: at(1, 10),
      end: at(1, 12),
      color: "orange",
      location: "Room 4B",
    },
    {
      id: "sample-lunch",
      title: "Lunch with Sam",
      start: at(1, 12, 30),
      end: at(1, 13, 30),
      color: "yellow",
      status: "free",
    },
    {
      id: "sample-offsite",
      title: "Product offsite",
      start: at(2),
      end: at(3),
      isAllDay: true,
      color: "red",
      location: "Lisbon",
    },
    {
      id: "sample-customer-call",
      title: "Customer call",
      start: at(2, 14),
      end: at(2, 15),
      color: "blue",
    },
    {
      id: "sample-focus",
      title: "Focus time",
      start: at(3, 9),
      end: at(3, 12),
      color: "gray",
      status: "free",
    },
    {
      id: "sample-interview",
      title: "Interview: frontend",
      start: at(3, 10),
      end: at(3, 11),
      color: "green",
    },
    {
      id: "sample-release",
      title: "Release day",
      start: at(4),
      end: at(4),
      isAllDay: true,
      color: "green",
    },
    {
      id: "sample-yoga",
      title: "Yoga",
      start: at(4, 18),
      end: at(4, 19),
      color: "purple",
    },
    {
      id: "sample-hackathon",
      title: "Hackathon",
      start: at(4, 16),
      end: at(5, 13),
      color: "orange",
      description: "Overnight build sprint, pizza included.",
    },
    {
      id: "sample-climbing",
      title: "Climbing",
      start: at(5, 15),
      end: at(5, 16, 30),
      color: "red",
      location: "Boulder gym",
    },
    {
      id: "sample-long-run",
      title: "Long run",
      start: at(sunday, 8),
      end: at(sunday, 9),
      color: "green",
      status: "free",
    },
    {
      id: "sample-brunch",
      title: "Family brunch",
      start: at(sunday, 11),
      end: at(sunday, 12, 30),
      color: "yellow",
    },
    {
      id: "sample-weekly-plan",
      title: "Plan the week",
      start: at(sunday, 17),
      end: at(sunday, 17, 30),
      color: "blue",
    },
  ];
}
