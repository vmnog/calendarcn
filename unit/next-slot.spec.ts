import { expect, test } from "@playwright/test";
import { format } from "date-fns";

import { getNextSlotDay, getNextSlotEventRange } from "@/lib/event-utils";
import type { VisibleRange } from "@/components/calendar-types";

/**
 * Where an event created with C or "Create event..." goes
 * (`getNextSlotDay`, `getNextSlotEventRange` in `src/lib/event-utils.ts`),
 * as in Notion Calendar. Runs in Node without a page.
 */

/** The week of May 31 - Jun 6 2026, end exclusive */
const WEEK: VisibleRange = {
  start: new Date(2026, 4, 31),
  end: new Date(2026, 5, 7),
};

/** The grid's settings, as the provider's defaults */
const CONFIG = { snapMinutes: 15, dayStartHour: 0, dayEndHour: 24 };

/** A range as "EEE HH:mm–HH:mm" */
function formatRange({ start, end }: { start: Date; end: Date }): string {
  return `${format(start, "EEE MMM d HH:mm")}–${format(end, "HH:mm")}`;
}

test("the day: the one Go to date flashed, else today, else the first day shown", () => {
  const thursday = new Date(2026, 5, 4);
  const tuesday = new Date(2026, 5, 2);
  const firstDay = WEEK.start;

  expect(
    getNextSlotDay({
      range: WEEK,
      today: thursday,
      highlightedDate: tuesday,
      firstDay,
    }),
  ).toEqual(tuesday);
  expect(
    getNextSlotDay({
      range: WEEK,
      today: thursday,
      highlightedDate: null,
      firstDay,
    }),
  ).toEqual(thursday);
  // Today and the flashed day off screen
  expect(
    getNextSlotDay({
      range: WEEK,
      today: new Date(2026, 5, 11),
      highlightedDate: new Date(2026, 5, 20),
      firstDay,
    }),
  ).toEqual(firstDay);
});

test("the time rounds up to the next half hour, an hour long", () => {
  const day = new Date(2026, 5, 4);
  expect(
    formatRange(getNextSlotEventRange(day, new Date(2026, 5, 4, 8, 0), CONFIG)),
  ).toBe("Thu Jun 4 08:00–09:00");
  expect(
    formatRange(getNextSlotEventRange(day, new Date(2026, 5, 4, 8, 1), CONFIG)),
  ).toBe("Thu Jun 4 08:30–09:30");
  expect(
    formatRange(
      getNextSlotEventRange(day, new Date(2026, 5, 4, 14, 45), CONFIG),
    ),
  ).toBe("Thu Jun 4 15:00–16:00");
  // The time of day applies to the day given, not to now's
  expect(
    formatRange(
      getNextSlotEventRange(
        new Date(2026, 5, 7),
        new Date(2026, 5, 4, 10, 20),
        CONFIG,
      ),
    ),
  ).toBe("Sun Jun 7 10:30–11:30");
});

test("late at night the event stays inside the day and the visible hours", () => {
  const day = new Date(2026, 5, 4);
  // 11:40 PM rounds to midnight: the day's last hour instead, ending with
  // the day as a click on 11 PM does
  expect(
    formatRange(
      getNextSlotEventRange(day, new Date(2026, 5, 4, 23, 40), CONFIG),
    ),
  ).toBe("Thu Jun 4 23:00–23:59");
  // A grid that ends at 6 PM
  expect(
    formatRange(
      getNextSlotEventRange(day, new Date(2026, 5, 4, 19, 0), {
        ...CONFIG,
        dayStartHour: 8,
        dayEndHour: 18,
      }),
    ),
  ).toBe("Thu Jun 4 17:00–18:00");
});
