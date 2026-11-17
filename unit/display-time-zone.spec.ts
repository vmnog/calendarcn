import { expect, test } from "@playwright/test";
import { startOfDay } from "date-fns";

import type { DetailedCalendarEvent } from "../src/components/calendar-types";
import { getPeriodStart } from "../src/lib/event-utils";
import { toIcs } from "../src/lib/ics";
import {
  expandRecurringEvents,
  findEventOrOccurrence,
} from "../src/lib/recurrence";
import {
  addTimeZone,
  fromDisplayEvent,
  fromDisplayRange,
  fromZonedWallClock,
  getTimeZoneOption,
  makeTimeZonePrimary,
  makeTimeZoneSecondary,
  parseOffsetQuery,
  removeTimeZone,
  replaceTimeZone,
  searchTimeZones,
  toDisplayEvent,
  toZonedWallClock,
} from "../src/lib/time-zones";

/**
 * A calendar drawn on a time zone's clock (`timeZone` on the provider): the
 * wall-clock mapping in `src/lib/time-zones.ts` and the repeats drawn on it,
 * run in Node. The tests run in America/New_York (package.json's
 * "test:unit"), so every zone here is far from the viewer's or changes its
 * clocks on other dates.
 */

test.describe("the calendar's clock", () => {
  test("an instant reads on Tokyo's clock and maps back", () => {
    // 8 AM in New York is 9 PM in Tokyo
    const instant = new Date("2026-06-04T12:00:00Z");
    const shown = toZonedWallClock(instant, "Asia/Tokyo");

    expect(shown).toEqual(new Date(2026, 5, 4, 21, 0));
    expect(fromZonedWallClock(shown, "Asia/Tokyo")).toEqual(instant);
  });

  test("without a zone both directions give back the same date", () => {
    const date = new Date(2026, 5, 4, 9, 0);

    expect(toZonedWallClock(date)).toBe(date);
    expect(fromZonedWallClock(date, undefined)).toBe(date);
  });

  test("a time the zone's clocks skip lands after the gap", () => {
    // London skips from 1 to 2 AM on March 29 2026: 1:30 is 2:30 BST
    expect(
      fromZonedWallClock(new Date(2026, 2, 29, 1, 30), "Europe/London"),
    ).toEqual(new Date("2026-03-29T01:30:00Z"));
    // Santiago, west of UTC, skips from midnight to 1 AM on September 6 2026
    expect(
      fromZonedWallClock(new Date(2026, 8, 6, 0, 30), "America/Santiago"),
    ).toEqual(new Date("2026-09-06T04:30:00Z"));
  });

  test("a time the zone's clocks show twice reads the same and maps to the first", () => {
    // London shows 1 to 2 AM twice on October 25 2026
    const first = new Date("2026-10-25T00:30:00Z");
    const second = new Date("2026-10-25T01:30:00Z");

    expect(toZonedWallClock(first, "Europe/London")).toEqual(
      new Date(2026, 9, 25, 1, 30),
    );
    expect(toZonedWallClock(second, "Europe/London")).toEqual(
      new Date(2026, 9, 25, 1, 30),
    );
    expect(
      fromZonedWallClock(new Date(2026, 9, 25, 1, 30), "Europe/London"),
    ).toEqual(first);
  });

  test("a zone that changes its clocks on other dates than the viewer's keeps its own hours", () => {
    // New York is on EDT from March 8, London on BST only from March 29
    expect(
      toZonedWallClock(new Date("2026-03-20T14:00:00Z"), "Europe/London"),
    ).toEqual(new Date(2026, 2, 20, 14, 0));
    expect(
      toZonedWallClock(new Date("2026-03-31T13:00:00Z"), "Europe/London"),
    ).toEqual(new Date(2026, 2, 31, 14, 0));
    expect(
      fromZonedWallClock(new Date(2026, 2, 20, 14, 0), "Europe/London"),
    ).toEqual(new Date("2026-03-20T14:00:00Z"));
    // London is back on GMT from October 25, New York on EST only from November 1
    expect(
      fromZonedWallClock(new Date(2026, 9, 28, 9, 0), "Europe/London"),
    ).toEqual(new Date("2026-10-28T09:00:00Z"));
  });

  test("today and the week follow the zone's clock", () => {
    // Saturday 8 PM in New York is already Sunday 9 AM in Tokyo
    const now = toZonedWallClock(
      new Date("2026-06-06T20:00:00-04:00"),
      "Asia/Tokyo",
    );

    expect(now).toEqual(new Date(2026, 5, 7, 9, 0));
    expect(startOfDay(now)).toEqual(new Date(2026, 5, 7));
    expect(getPeriodStart(now, "week", 0, 7)).toEqual(new Date(2026, 5, 7));
  });
});

test.describe("events on the calendar's clock", () => {
  // 9 to 10 PM in Tokyo, 8 to 9 AM in New York
  const call: DetailedCalendarEvent = {
    id: "call",
    title: "Call",
    start: new Date("2026-06-04T12:00:00Z"),
    end: new Date("2026-06-04T13:00:00Z"),
  };
  const offsite: DetailedCalendarEvent = {
    id: "offsite",
    title: "Offsite",
    start: new Date(2026, 5, 9),
    end: new Date(2026, 5, 9),
    isAllDay: true,
  };

  test("a timed event reads on the zone's clock", () => {
    const shown = toDisplayEvent(call, "Asia/Tokyo");

    expect(shown.start).toEqual(new Date(2026, 5, 4, 21, 0));
    expect(shown.end).toEqual(new Date(2026, 5, 4, 22, 0));
    expect(shown.title).toBe("Call");
    expect(call.start).toEqual(new Date("2026-06-04T12:00:00Z"));
  });

  test("all-day events, and every event without a zone, stay as they are", () => {
    expect(toDisplayEvent(offsite, "Asia/Tokyo")).toBe(offsite);
    expect(toDisplayEvent(call, undefined)).toBe(call);
  });

  test("the same event gives back the same drawn copy, and that copy the same event", () => {
    const shown = toDisplayEvent(call, "Asia/Tokyo");

    expect(toDisplayEvent(call, "Asia/Tokyo")).toBe(shown);
    expect(fromDisplayEvent(shown, "Asia/Tokyo")).toBe(call);
  });

  test("a moved event maps back to the instant the zone's clock reads", () => {
    const moved = {
      ...toDisplayEvent(call, "Asia/Tokyo"),
      start: new Date(2026, 5, 5, 9, 0),
      end: new Date(2026, 5, 5, 10, 0),
    };
    const stored = fromDisplayEvent(moved, "Asia/Tokyo", call);

    expect(stored.start).toEqual(new Date("2026-06-05T00:00:00Z"));
    expect(stored.end).toEqual(new Date("2026-06-05T01:00:00Z"));
  });

  test("a time an edit didn't change keeps its instant", () => {
    // 1:30 AM GMT: the second 1:30 on London's clock on October 25 2026
    const late: DetailedCalendarEvent = {
      id: "late",
      title: "Late",
      start: new Date("2026-10-25T01:30:00Z"),
      end: new Date("2026-10-25T02:30:00Z"),
    };
    const renamed = {
      ...toDisplayEvent(late, "Europe/London"),
      title: "Later",
    };

    const stored = fromDisplayEvent(renamed, "Europe/London", late);
    expect(stored.start).toEqual(late.start);
    expect(stored.end).toEqual(late.end);
    expect(stored.title).toBe("Later");
    // Without the event it came from, 1:30 is the first one
    expect(fromDisplayEvent(renamed, "Europe/London").start).toEqual(
      new Date("2026-10-25T00:30:00Z"),
    );
  });

  test("an event in the hour the viewer's clocks skip keeps its times", () => {
    // 2:30 to 3:30 AM in London on March 8 2026, when New York skips 2 to 3 AM
    const early: DetailedCalendarEvent = {
      id: "early",
      title: "Early",
      start: new Date("2026-03-08T02:30:00Z"),
      end: new Date("2026-03-08T03:30:00Z"),
    };
    const shown = toDisplayEvent(early, "Europe/London");
    // A local 2:30 AM doesn't exist in New York that night: drawn from 3:30
    expect(shown.start).toEqual(new Date(2026, 2, 8, 3, 30));

    const stored = fromDisplayEvent(
      { ...shown, title: "Earlier" },
      "Europe/London",
      early,
    );
    expect(stored.start).toEqual(early.start);
    expect(stored.end).toEqual(early.end);
  });

  test("an all-day event switched to timed reads its times on the zone's clock", () => {
    const timed = {
      ...offsite,
      isAllDay: false,
      start: new Date(2026, 5, 9, 9, 0),
      end: new Date(2026, 5, 9, 10, 0),
    };

    expect(fromDisplayEvent(timed, "Asia/Tokyo", offsite).start).toEqual(
      new Date("2026-06-09T00:00:00Z"),
    );
  });

  test("a timed event switched to all-day keeps the day the zone's clock shows", () => {
    const allDay = { ...toDisplayEvent(call, "Asia/Tokyo"), isAllDay: true };
    const stored = fromDisplayEvent(allDay, "Asia/Tokyo", call);

    expect(stored.start).toEqual(new Date(2026, 5, 4, 21, 0));
    expect(stored.isAllDay).toBe(true);
  });

  test("a new event maps both of its times", () => {
    const created: DetailedCalendarEvent = {
      id: "new",
      title: "New event",
      start: new Date(2026, 5, 8, 15, 0),
      end: new Date(2026, 5, 8, 16, 0),
    };
    const stored = fromDisplayEvent(created, "Asia/Tokyo");

    expect(stored.start).toEqual(new Date("2026-06-08T06:00:00Z"));
    expect(stored.end).toEqual(new Date("2026-06-08T07:00:00Z"));
  });

  test("days on the calendar's clock map to the instants they start", () => {
    const week = { start: new Date(2026, 5, 7), end: new Date(2026, 5, 14) };

    expect(fromDisplayRange(week, "Asia/Tokyo")).toEqual({
      start: new Date("2026-06-06T15:00:00Z"),
      end: new Date("2026-06-13T15:00:00Z"),
    });
    // Santiago skips midnight on September 6 2026: that day starts at 1 AM
    expect(
      fromDisplayRange(
        { start: new Date(2026, 8, 6), end: new Date(2026, 8, 7) },
        "America/Santiago",
      ),
    ).toEqual({
      start: new Date("2026-09-06T04:00:00Z"),
      end: new Date("2026-09-07T03:00:00Z"),
    });
    expect(fromDisplayRange(week, undefined)).toBe(week);
  });

  test("an event edited on the calendar's clock writes the same .ics", () => {
    const timestamp = new Date("2026-06-01T12:00:00Z");
    const renamed = fromDisplayEvent(
      { ...toDisplayEvent(call, "Asia/Tokyo"), title: "Call" },
      "Asia/Tokyo",
      call,
    );

    expect(toIcs([renamed], { timestamp })).toBe(toIcs([call], { timestamp }));
  });

  test("an event moved on the calendar's clock writes its new instant", () => {
    const moved = fromDisplayEvent(
      {
        ...toDisplayEvent(call, "Asia/Tokyo"),
        start: new Date(2026, 5, 5, 9, 0),
        end: new Date(2026, 5, 5, 10, 0),
      },
      "Asia/Tokyo",
      call,
    );
    const ics = toIcs([moved], { timestamp: new Date("2026-06-01T12:00:00Z") });

    expect(ics).toContain("DTSTART:20260605T000000Z\r\n");
    expect(ics).toContain("DTEND:20260605T010000Z\r\n");
  });
});

test.describe("repeats on the calendar's clock", () => {
  // Every week on Thursday, 8 AM in New York (9 PM in Tokyo)
  const weekly: DetailedCalendarEvent = {
    id: "sync",
    title: "Sync",
    start: new Date("2026-06-04T12:00:00Z"),
    end: new Date("2026-06-04T13:00:00Z"),
    recurrenceRule: { frequency: "weekly" },
  };
  // Every day, all day, from Monday June 8
  const daily: DetailedCalendarEvent = {
    id: "focus",
    title: "Focus",
    start: new Date(2026, 5, 8),
    end: new Date(2026, 5, 8),
    isAllDay: true,
    recurrenceRule: { frequency: "daily" },
  };
  /** Tokyo's week of Sunday June 7, as local midnights */
  const tokyoWeek = {
    start: new Date(2026, 5, 7),
    end: new Date(2026, 5, 14),
  };

  test("a series without a zone repeats at the viewer's clock time, drawn on the calendar's", () => {
    const drawn = expandRecurringEvents(
      [toDisplayEvent(weekly, "Asia/Tokyo")],
      tokyoWeek,
      "Asia/Tokyo",
    );

    // The Thursday after: 8 AM in New York is 9 PM Thursday in Tokyo
    expect(drawn.map((event) => event.id)).toEqual(["sync-2026-06-11"]);
    expect(drawn[0].start).toEqual(new Date(2026, 5, 11, 21, 0));
    // Mapped back, it is the instant the series repeats at
    expect(fromDisplayEvent(drawn[0], "Asia/Tokyo").start).toEqual(
      new Date("2026-06-11T12:00:00Z"),
    );
  });

  test("a series in its own zone keeps that zone's clock time", () => {
    // 9 AM in São Paulo every week: 9 PM in Tokyo
    const saoPaulo: DetailedCalendarEvent = {
      ...weekly,
      id: "sao-paulo",
      timeZone: "America/Sao_Paulo",
      start: new Date("2026-06-04T12:00:00Z"),
      end: new Date("2026-06-04T13:00:00Z"),
    };
    const drawn = expandRecurringEvents(
      [toDisplayEvent(saoPaulo, "Asia/Tokyo")],
      tokyoWeek,
      "Asia/Tokyo",
    );

    expect(drawn.map((event) => event.start)).toEqual([
      new Date(2026, 5, 11, 21, 0),
    ]);
  });

  test("an all-day series keeps its dates, every day of the range", () => {
    const drawn = expandRecurringEvents([daily], tokyoWeek, "Asia/Tokyo");
    const days = drawn
      .filter((event) => event.start >= tokyoWeek.start)
      .filter((event) => event.start < tokyoWeek.end)
      .map((event) => event.start.getDate());

    expect(days).toEqual([8, 9, 10, 11, 12, 13]);
  });

  test("events that don't repeat come back as the same drawn copies", () => {
    const call: DetailedCalendarEvent = {
      id: "call",
      title: "Call",
      start: new Date("2026-06-09T00:00:00Z"),
      end: new Date("2026-06-09T01:00:00Z"),
    };
    const shown = toDisplayEvent(call, "Asia/Tokyo");

    expect(expandRecurringEvents([shown], tokyoWeek, "Asia/Tokyo")[0]).toBe(
      shown,
    );
  });

  test("an occurrence is found by its id on the calendar's clock", () => {
    const found = findEventOrOccurrence(
      [toDisplayEvent(weekly, "Asia/Tokyo")],
      "sync-2026-06-11",
      "Asia/Tokyo",
    );

    expect(found?.start).toEqual(new Date(2026, 5, 11, 21, 0));
    expect(found?.seriesId).toBe("sync");
  });
});

test.describe("the zones beside the time axis", () => {
  /** São Paulo primary, Toronto beside it: the maintainer's Notion setup */
  const zones = {
    primary: "America/Sao_Paulo",
    secondary: ["America/Toronto"],
  };

  test("an added zone becomes the left-most column, once", () => {
    const added = addTimeZone(zones, "Asia/Tokyo");

    expect(added.secondary).toEqual(["Asia/Tokyo", "America/Toronto"]);
    expect(addTimeZone(added, "Asia/Tokyo")).toBe(added);
    expect(addTimeZone(zones, "America/Sao_Paulo")).toBe(zones);
  });

  test("a removed zone leaves; the primary one hands over to its neighbor", () => {
    const three = addTimeZone(zones, "Asia/Tokyo");

    expect(removeTimeZone(three, "Asia/Tokyo")).toEqual(zones);
    expect(removeTimeZone(three, "America/Sao_Paulo")).toEqual({
      primary: "America/Toronto",
      secondary: ["Asia/Tokyo"],
    });
    // The only zone stays
    const alone = { primary: "Asia/Tokyo", secondary: [] };
    expect(removeTimeZone(alone, "Asia/Tokyo")).toBe(alone);
  });

  test("a zone made primary moves next to the days and the others shift left", () => {
    const three = addTimeZone(zones, "Asia/Tokyo");

    expect(makeTimeZonePrimary(three, "Asia/Tokyo")).toEqual({
      primary: "Asia/Tokyo",
      secondary: ["America/Toronto", "America/Sao_Paulo"],
    });
    // A zone travelled to, not in the list yet
    expect(makeTimeZonePrimary(zones, "Europe/London")).toEqual({
      primary: "Europe/London",
      secondary: ["America/Toronto", "America/Sao_Paulo"],
    });
  });

  test("the primary zone made secondary swaps with its neighbor", () => {
    expect(makeTimeZoneSecondary(zones)).toEqual({
      primary: "America/Toronto",
      secondary: ["America/Sao_Paulo"],
    });
    const alone = { primary: "Asia/Tokyo", secondary: [] };
    expect(makeTimeZoneSecondary(alone)).toBe(alone);
  });

  test("a changed zone takes the other's place", () => {
    expect(replaceTimeZone(zones, "America/Toronto", "Asia/Tokyo")).toEqual({
      primary: "America/Sao_Paulo",
      secondary: ["Asia/Tokyo"],
    });
    expect(
      replaceTimeZone(zones, "America/Sao_Paulo", "Europe/London"),
    ).toEqual({ primary: "Europe/London", secondary: ["America/Toronto"] });
    // To the primary zone: that column goes
    expect(
      replaceTimeZone(zones, "America/Toronto", "America/Sao_Paulo"),
    ).toEqual({ primary: "America/Sao_Paulo", secondary: [] });
  });

  test("a search finds zones by offset too", () => {
    const june = new Date("2026-06-04T12:00:00Z");
    const options = [
      "America/Sao_Paulo",
      "Asia/Kolkata",
      "Asia/Seoul",
      "Asia/Tokyo",
    ].map((zone) => getTimeZoneOption(june, zone));
    const ids = (query: string) =>
      searchTimeZones(options, query).map((option) => option.id);

    expect(parseOffsetQuery("GMT+9")).toBe(540);
    expect(parseOffsetQuery("\u221203:00")).toBe(-180);
    expect(parseOffsetQuery("+5:30")).toBe(330);
    expect(parseOffsetQuery("Tokyo")).toBeNull();
    expect(ids("+9")).toEqual(["Asia/Seoul", "Asia/Tokyo"]);
    expect(ids("utc-3")).toEqual(["America/Sao_Paulo"]);
    expect(ids("+05:30")).toEqual(["Asia/Kolkata"]);
    expect(ids("tok")).toEqual(["Asia/Tokyo"]);
  });
});
