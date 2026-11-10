import { expect, test } from "@playwright/test";

import type {
  CalendarInfo,
  DetailedCalendarEvent,
} from "../src/components/calendar-types";
import {
  addReminder,
  moveEventToCalendar,
  resolveEventColor,
} from "../src/lib/event-utils";

/** Helpers in `src/lib/event-utils.ts`, run in Node without a page */

test.describe("calendar helpers", () => {
  const personal: CalendarInfo = {
    id: "personal",
    name: "Personal",
    color: "purple",
    email: "you@example.com",
    defaultReminders: [{ amount: 10, unit: "minutes" }],
  };
  const work: CalendarInfo = {
    id: "work",
    name: "Work",
    color: "gray",
    defaultReminders: [{ amount: 30, unit: "minutes" }],
  };
  const calendars = [personal, work];
  const event: DetailedCalendarEvent = {
    id: "review",
    title: "Review",
    start: new Date("2026-06-03T15:00:00Z"),
    end: new Date("2026-06-03T16:00:00Z"),
    calendarId: "personal",
    calendarEmail: "you@example.com",
    reminders: [{ amount: 1, unit: "hours" }],
  };

  test("an event without its own color takes its calendar's, else blue", () => {
    expect(resolveEventColor(event, calendars)).toBe("purple");
    expect(resolveEventColor({ ...event, color: "green" }, calendars)).toBe(
      "green",
    );
    expect(resolveEventColor({ ...event, calendarId: "gone" }, calendars)).toBe(
      "blue",
    );
    expect(resolveEventColor(event, [])).toBe("blue");
  });

  test("reminders are deduped and sorted by when they fire", () => {
    const reminders = addReminder(event.reminders ?? [], {
      amount: 60,
      unit: "minutes",
    });
    expect(reminders).toBe(event.reminders);
    expect(
      addReminder(
        [
          { amount: 10, unit: "minutes" },
          { amount: 1, unit: "weeks" },
        ],
        { amount: 2, unit: "days" },
      ),
    ).toEqual([
      { amount: 10, unit: "minutes" },
      { amount: 2, unit: "days" },
      { amount: 1, unit: "weeks" },
    ]);
    expect(
      addReminder([{ amount: 1, unit: "weeks" }], { amount: 7, unit: "days" }),
    ).toEqual([{ amount: 1, unit: "weeks" }]);
    // An all-day reminder's time of day makes it another moment
    expect(
      addReminder([{ amount: 1, unit: "days" }], {
        amount: 1,
        unit: "days",
        time: { hours: 9, minutes: 0 },
      }),
    ).toEqual([
      { amount: 1, unit: "days", time: { hours: 9, minutes: 0 } },
      { amount: 1, unit: "days" },
    ]);
  });

  test("moving to a calendar swaps the calendar's color, defaults and account only", () => {
    // Drawn in its calendar's color, with hand-set reminders
    expect(moveEventToCalendar(event, work, calendars)).toEqual({
      ...event,
      calendarId: "work",
      calendarEmail: undefined,
    });

    // Its calendar's color and default reminders follow the calendar
    expect(
      moveEventToCalendar(
        {
          ...event,
          color: "purple",
          reminders: [{ amount: 10, unit: "minutes" }],
        },
        work,
        calendars,
      ),
    ).toEqual({
      ...event,
      calendarId: "work",
      calendarEmail: undefined,
      color: "gray",
      reminders: [{ amount: 30, unit: "minutes" }],
    });

    // Its own color stays
    expect(
      moveEventToCalendar({ ...event, color: "green" }, work, calendars).color,
    ).toBe("green");
  });
});
