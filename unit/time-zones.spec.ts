import { expect, test } from "@playwright/test";

import { getEventRecurrenceRule } from "../src/lib/recurrence";
import {
  getEventTimeZone,
  getZonedDay,
  isKnownTimeZone,
} from "../src/lib/time-zones";

/** Helpers in `src/lib/time-zones.ts`, run in Node without a page */

/** A zone name no runtime knows */
const UNKNOWN_ZONE = "Mars/Olympus";

test.describe("an event's time zone", () => {
  // 9 AM on Monday June 1 2026, in the zone the tests run in
  const start = new Date(2026, 5, 1, 9, 0);

  test("the runtime knows IANA zone names and no others", () => {
    expect(isKnownTimeZone("America/Sao_Paulo")).toBe(true);
    expect(isKnownTimeZone("UTC")).toBe(true);
    expect(isKnownTimeZone(UNKNOWN_ZONE)).toBe(false);
    expect(isKnownTimeZone("Pacific Standard Time")).toBe(false);
    expect(isKnownTimeZone("")).toBe(false);
  });

  test("a zone the runtime knows is the event's zone", () => {
    expect(getEventTimeZone({ timeZone: "America/Sao_Paulo" })).toBe(
      "America/Sao_Paulo",
    );
    expect(getEventTimeZone({})).toBeUndefined();
  });

  test("an unknown zone falls back to the viewer's zone", () => {
    expect(getEventTimeZone({ timeZone: UNKNOWN_ZONE })).toBeUndefined();
    expect(getEventTimeZone({ timeZone: "" })).toBeUndefined();
  });

  test("an unknown zone falls back to the zone of the legacy label", () => {
    expect(
      getEventTimeZone({ timeZone: UNKNOWN_ZONE, timezone: "GMT-3 Sao Paulo" }),
    ).toBe("America/Sao_Paulo");
  });

  test("an event in an unknown zone counts its days in the viewer's zone", () => {
    const timeZone = getEventTimeZone({ timeZone: UNKNOWN_ZONE });

    expect(getZonedDay(start, timeZone)).toEqual(new Date(2026, 5, 1));
  });

  test("the repeat text of an event in an unknown zone still reads as a rule", () => {
    const rule = getEventRecurrenceRule({
      id: "standup",
      title: "Standup",
      start,
      end: new Date(2026, 5, 1, 9, 30),
      recurrence: "RRULE:FREQ=WEEKLY;BYDAY=MO",
      timeZone: UNKNOWN_ZONE,
    });

    expect(rule).not.toBeNull();
  });
});
