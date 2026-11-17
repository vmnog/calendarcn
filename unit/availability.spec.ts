import { expect, test } from "@playwright/test";
import { enUS, ptBR } from "date-fns/locale";

import {
  formatAvailabilityText,
  formatAvailabilityTimeRange,
  formatMeetingDuration,
  getRangeMinutes,
  mergeAvailabilityRanges,
} from "../src/lib/availability";
import type { AvailabilityRange } from "../src/components/calendar-types";

/**
 * Helpers in `src/lib/availability.ts`, run in Node without a page. The unit
 * project runs in America/New_York (see `test:unit`), so the zone reads EST
 * in November and EDT in June.
 */

/** Tuesday, November 17 2026, 10 PM: the night Notion Calendar was checked */
const NOW = new Date(2026, 10, 17, 22, 0);

/** A marked time on a November 2026 day, from hours (fractions are minutes) */
function range(
  id: string,
  day: number,
  startHour: number,
  endHour: number,
): AvailabilityRange {
  const at = (hour: number) =>
    new Date(2026, 10, day, Math.floor(hour), Math.round((hour % 1) * 60));
  return { id, start: at(startHour), end: at(endHour) };
}

/** Options of the text in English on a 12-hour clock, 30 min meetings */
const TEXT_OPTIONS = {
  durationMinutes: 30,
  hourCycle: 12,
  locale: enUS,
  now: NOW,
} as const;

test.describe("merging marked times", () => {
  test("times that overlap or touch on one day become one", () => {
    const merged = mergeAvailabilityRanges([
      range("b", 18, 10, 11),
      range("a", 18, 9, 10),
      range("c", 18, 10.5, 12),
    ]);

    expect(merged).toEqual([range("a", 18, 9, 12)]);
  });

  test("times apart, or on other days, stay apart and in order", () => {
    const merged = mergeAvailabilityRanges([
      range("thu", 19, 9, 10),
      range("late", 18, 14, 15),
      range("early", 18, 9, 10),
    ]);

    expect(merged.map((r) => r.id)).toEqual(["early", "late", "thu"]);
  });

  test("an empty time is dropped", () => {
    expect(mergeAvailabilityRanges([range("a", 18, 9, 9)])).toEqual([]);
  });

  test("a time that ends at midnight ends at minute 1440", () => {
    const lateNight: AvailabilityRange = {
      id: "late",
      start: new Date(2026, 10, 18, 23, 0),
      end: new Date(2026, 10, 19, 0, 0),
    };

    expect(getRangeMinutes(lateNight)).toEqual({
      startMinutes: 23 * 60,
      endMinutes: 24 * 60,
    });
  });
});

test.describe("a marked time as text", () => {
  test("12-hour times write a shared AM or PM once", () => {
    const format = (start: number, end: number) =>
      formatAvailabilityTimeRange(range("r", 18, start, end), 12, enUS);

    expect(format(14, 15)).toBe("2-3 PM");
    expect(format(16, 17.5)).toBe("4-5:30 PM");
    expect(format(9.5, 10)).toBe("9:30-10 AM");
    expect(format(11, 13)).toBe("11 AM - 1 PM");
    expect(format(0, 1)).toBe("12-1 AM");
    expect(format(11.75, 12)).toBe("11:45 AM - 12 PM");
  });

  test("a time that ends at midnight ends at 12 AM", () => {
    const lateNight = {
      start: new Date(2026, 10, 18, 23, 0),
      end: new Date(2026, 10, 19, 0, 0),
    };

    expect(formatAvailabilityTimeRange(lateNight, 12, enUS)).toBe(
      "11 PM - 12 AM",
    );
    expect(formatAvailabilityTimeRange(lateNight, 24, enUS)).toBe(
      "23:00 - 00:00",
    );
  });

  test("24-hour times are padded and joined with a spaced dash", () => {
    expect(formatAvailabilityTimeRange(range("r", 18, 9, 13.5), 24, enUS)).toBe(
      "09:00 - 13:30",
    );
  });

  test("meeting lengths read in minutes and hours", () => {
    expect(formatMeetingDuration(15)).toBe("15 min");
    expect(formatMeetingDuration(60)).toBe("1 hour");
    expect(formatMeetingDuration(90)).toBe("1 hour 30 min");
    expect(formatMeetingDuration(120)).toBe("2 hours");
  });
});

test.describe("the text Copy puts on the clipboard", () => {
  test("no marked time is no text", () => {
    expect(formatAvailabilityText([], TEXT_OPTIONS)).toBe("");
  });

  test("one time is one sentence, as Notion Calendar writes it", () => {
    const text = formatAvailabilityText([range("a", 18, 11, 13)], TEXT_OPTIONS);

    expect(text).toBe(
      "Would 30 min anytime tomorrow Wed Nov 18, 11 AM - 1 PM (EST) work for you?",
    );
  });

  test("several times on one day are listed under the day", () => {
    const text = formatAvailabilityText(
      [range("b", 18, 14, 15), range("a", 18, 11, 13)],
      TEXT_OPTIONS,
    );

    expect(text).toBe(
      [
        "Would 30 min during any of these times (all in EST) tomorrow Wed Nov 18 work for you?",
        "- 11 AM - 1 PM",
        "- 2-3 PM",
      ].join("\n"),
    );
  });

  test("times on several days get a line per day", () => {
    const text = formatAvailabilityText(
      [
        range("a", 18, 11, 13),
        range("b", 18, 14, 15),
        range("c", 19, 16, 17.5),
      ],
      TEXT_OPTIONS,
    );

    expect(text).toBe(
      [
        "Would 30 min during any of these times (all in EST) work for you?",
        "- Tomorrow Wed Nov 18, 11 AM - 1 PM or 2-3 PM",
        "- Thu Nov 19, 4-5:30 PM",
      ].join("\n"),
    );
  });

  test("three times on a day are joined with commas and a last 'or'", () => {
    const text = formatAvailabilityText(
      [
        range("a", 19, 9, 10),
        range("b", 19, 11, 12),
        range("c", 19, 15, 16),
        range("d", 20, 9, 10),
      ],
      TEXT_OPTIONS,
    );

    expect(text.split("\n")[1]).toBe(
      "- Thu Nov 19, 9-10 AM, 11 AM - 12 PM or 3-4 PM",
    );
    expect(text.split("\n")[2]).toBe("- Fri Nov 20, 9-10 AM");
  });

  test("today reads 'today', and touching times read as one", () => {
    const text = formatAvailabilityText(
      [range("a", 17, 22, 23), range("b", 17, 23, 23.5)],
      TEXT_OPTIONS,
    );

    expect(text).toBe(
      "Would 30 min anytime today Tue Nov 17, 10-11:30 PM (EST) work for you?",
    );
  });

  test("a day in another year carries its year", () => {
    const nextYear: AvailabilityRange = {
      id: "jan",
      start: new Date(2027, 0, 6, 9, 0),
      end: new Date(2027, 0, 6, 10, 0),
    };

    expect(formatAvailabilityText([nextYear], TEXT_OPTIONS)).toBe(
      "Would 30 min anytime Wed Jan 6, 2027, 9-10 AM (EST) work for you?",
    );
  });

  test("a link is added after a blank line", () => {
    const text = formatAvailabilityText([range("a", 19, 9, 10)], {
      ...TEXT_OPTIONS,
      durationMinutes: 60,
      link: "https://example.com/meet/victor",
    });

    expect(text).toBe(
      [
        "Would 1 hour anytime Thu Nov 19, 9-10 AM (EST) work for you?",
        "",
        "You can just let me know or confirm here: https://example.com/meet/victor",
      ].join("\n"),
    );
  });

  test("a 24-hour clock and another locale change the times and names", () => {
    const text = formatAvailabilityText(
      [range("a", 19, 9, 10), range("b", 20, 14, 15.5)],
      { ...TEXT_OPTIONS, hourCycle: 24, locale: ptBR },
    );

    expect(text).toBe(
      [
        "Would 30 min during any of these times (all in EST) work for you?",
        "- quinta nov 19, 09:00 - 10:00",
        "- sexta nov 20, 14:00 - 15:30",
      ].join("\n"),
    );
  });

  test("the zone is the one the times fall in", () => {
    const summer: AvailabilityRange = {
      id: "jun",
      start: new Date(2026, 5, 4, 9, 0),
      end: new Date(2026, 5, 4, 10, 0),
    };

    expect(formatAvailabilityText([summer], TEXT_OPTIONS)).toContain("(EDT)");
  });
});
