import { expect, test } from "@playwright/test";
import { differenceInMinutes, format } from "date-fns";
import { enUS } from "date-fns/locale";

import type {
  CalendarEvent,
  CalendarInfo,
  DetailedCalendarEvent,
  WeekDay,
} from "../src/components/calendar-types";
import {
  addReminder,
  calculateAllDayEventRows,
  calculateMonthCellLayout,
  calculatePositionedEvents,
  describeEventTime,
  filterShownEvents,
  generateWeekRow,
  getEventsForDay,
  getKeyboardEventChange,
  getNewEventRange,
  isMultiDayEvent,
  mergeShownEvents,
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

/**
 * New York's clock changes in 2026: Mar 8 has 23 hours (2 AM jumps to 3 AM),
 * Nov 1 has 25 (2 AM falls back to 1 AM)
 */
const SPRING_FORWARD = new Date(2026, 2, 8);
const FALL_BACK = new Date(2026, 10, 1);
const CLOCK_CHANGE_DAYS = [SPRING_FORWARD, FALL_BACK];

/** The whole day, midnight to midnight, on a 15-minute grid */
const FULL_DAY = { snapMinutes: 15, dayStartHour: 0, dayEndHour: 24 };

/** Working hours only, on a 15-minute grid */
const WORK_DAY = { snapMinutes: 15, dayStartHour: 8, dayEndHour: 18 };

function weekDay(date: Date): WeekDay {
  return { date, dayName: "", dayNumber: date.getDate(), isToday: false };
}

/** A time on `day`, by the clock on the wall */
function at(day: Date, hours: number, minutes = 0): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes,
  );
}

function timedEvent(start: Date, end: Date): CalendarEvent {
  return { id: "dst", title: "Standup", start, end };
}

test.describe("time of day on clock-change days", () => {
  for (const day of CLOCK_CHANGE_DAYS) {
    const label = format(day, "MMM d");
    const isoDay = format(day, "yyyy-MM-dd");

    test(`a 9 AM event is drawn on the 9 AM row on ${label}`, () => {
      const event = timedEvent(at(day, 9), at(day, 10));
      const positionedEvents = calculatePositionedEvents(
        [event],
        weekDay(day),
        FULL_DAY,
      );
      expect(positionedEvents).toHaveLength(1);
      expect(positionedEvents[0].top).toBeCloseTo((9 / 24) * 100, 5);
      expect(positionedEvents[0].height).toBeCloseTo((1 / 24) * 100, 5);
    });

    test(`the first visible hour starts at the top on ${label}`, () => {
      const event = timedEvent(at(day, 8), at(day, 9));
      const positionedEvents = calculatePositionedEvents(
        [event],
        weekDay(day),
        WORK_DAY,
      );
      expect(positionedEvents).toHaveLength(1);
      expect(positionedEvents[0].top).toBeCloseTo(0, 5);
      expect(positionedEvents[0].height).toBeCloseTo(10, 5);
    });

    test(`a click on the 9 AM row creates a 9 AM event on ${label}`, () => {
      const { start, end } = getNewEventRange(day, 9 * 60, FULL_DAY);
      expect(format(start, "yyyy-MM-dd HH:mm")).toBe(`${isoDay} 09:00`);
      expect(format(end, "yyyy-MM-dd HH:mm")).toBe(`${isoDay} 10:00`);
    });
  }

  test("Alt+ArrowUp reaches the first visible hour on Mar 8", () => {
    const event = timedEvent(
      at(SPRING_FORWARD, 8, 15),
      at(SPRING_FORWARD, 9, 15),
    );
    const moved = getKeyboardEventChange(
      event,
      "ArrowUp",
      false,
      "week",
      WORK_DAY,
    );
    expect(moved).not.toBeNull();
    if (!moved) return;
    expect(format(moved.start, "HH:mm")).toBe("08:00");
    expect(format(moved.end, "HH:mm")).toBe("09:00");
  });

  test("Alt+ArrowDown reaches the last hour of the day on Nov 1", () => {
    const event = timedEvent(at(FALL_BACK, 22), at(FALL_BACK, 23));
    const moved = getKeyboardEventChange(
      event,
      "ArrowDown",
      false,
      "week",
      FULL_DAY,
    );
    expect(moved).not.toBeNull();
    if (!moved) return;
    expect(format(moved.start, "HH:mm")).toBe("22:15");
    expect(format(moved.end, "HH:mm")).toBe("23:15");
  });

  // Mar 8 has no 2 AM hour in New York. These two pass before the fix too:
  // they keep it from trading the bug for an event with no length.
  test("a click on the 2 AM row creates an hour-long event on Mar 8", () => {
    const { start, end } = getNewEventRange(SPRING_FORWARD, 2 * 60, FULL_DAY);
    expect(differenceInMinutes(end, start)).toBe(60);
  });

  test("Alt+ArrowUp moves a 3 AM event earlier at its length on Mar 8", () => {
    const event = timedEvent(at(SPRING_FORWARD, 3), at(SPRING_FORWARD, 4));
    const moved = getKeyboardEventChange(
      event,
      "ArrowUp",
      false,
      "week",
      FULL_DAY,
    );
    expect(moved).not.toBeNull();
    if (!moved) return;
    expect(moved.start < event.start).toBe(true);
    expect(differenceInMinutes(moved.end, moved.start)).toBe(60);
  });
});

test.describe("events that end at midnight", () => {
  // Monday June 1 2026 and the two days after it
  const monday = new Date(2026, 5, 1);
  const tuesday = new Date(2026, 5, 2);
  const wednesday = new Date(2026, 5, 3);

  // The whole day, midnight to midnight, on a 15-minute grid
  const fullDay = { snapMinutes: 15, dayStartHour: 0, dayEndHour: 24 };

  const toWeekDay = (date: Date): WeekDay => ({
    date,
    dayName: "",
    dayNumber: date.getDate(),
    isToday: false,
  });

  const timed = (start: Date, end: Date): CalendarEvent => ({
    id: "late-call",
    title: "Late call",
    start,
    end,
  });

  // Monday 11 PM to the midnight that starts Tuesday
  const lateCall = timed(new Date(2026, 5, 1, 23), tuesday);
  // Monday 11 PM to Tuesday 12:30 AM: this one does reach into Tuesday
  const overnight = timed(
    new Date(2026, 5, 1, 23),
    new Date(2026, 5, 2, 0, 30),
  );

  test("11 PM to 12 AM is a one-day event", () => {
    expect(isMultiDayEvent(lateCall)).toBe(false);
  });

  test("events that reach past midnight are still multi-day", () => {
    expect(isMultiDayEvent(overnight)).toBe(true);
    // Monday 10 PM to the midnight that starts Wednesday
    expect(isMultiDayEvent(timed(new Date(2026, 5, 1, 22), wednesday))).toBe(
      true,
    );
  });

  test("an all-day event is never a timed multi-day event", () => {
    expect(isMultiDayEvent({ ...lateCall, isAllDay: true })).toBe(false);
  });

  test("the hour grid draws it on its own day, down to the bottom", () => {
    expect(getEventsForDay([lateCall], toWeekDay(monday))).toEqual([lateCall]);
    expect(getEventsForDay([lateCall], toWeekDay(tuesday))).toEqual([]);

    const positioned = calculatePositionedEvents(
      [lateCall],
      toWeekDay(monday),
      fullDay,
    );
    expect(positioned).toHaveLength(1);
    expect(positioned[0].top).toBeCloseTo((23 / 24) * 100, 5);
    expect(positioned[0].height).toBeCloseTo((1 / 24) * 100, 5);
    expect(
      calculatePositionedEvents([lateCall], toWeekDay(tuesday), fullDay),
    ).toEqual([]);
  });

  test("the all-day row leaves it out", () => {
    const days = [monday, tuesday, wednesday].map(toWeekDay);
    expect(calculateAllDayEventRows([lateCall], days)).toEqual([]);
    expect(calculateAllDayEventRows([overnight], days)).toHaveLength(1);
  });

  test("month view lists it on its own day, not as a bar", () => {
    const layout = calculateMonthCellLayout(
      [generateWeekRow(monday, 0, enUS)],
      [lateCall],
      4,
    );
    const mondayCell = layout.get(monday.toISOString());
    const tuesdayCell = layout.get(tuesday.toISOString());
    expect(mondayCell?.barSlots).toEqual([]);
    expect(mondayCell?.eventSlots).toEqual([
      { type: "event-item", event: lateCall },
    ]);
    expect(tuesdayCell?.barSlots).toEqual([]);
    expect(tuesdayCell?.eventSlots).toEqual([]);
  });

  test("it reads as one day", () => {
    expect(describeEventTime(lateCall, 12, enUS)).toBe(
      "11:00 PM to 12:00 AM, Monday, June 1",
    );
    expect(describeEventTime(overnight, 12, enUS)).toBe(
      "Monday, June 1, 11:00 PM to Tuesday, June 2, 12:30 AM",
    );
  });

  test("ArrowUp moves it earlier at its length", () => {
    const moved = getKeyboardEventChange(
      lateCall,
      "ArrowUp",
      false,
      "week",
      fullDay,
    );
    expect(moved).not.toBeNull();
    if (!moved) return;
    expect(format(moved.start, "EEE HH:mm")).toBe("Mon 22:45");
    expect(format(moved.end, "EEE HH:mm")).toBe("Mon 23:45");
  });
});

test.describe("hidden calendars", () => {
  const start = new Date(2026, 5, 4, 9);
  const end = new Date(2026, 5, 4, 10);
  const work: DetailedCalendarEvent = {
    id: "work-1",
    title: "Standup",
    start,
    end,
    calendarId: "work",
  };
  const family: DetailedCalendarEvent = {
    id: "family-1",
    title: "Brunch",
    start,
    end,
    calendarId: "family",
  };
  const loose: DetailedCalendarEvent = {
    id: "loose-1",
    title: "No calendar",
    start,
    end,
  };
  const all = [work, family, loose];

  test("nothing hidden gives back the same list", () => {
    expect(filterShownEvents(all, [])).toBe(all);
  });

  test("a hidden calendar's events are left out, the rest keep their order", () => {
    expect(filterShownEvents(all, ["family"])).toEqual([work, loose]);
  });

  test("an event without a calendar always shows", () => {
    expect(filterShownEvents(all, ["work", "family"])).toEqual([loose]);
  });

  test("merging with nothing hidden gives back the shown list", () => {
    const shown = [work, loose];
    expect(mergeShownEvents(all, shown, [])).toBe(shown);
  });

  test("an edit to a shown event lands in place and hidden events stay", () => {
    const edited = { ...work, title: "Standup (moved)" };
    expect(mergeShownEvents(all, [edited, loose], ["family"])).toEqual([
      edited,
      family,
      loose,
    ]);
  });

  test("a new event goes last", () => {
    const created: DetailedCalendarEvent = {
      id: "new-1",
      title: "New event",
      start,
      end,
      calendarId: "work",
    };
    expect(mergeShownEvents(all, [work, loose, created], ["family"])).toEqual([
      work,
      family,
      loose,
      created,
    ]);
  });

  test("an event the provider dropped is dropped, hidden ones are not", () => {
    expect(mergeShownEvents(all, [loose], ["family"])).toEqual([family, loose]);
  });

  test("an event moved to a hidden calendar keeps its place", () => {
    const moved = { ...work, calendarId: "family" };
    expect(mergeShownEvents(all, [moved, loose], ["family"])).toEqual([
      moved,
      family,
      loose,
    ]);
  });
});
