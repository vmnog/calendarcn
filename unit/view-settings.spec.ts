import { expect, test } from "@playwright/test";
import { format } from "date-fns";

import {
  addShownDays,
  countShownDaysBetween,
  getFirstShownDay,
  getKeyboardEventChange,
  getPeriodStart,
  getShownDays,
  getVisibleDayCount,
  getVisibleDays,
  isDeclinedByViewer,
} from "@/lib/event-utils";
import type {
  CalendarEvent,
  DetailedCalendarEvent,
} from "@/components/calendar-types";

/**
 * The date math behind the view settings: which days the time grid draws
 * and how it steps with weekends hidden, and which events count as declined
 * by the viewer. Runs in Node without a page; dates are local.
 */

/** Friday, June 5 2026 */
const FRIDAY = new Date(2026, 5, 5);
/** Saturday, June 6 2026 */
const SATURDAY = new Date(2026, 5, 6);
/** Sunday, June 7 2026 */
const SUNDAY = new Date(2026, 5, 7);
/** Monday, June 8 2026 */
const MONDAY = new Date(2026, 5, 8);

/** Day of a date as "Fri 06-05" */
function day(date: Date): string {
  return format(date, "EEE MM-dd");
}

test.describe("shown days", () => {
  test("a weekday is shown either way, a weekend day moves to Monday when hidden", () => {
    expect(day(getFirstShownDay(FRIDAY, false))).toBe("Fri 06-05");
    expect(day(getFirstShownDay(SATURDAY, false))).toBe("Mon 06-08");
    expect(day(getFirstShownDay(SUNDAY, false))).toBe("Mon 06-08");
    expect(day(getFirstShownDay(SATURDAY, true))).toBe("Sat 06-06");
  });

  test("stepping by shown days skips the weekend both ways", () => {
    expect(day(addShownDays(FRIDAY, 1, false))).toBe("Mon 06-08");
    expect(day(addShownDays(MONDAY, -1, false))).toBe("Fri 06-05");
    expect(day(addShownDays(MONDAY, 5, false))).toBe("Mon 06-15");
    expect(day(addShownDays(MONDAY, -6, false))).toBe("Fri 05-29");
    expect(day(addShownDays(new Date(2026, 5, 3), 3, false))).toBe("Mon 06-08");
    // From a weekend day, counted from the Monday the grid shows first
    expect(day(addShownDays(SATURDAY, 0, false))).toBe("Mon 06-08");
    expect(day(addShownDays(SUNDAY, -1, false))).toBe("Fri 06-05");
    // With weekends shown it is plain calendar days
    expect(day(addShownDays(FRIDAY, 1, true))).toBe("Sat 06-06");
  });

  test("counting shown days between two dates leaves the weekend out", () => {
    expect(countShownDaysBetween(FRIDAY, MONDAY, false)).toBe(1);
    expect(countShownDaysBetween(MONDAY, FRIDAY, false)).toBe(-1);
    expect(countShownDaysBetween(MONDAY, new Date(2026, 5, 22), false)).toBe(
      10,
    );
    expect(countShownDaysBetween(SATURDAY, MONDAY, false)).toBe(0);
    expect(countShownDaysBetween(FRIDAY, MONDAY, true)).toBe(3);
    // Each step of addShownDays is one shown day
    for (const amount of [-7, -3, -1, 0, 2, 4, 9]) {
      expect(
        countShownDaysBetween(
          FRIDAY,
          addShownDays(FRIDAY, amount, false),
          false,
        ),
      ).toBe(amount);
    }
  });

  test("lists the shown days from a start", () => {
    expect(getShownDays(new Date(2026, 5, 4), 3, false).map(day)).toEqual([
      "Thu 06-04",
      "Fri 06-05",
      "Mon 06-08",
    ]);
    expect(getShownDays(SATURDAY, 2, false).map(day)).toEqual([
      "Mon 06-08",
      "Tue 06-09",
    ]);
    expect(getShownDays(FRIDAY, 2, true).map(day)).toEqual([
      "Fri 06-05",
      "Sat 06-06",
    ]);
  });
});

test.describe("time grid with weekends hidden", () => {
  test("a full week shows its five weekdays, other day counts keep theirs", () => {
    expect(getVisibleDayCount("week", 7, false)).toBe(5);
    expect(getVisibleDayCount("week", 7, true)).toBe(7);
    expect(getVisibleDayCount("week", 3, false)).toBe(3);
    expect(getVisibleDayCount("week", 9, false)).toBe(9);
    expect(getVisibleDayCount("day", 7, false)).toBe(1);
  });

  test("the week's days start on its Monday, a day count on the next weekday", () => {
    const sunday = new Date(2026, 4, 31);
    expect(getVisibleDays(sunday, "week", 7, false).map(day)).toEqual([
      "Mon 06-01",
      "Tue 06-02",
      "Wed 06-03",
      "Thu 06-04",
      "Fri 06-05",
    ]);
    expect(getVisibleDays(FRIDAY, "week", 3, false).map(day)).toEqual([
      "Fri 06-05",
      "Mon 06-08",
      "Tue 06-09",
    ]);
    expect(getVisibleDays(SATURDAY, "day", 7, false).map(day)).toEqual([
      "Mon 06-08",
    ]);
  });

  test("day view and short day counts start their period on a weekday", () => {
    expect(day(getPeriodStart(SATURDAY, "day", 0, 7, false))).toBe("Mon 06-08");
    expect(day(getPeriodStart(SUNDAY, "week", 0, 3, false))).toBe("Mon 06-08");
    // A full week still starts on the week's first day
    expect(day(getPeriodStart(SATURDAY, "week", 0, 7, false))).toBe(
      "Sun 05-31",
    );
    // Shown weekends, or a setting left out, change nothing
    expect(day(getPeriodStart(SATURDAY, "day", 0, 7, true))).toBe("Sat 06-06");
    expect(day(getPeriodStart(SATURDAY, "day", 0, 7))).toBe("Sat 06-06");
  });

  test("Alt+arrow moves an event over the hidden weekend", () => {
    const event: CalendarEvent = {
      id: "review",
      title: "Review",
      start: new Date(2026, 5, 5, 10),
      end: new Date(2026, 5, 5, 11),
    };
    const config = { snapMinutes: 15, dayStartHour: 0, dayEndHour: 24 };

    const later = getKeyboardEventChange(
      event,
      "ArrowRight",
      false,
      "week",
      config,
      false,
    );
    expect(later && format(later.start, "EEE MM-dd HH:mm")).toBe(
      "Mon 06-08 10:00",
    );
    expect(later && format(later.end, "EEE MM-dd HH:mm")).toBe(
      "Mon 06-08 11:00",
    );

    const shown = getKeyboardEventChange(
      event,
      "ArrowRight",
      false,
      "week",
      config,
    );
    expect(shown && day(shown.start)).toBe("Sat 06-06");

    const monday = { ...event, start: MONDAY, end: MONDAY, isAllDay: true };
    const earlier = getKeyboardEventChange(
      monday,
      "ArrowLeft",
      false,
      "month",
      config,
      false,
    );
    expect(earlier && day(earlier.start)).toBe("Fri 06-05");
  });
});

test.describe("declined events", () => {
  const base: DetailedCalendarEvent = {
    id: "vendor-demo",
    title: "Vendor demo",
    start: new Date(2026, 5, 3, 14),
    end: new Date(2026, 5, 3, 15),
  };

  test("an event is declined when the viewer's participant declined it", () => {
    expect(
      isDeclinedByViewer({
        ...base,
        participants: [
          { email: "host@example.com", organizer: true, response: "accepted" },
          { email: "you@example.com", self: true, response: "declined" },
        ],
      }),
    ).toBe(true);
  });

  test("another guest's answer doesn't count", () => {
    expect(
      isDeclinedByViewer({
        ...base,
        participants: [
          { email: "guest@example.com", response: "declined" },
          { email: "you@example.com", self: true, response: "accepted" },
        ],
      }),
    ).toBe(false);
    expect(isDeclinedByViewer(base)).toBe(false);
  });

  test("without `self`, the viewer is the participant named by the calendar's email", () => {
    expect(
      isDeclinedByViewer({
        ...base,
        calendarEmail: "You@Example.com",
        participants: [{ email: "you@example.com", response: "declined" }],
      }),
    ).toBe(true);
    expect(
      isDeclinedByViewer({
        ...base,
        calendarEmail: "you@example.com",
        participants: [{ email: "guest@example.com", response: "declined" }],
      }),
    ).toBe(false);
  });
});
