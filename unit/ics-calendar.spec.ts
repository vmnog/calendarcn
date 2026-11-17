import { expect, test } from "@playwright/test";

import { toIcsCalendar } from "@/lib/ics";
import type {
  CalendarInfo,
  DetailedCalendarEvent,
} from "@/components/calendar-types";

/**
 * An .ics file as a calendar of its own (`toIcsCalendar` in `src/lib/ics.ts`),
 * what the live demo's "Add calendar account" does. Runs in Node.
 */

const EVENTS: DetailedCalendarEvent[] = [
  {
    id: "standup@example.com",
    title: "Standup",
    start: new Date(2026, 5, 4, 9),
    end: new Date(2026, 5, 4, 9, 30),
  },
  {
    id: "launch@example.com",
    title: "Launch",
    start: new Date(2026, 5, 5, 14),
    end: new Date(2026, 5, 5, 15),
    color: "purple",
  },
];

const CALENDARS: CalendarInfo[] = [
  { id: "me", name: "Me", color: "red" },
  { id: "work", name: "Work", color: "orange", email: "me@work.example.com" },
];

test("the calendar is named after the file, without .ics", () => {
  const { calendar } = toIcsCalendar("Team holidays.ics", EVENTS, CALENDARS);
  expect(calendar.id).toBe("ics:Team holidays");
  expect(calendar.name).toBe("Team holidays");
  expect(calendar.email).toBeUndefined();
  expect(toIcsCalendar(".ics", EVENTS, CALENDARS).calendar.name).toBe(
    "Imported calendar",
  );
  expect(toIcsCalendar("Work.ICS", EVENTS, CALENDARS).calendar.name).toBe(
    "Work",
  );
});

test("a new calendar takes the first color no calendar has", () => {
  expect(toIcsCalendar("a.ics", EVENTS, CALENDARS).calendar.color).toBe(
    "yellow",
  );
  expect(toIcsCalendar("a.ics", EVENTS, []).calendar.color).toBe("red");
});

test("every event goes on the calendar, keeping a color of its own", () => {
  const { events } = toIcsCalendar("team.ics", EVENTS, CALENDARS);
  expect(events.map((event) => event.calendarId)).toEqual([
    "ics:team",
    "ics:team",
  ]);
  expect(events[1].color).toBe("purple");
  expect(events[0].color).toBeUndefined();
  // The events passed in are left as they were
  expect(EVENTS[0].calendarId).toBeUndefined();
});

test("the same file again returns the calendar already there", () => {
  const existing: CalendarInfo = {
    id: "ics:team",
    name: "team",
    color: "blue",
  };
  const { calendar } = toIcsCalendar("team.ics", EVENTS, [
    ...CALENDARS,
    existing,
  ]);
  expect(calendar).toBe(existing);
});
