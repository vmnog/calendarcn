import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { DetailedCalendarEvent } from "../src/components/calendar-types";
import { parseIcs, toIcs } from "../src/lib/ics";
import { createSampleEvents } from "../src/lib/sample-events";
import { FROZEN_NOW, calendarEvent, openCalendar } from "./helpers";

/** Folder with the .ics files the parser is checked against */
const FIXTURES_DIR = path.join(__dirname, "fixtures");

/** Docs page that shows the import / export example */
const IMPORT_EXPORT_PAGE = "/docs/import-export";

function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

function readFixture(name: string): string {
  return readFileSync(fixturePath(name), "utf8");
}

function findEvent(
  events: DetailedCalendarEvent[],
  id: string,
): DetailedCalendarEvent {
  const event = events.find((item) => item.id === id);
  if (!event) throw new Error(`No event with id ${id}`);
  return event;
}

/** Start and end as ISO strings, for comparing instants */
function isoRange(event: DetailedCalendarEvent): [string, string] {
  return [event.start.toISOString(), event.end.toISOString()];
}

test.describe("parseIcs", () => {
  test("reads a Google Calendar export", () => {
    const events = parseIcs(readFixture("google.ics"));

    // The cancelled occurrence is left out
    expect(events.map((event) => event.title)).toEqual([
      "Team sync",
      "Team sync (moved)",
      "Product review",
      "Company offsite",
      "Design conference",
    ]);

    const sync = findEvent(events, "7kukuqrfedlm2f9t0vvh6vbi1q@google.com");
    // TZID=America/Sao_Paulo, UTC-3
    expect(isoRange(sync)).toEqual([
      "2026-06-01T13:00:00.000Z",
      "2026-06-01T13:30:00.000Z",
    ]);
    expect(sync.recurrenceRule).toEqual({
      frequency: "weekly",
      weekdays: [1, 3, 5],
    });
    expect(sync.recurrence).toBeUndefined();
    expect(sync.description).toBe(
      "Agenda: blockers, wins; next steps.\nJoin: https://meet.google.com/abc-defg-hij",
    );
    expect(sync.location).toBe("Google Meet");
    expect(sync.status).toBe("busy");
    expect(sync.reminders).toEqual([{ amount: 10, unit: "minutes" }]);

    // An edited occurrence repeats the series' UID with a RECURRENCE-ID
    const moved = findEvent(
      events,
      "7kukuqrfedlm2f9t0vvh6vbi1q@google.com_20260603T100000",
    );
    expect(isoRange(moved)).toEqual([
      "2026-06-03T14:00:00.000Z",
      "2026-06-03T14:30:00.000Z",
    ]);

    // Folded across lines, with multi-byte characters and escapes
    const review = findEvent(events, "2b9qlh0r6k8s3fvdvm7oq0g5ne@google.com");
    expect(isoRange(review)).toEqual([
      "2026-06-02T15:00:00.000Z",
      "2026-06-02T16:30:00.000Z",
    ]);
    expect(review.description).toBe(
      "Revisão do produto com o time de São Paulo. Café e pão de queijo no começo, demo às 15h30; perguntas no fim. Leia o documento antes: https://docs.example.com/product-review",
    );
    expect(review.location).toBe("Sala Ipê, 3º andar");
    expect(review.reminders).toEqual([
      { amount: 1, unit: "hours" },
      { amount: 1, unit: "days" },
    ]);

    // DATE values: all-day, with the exclusive DTEND turned into the last day
    const offsite = findEvent(events, "0p1q2r3s4t5u6v7w8x9y0z1a2b@google.com");
    expect(offsite.isAllDay).toBe(true);
    expect(offsite.start).toEqual(new Date(2026, 5, 3));
    expect(offsite.end).toEqual(new Date(2026, 5, 3));
    expect(offsite.status).toBe("free");

    const conference = findEvent(
      events,
      "5c6d7e8f9g0h1i2j3k4l5m6n7o@google.com",
    );
    expect(conference.start).toEqual(new Date(2026, 5, 4));
    expect(conference.end).toEqual(new Date(2026, 5, 6));
  });

  test("reads an Apple Calendar export", () => {
    const events = parseIcs(readFixture("apple.ics"));
    expect(events).toHaveLength(3);

    const dinner = findEvent(events, "3F2504E0-4F89-11D3-9A0C-0305E82C3301");
    expect(dinner.title).toBe("Dinner with Sam");
    // TZID=America/New_York in June: EDT, UTC-4
    expect(isoRange(dinner)).toEqual([
      "2026-06-02T22:30:00.000Z",
      "2026-06-03T00:00:00.000Z",
    ]);
    // Quoted parameters with colons don't break the next properties
    expect(dinner.location).toBe("Joe's Pizza\n7 Carmine St, New York");
    // The absolute-time alarm is skipped
    expect(dinner.reminders).toEqual([{ amount: 30, unit: "minutes" }]);

    const birthday = findEvent(events, "B7A9C1E2-3D4F-4A5B-9C6D-7E8F9A0B1C2D");
    expect(birthday.isAllDay).toBe(true);
    expect(birthday.start).toEqual(new Date(2026, 5, 5));
    expect(birthday.end).toEqual(new Date(2026, 5, 5));
    expect(birthday.recurrenceRule).toEqual({ frequency: "yearly" });
    expect(birthday.reminders).toEqual([{ amount: 15, unit: "hours" }]);

    // December: EST, UTC-5
    const dentist = findEvent(events, "E1F2A3B4-C5D6-4E7F-8A9B-0C1D2E3F4A5B");
    expect(isoRange(dentist)).toEqual([
      "2026-12-15T14:00:00.000Z",
      "2026-12-15T15:00:00.000Z",
    ]);
  });

  test("reads an Outlook export with Windows time zones", () => {
    const events = parseIcs(readFixture("outlook.ics"));
    expect(events.map((event) => event.title)).toEqual([
      "Quarterly planning",
      "Focus time",
      "Sync with Bangalore",
      "Out of office",
    ]);

    // "Pacific Standard Time" comes from the file's VTIMEZONE: PDT in June
    const planning = events[0];
    expect(planning.id).toBe(
      "040000008200E00074C5B7101A82E0080000000010D7E2B3F4A1DB01000000000000000010000000A1B2C3D4E5F60718293A4B5C6D7E8F90",
    );
    expect(isoRange(planning)).toEqual([
      "2026-06-03T16:00:00.000Z",
      "2026-06-03T18:00:00.000Z",
    ]);
    expect(planning.visibility).toBe("private");
    expect(planning.description).toBe(
      "Quarterly planning.\n\nAgenda:\n- Roadmap\n- Hiring\n",
    );
    expect(planning.location).toBe("Conf Room 4 (Building 92)");
    expect(planning.reminders).toEqual([{ amount: 15, unit: "minutes" }]);

    // PST in December
    const focus = events[1];
    expect(isoRange(focus)).toEqual([
      "2026-12-10T21:00:00.000Z",
      "2026-12-10T23:00:00.000Z",
    ]);
    expect(focus.status).toBe("free");
    expect(focus.visibility).toBe("public");

    // A fixed-offset VTIMEZONE whose TZID holds commas and parentheses
    expect(isoRange(events[2])).toEqual([
      "2026-06-04T12:00:00.000Z",
      "2026-06-04T13:00:00.000Z",
    ]);

    const outOfOffice = events[3];
    expect(outOfOffice.isAllDay).toBe(true);
    expect(outOfOffice.start).toEqual(new Date(2026, 5, 5));
    expect(outOfOffice.end).toEqual(new Date(2026, 5, 5));
  });

  test("handles floating times, durations and malformed events", () => {
    const events = parseIcs(readFixture("edge-cases.ics"));

    // VTODO and the event without DTSTART are skipped; ids stay unique
    expect(events.map((event) => event.id)).toEqual([
      "floating",
      "duration",
      "payday",
      "two-days",
      "no-length",
      "unknown-zone",
      "mozilla-zone",
      "ics-event-8",
      "duplicate",
      "duplicate-2",
      "lowercase",
      "alarms",
      "untitled",
    ]);
    const byId = (id: string) => findEvent(events, id);

    // Floating times and unknown zones are read in the local time zone
    expect(byId("floating").start).toEqual(new Date(2026, 5, 1, 8));
    expect(byId("floating").end).toEqual(new Date(2026, 5, 1, 9));
    expect(byId("unknown-zone").start).toEqual(new Date(2026, 5, 3, 16));

    // An old Thunderbird TZID ends with an IANA name: Berlin, UTC+2
    expect(byId("mozilla-zone").start.toISOString()).toBe(
      "2026-06-03T07:00:00.000Z",
    );

    expect(isoRange(byId("duration"))).toEqual([
      "2026-06-02T12:00:00.000Z",
      "2026-06-02T13:30:00.000Z",
    ]);

    // A DATE without DTEND lasts one day; DURATION:P2D lasts two
    expect(byId("payday").end).toEqual(new Date(2026, 5, 4));
    expect(byId("two-days").start).toEqual(new Date(2026, 5, 8));
    expect(byId("two-days").end).toEqual(new Date(2026, 5, 9));

    // A DATE-TIME without DTEND or DURATION has no length
    expect(byId("no-length").end).toEqual(byId("no-length").start);

    // COLOR names map to event colors, other names are dropped
    expect(byId("floating").color).toBe("purple");
    expect(byId("duration").color).toBe("gray");
    expect(byId("payday").color).toBeUndefined();

    expect(byId("lowercase").title).toBe("Lowercase names");
    expect(byId("lowercase").description).toBe(
      "Path C:\\Users\\sam, folded with a tab",
    );

    // Alarms after the start or relative to the end are skipped
    expect(byId("alarms").title).toBe("Alarms");
    expect(byId("alarms").reminders).toEqual([
      { amount: 7, unit: "days" },
      { amount: 2, unit: "hours" },
      { amount: 0, unit: "minutes" },
    ]);
    expect(byId("untitled").title).toBe("");
  });

  test("returns no events for text that isn't iCalendar", () => {
    expect(parseIcs("")).toEqual([]);
    expect(parseIcs("Just some notes\nwith: colons")).toEqual([]);
  });
});

test.describe("toIcs", () => {
  const timestamp = new Date("2026-06-01T12:00:00Z");

  test("writes folded CRLF lines with escaped text", () => {
    const ics = toIcs(
      [
        {
          id: "event-1",
          title: "Review; budget, Q3",
          description: `Line one\nLine two with a backslash \\ and ${"long text ".repeat(12)}ação \u65E5\u672C\u8A9E \u{1D11E}`,
          start: new Date("2026-06-02T15:00:00Z"),
          end: new Date("2026-06-02T16:00:00Z"),
        },
      ],
      { calendarName: "Team", timestamp },
    );

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // Every line break is CRLF, and no line is longer than 75 octets
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    for (const line of ics.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(ics).toContain("X-WR-CALNAME:Team\r\n");
    expect(ics).toContain("SUMMARY:Review\\; budget\\, Q3\r\n");
    expect(ics).toContain("DTSTAMP:20260601T120000Z\r\n");
    expect(ics).toContain("DTSTART:20260602T150000Z\r\n");
  });

  test("round-trips events through parseIcs", () => {
    const events: DetailedCalendarEvent[] = [
      {
        id: "standup",
        title: "Standup",
        start: new Date("2026-06-01T13:00:00Z"),
        end: new Date("2026-06-01T13:15:00Z"),
        color: "blue",
        recurrenceRule: {
          frequency: "weekly",
          weekdays: [1, 2, 3, 4, 5],
          end: { type: "on", date: new Date(2026, 6, 31) },
        },
        location: "Room 1, 2nd floor",
        description: "Notes; links, and\nnew lines \\ backslashes",
        status: "busy",
        visibility: "private",
        reminders: [
          { amount: 10, unit: "minutes" },
          { amount: 2, unit: "hours" },
          { amount: 1, unit: "days" },
        ],
      },
      {
        id: "offsite",
        title: "Offsite",
        start: new Date(2026, 5, 3),
        end: new Date(2026, 5, 5),
        isAllDay: true,
        color: "green",
        status: "free",
        visibility: "public",
      },
      {
        id: "one-day",
        title: "Holiday",
        start: new Date(2026, 5, 6),
        end: new Date(2026, 5, 6),
        isAllDay: true,
      },
    ];

    expect(parseIcs(toIcs(events, { timestamp }))).toEqual(events);
  });

  test("leaves out recurrence that isn't a rule", () => {
    const ics = toIcs(
      [
        {
          id: "display-only",
          title: "Standup",
          start: new Date("2026-06-01T13:00:00Z"),
          end: new Date("2026-06-01T13:15:00Z"),
          recurrence: "Every weekday",
        },
      ],
      { timestamp },
    );
    expect(ics).not.toContain("RRULE");
    expect(parseIcs(ics)[0].recurrence).toBeUndefined();
  });

  test("writes repeat rules as RRULEs and reads them back", () => {
    const events: DetailedCalendarEvent[] = [
      {
        id: "biweekly",
        title: "Planning",
        start: new Date("2026-06-01T13:00:00Z"),
        end: new Date("2026-06-01T14:00:00Z"),
        recurrenceRule: {
          frequency: "weekly",
          interval: 2,
          weekdays: [1, 4],
          weekStartsOn: 0,
          end: { type: "after", count: 6 },
        },
      },
      {
        // Saturday, June 27 2026: the last Saturday of June
        id: "last-saturday",
        title: "Market",
        start: new Date("2026-06-27T14:00:00Z"),
        end: new Date("2026-06-27T15:00:00Z"),
        recurrenceRule: {
          frequency: "monthly",
          monthlyBy: "weekday-of-month",
          weekOfMonth: -1,
        },
      },
      {
        id: "anniversary",
        title: "Anniversary",
        start: new Date(2026, 5, 6),
        end: new Date(2026, 5, 6),
        isAllDay: true,
        recurrenceRule: {
          frequency: "yearly",
          end: { type: "on", date: new Date(2030, 5, 6) },
        },
      },
    ];
    const ics = toIcs(events, { timestamp });

    expect(ics).toContain(
      "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH;WKST=SU;COUNT=6\r\n",
    );
    expect(ics).toContain("RRULE:FREQ=MONTHLY;BYDAY=-1SA\r\n");
    // An all-day series ends on a DATE
    expect(ics).toContain("RRULE:FREQ=YEARLY;UNTIL=20300606\r\n");
    expect(parseIcs(ics)).toEqual(events);
  });

  test("ends a timed series at the end of its last day in its zone", () => {
    const ics = toIcs(
      [
        {
          id: "new-york",
          title: "Standup",
          start: new Date("2026-06-01T13:00:00Z"),
          end: new Date("2026-06-01T13:15:00Z"),
          timeZone: "America/New_York",
          recurrenceRule: {
            frequency: "daily",
            end: { type: "on", date: new Date(2026, 5, 5) },
          },
        },
      ],
      { timestamp },
    );
    // 11:59:59 PM on June 5 in New York (EDT, UTC-4)
    expect(ics).toContain("RRULE:FREQ=DAILY;UNTIL=20260606T035959Z\r\n");
  });

  test("keeps an RRULE a repeat rule can't hold as text", () => {
    for (const rrule of [
      "FREQ=MONTHLY;BYMONTHDAY=1,15",
      "FREQ=WEEKLY;BYDAY=MO;BYHOUR=9,17",
      // Monday, June 1 2026 isn't a Tuesday
      "FREQ=MONTHLY;BYDAY=2TU",
      "FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    ]) {
      const [event] = parseIcs(
        toIcs(
          [
            {
              id: "custom",
              title: "Custom",
              start: new Date("2026-06-01T13:00:00Z"),
              end: new Date("2026-06-01T14:00:00Z"),
              recurrence: rrule,
            },
          ],
          { timestamp },
        ),
      );
      expect(event.recurrenceRule, rrule).toBeUndefined();
      expect(event.recurrence, rrule).toBe(rrule);
    }
  });

  test("round-trips the sample events", () => {
    const events = createSampleEvents(FROZEN_NOW);
    const parsed = parseIcs(toIcs(events, { timestamp }));

    // Display-only recurrence strings ("Every weekday") aren't rules
    const expected = events.map(({ recurrence, ...event }) =>
      recurrence?.includes("FREQ=") ? { ...event, recurrence } : event,
    );
    expect(parsed).toEqual(expected);
  });

  test("re-imports parsed fixtures unchanged", () => {
    for (const name of [
      "google.ics",
      "apple.ics",
      "outlook.ics",
      "edge-cases.ics",
    ]) {
      const events = parseIcs(readFixture(name));
      expect(parseIcs(toIcs(events, { timestamp })), name).toEqual(events);
    }
  });
});

test.describe("import and export example", () => {
  /** The live preview on the docs page */
  function preview(page: Page): Locator {
    return page.locator('[data-example="ics-demo"]');
  }

  /** An event block in the preview's visible week, by title */
  function previewEvent(page: Page, title: string): Locator {
    return preview(page)
      .getByRole("button", { name: new RegExp(`^${escapeRegExp(title)}, `) })
      .and(page.locator("[data-event-id]"));
  }

  /**
   * The example's status line. The provider has its own (empty) status
   * region for drag announcements, so pick the paragraph.
   */
  function importStatus(page: Page): Locator {
    return preview(page).locator('p[role="status"]');
  }

  async function openExample(page: Page): Promise<void> {
    await page.clock.setFixedTime(FROZEN_NOW);
    await page.goto(IMPORT_EXPORT_PAGE);
    await expect(previewEvent(page, "Design review")).toBeVisible();
  }

  test("imports a file picked with Import .ics", async ({ page }) => {
    await openExample(page);

    await preview(page)
      .getByLabel("Import .ics file")
      .setInputFiles(fixturePath("google.ics"));

    await expect(importStatus(page)).toHaveText(
      "Imported 5 events from google.ics.",
    );
    for (const title of [
      "Team sync (moved)",
      "Product review",
      "Company offsite",
      "Design conference",
    ]) {
      await expect(previewEvent(page, title)).toBeInViewport();
    }
    // Imported next to the events the calendar already had
    await expect(previewEvent(page, "Design review")).toBeVisible();
  });

  test("imports a file dropped on the calendar", async ({ page }) => {
    await openExample(page);
    // The drop event carries the fixture as a File, like a drag from Finder
    const dataTransfer = await page.evaluateHandle((text) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([text], "outlook.ics", { type: "text/calendar" }),
      );
      return transfer;
    }, readFixture("outlook.ics"));

    await preview(page)
      .locator("[data-event-id]")
      .first()
      .dispatchEvent("dragenter", { dataTransfer });
    const dropZone = preview(page).getByTestId("ics-drop-zone");
    await expect(dropZone).toHaveText("Drop the .ics file to import it");
    await dropZone.dispatchEvent("drop", { dataTransfer });

    await expect(dropZone).toBeHidden();
    await expect(importStatus(page)).toHaveText(
      "Imported 4 events from outlook.ics.",
    );
    // 9 AM Pacific is noon in the test's New York time zone
    const planning = previewEvent(page, "Quarterly planning");
    await expect(planning).toBeInViewport();
    await expect(planning).toHaveAccessibleName(/12:00 PM to 2:00 PM/);
    await expect(previewEvent(page, "Out of office")).toBeInViewport();
  });

  test("exports the calendar's events", async ({ page }) => {
    await openExample(page);
    await preview(page)
      .getByLabel("Import .ics file")
      .setInputFiles(fixturePath("apple.ics"));
    await expect(importStatus(page)).toHaveText(
      "Imported 3 events from apple.ics.",
    );

    const downloadPromise = page.waitForEvent("download");
    await preview(page).getByRole("button", { name: "Export .ics" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("calendar.ics");
    const exported = parseIcs(readFileSync(await download.path(), "utf8"));

    // The sample events plus the imported ones, which survive the round trip
    const sampleEvents = createSampleEvents(FROZEN_NOW);
    expect(exported).toHaveLength(sampleEvents.length + 3);
    expect(exported.map((event) => event.id)).toEqual(
      expect.arrayContaining(sampleEvents.map((event) => event.id)),
    );
    for (const imported of parseIcs(readFixture("apple.ics"))) {
      expect(findEvent(exported, imported.id)).toEqual(imported);
    }
  });
});

test.describe("demo command menu", () => {
  test("imports and exports .ics files", async ({ page }) => {
    await openCalendar(page);
    const menu = page.getByRole("dialog", { name: "Command Menu" });

    await page.keyboard.press("ControlOrMeta+k");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await menu.getByRole("option", { name: "Import .ics file..." }).click();
    await (await fileChooserPromise).setFiles(fixturePath("google.ics"));
    await expect(menu).toBeHidden();
    // The week of the file's first event, June 1, is the current week
    await expect(calendarEvent(page, "Product review")).toBeInViewport();
    await expect(calendarEvent(page, "Design conference")).toBeInViewport();

    await page.keyboard.press("ControlOrMeta+k");
    const downloadPromise = page.waitForEvent("download");
    await menu.getByRole("option", { name: "Export .ics file" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("calendarcn.ics");
    const exported = parseIcs(readFileSync(await download.path(), "utf8"));
    for (const imported of parseIcs(readFixture("google.ics"))) {
      expect(findEvent(exported, imported.id)).toEqual(imported);
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
