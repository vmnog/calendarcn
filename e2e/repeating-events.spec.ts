import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  detailFields,
  detailTitle,
  dragBy,
  expectHeader,
  hourHeight,
  monthCell,
  openCalendar,
} from "./helpers";

/**
 * Repeating events drawn on every date of their rule (ADR-007). In the
 * sample data, "Launch Review" repeats every 2 weeks on Saturday, 6 times,
 * from Saturday June 6 2026, 10 to 11:30 AM in the test's New York time
 * (11 AM in its São Paulo zone): June 6 and 20, July 4 and 18, August 1
 * and 15. Its event is the series; the other dates are generated.
 */

/** The .ics file Google Calendar exports, shared with the .ics tests */
const GOOGLE_ICS = path.join(__dirname, "fixtures", "google.ics");

/** "Launch Review" on one of its dates, by the date's name ("June 20") */
function launchReview(page: Page, date: string): Locator {
  return page.getByRole("main").getByRole("button", {
    name: new RegExp(`^Launch Review, .*Saturday, ${date}$`),
  });
}

/** The sidebars' inline columns, where the event search lists its results */
function contextPanel(page: Page): Locator {
  return page.locator('[data-slot="sidebar-container"]');
}

/** One section of the details panel */
function detailSection(page: Page, name: string): Locator {
  return page.locator(`[data-section="${name}"]`);
}

/** Exports the calendar from the command menu and returns the file's text */
async function exportIcs(page: Page): Promise<string> {
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  const download = page.waitForEvent("download");
  await menu.getByRole("option", { name: /^Export \.ics file/ }).click();
  return readFile(await (await download).path(), "utf8");
}

/** How many lines of an .ics file read exactly `line` */
function countLines(ics: string, line: string): number {
  return ics.split("\r\n").filter((each) => each === line).length;
}

/** Goes `weeks` weeks forward with the header's arrow */
async function nextWeeks(page: Page, weeks: number): Promise<void> {
  for (let week = 0; week < weeks; week++) {
    await page.getByRole("button", { name: "Next week" }).click();
  }
}

/**
 * Waits until a locator stops moving, such as after the week's slide
 * animation, so a drag measures where the event rests
 */
async function waitUntilSettled(locator: Locator): Promise<void> {
  let previous = "";
  await expect
    .poll(
      async () => {
        const box = await locator.boundingBox();
        const current = box ? `${box.x},${box.y}` : "";
        const settled = current !== "" && current === previous;
        previous = current;
        return settled;
      },
      { intervals: [100] },
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("a repeating event is drawn on every date of its rule, in every view", async ({
  page,
}) => {
  // Week view, two weeks on: its second date
  await nextWeeks(page, 2);
  await expectHeader(page, "June 2026 Week 25");
  await expect(launchReview(page, "June 20")).toBeInViewport();

  // Month view: every other Saturday
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await page.keyboard.press("m");
  await expectHeader(page, "June 2026");
  await expect(launchReview(page, "June 6")).toBeVisible();
  await expect(launchReview(page, "June 20")).toBeVisible();
  await expect(launchReview(page, "July 4")).toBeVisible();
  await expect(
    monthCell(page, "2026-06-13").getByRole("button", {
      name: /^Launch Review, /,
    }),
  ).toHaveCount(0);

  // Six times: August 15 is the last
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await expectHeader(page, "August 2026");
  await expect(launchReview(page, "August 15")).toBeVisible();
  await expect(
    monthCell(page, "2026-08-29").getByRole("button", {
      name: /^Launch Review, /,
    }),
  ).toHaveCount(0);

  // The agenda lists it under each of its dates
  await page.keyboard.press("a");
  await expect(
    page
      .getByRole("main")
      .getByRole("group", { name: "Saturday, August 1", exact: true })
      .getByRole("button", { name: /^Launch Review, / }),
  ).toHaveCount(1);
});

test("editing one date changes only that date, and the export writes it as an edited occurrence", async ({
  page,
}) => {
  await nextWeeks(page, 2);
  await launchReview(page, "June 20").click();
  const fields = detailFields(page);
  await expect(detailTitle(page)).toHaveValue("Launch Review");
  await expect(fields.startDate).toHaveValue("Sat Jun 20");

  await fields.startTime.fill("2p");
  await fields.startTime.press("Enter");
  await expect(launchReview(page, "June 20")).toHaveAccessibleName(
    /2:00 PM to 3:30 PM/,
  );

  // The other dates keep the series' time
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(launchReview(page, "June 6")).toHaveAccessibleName(
    /10:00 AM to 11:30 AM/,
  );
  await nextWeeks(page, 4);
  await expectHeader(page, "July 2026 Week 27");
  await expect(launchReview(page, "July 4")).toHaveAccessibleName(
    /10:00 AM to 11:30 AM/,
  );

  // The series once, and June 20 as its edited occurrence
  const ics = await exportIcs(page);
  expect(countLines(ics, "SUMMARY:Launch Review")).toBe(2);
  expect(
    countLines(ics, "RECURRENCE-ID;TZID=America/Sao_Paulo:20260620T110000"),
  ).toBe(1);
  expect(
    countLines(ics, "DTSTART;TZID=America/Sao_Paulo:20260620T150000"),
  ).toBe(1);
});

test("dragging one date moves only that date", async ({ page }) => {
  await nextWeeks(page, 2);
  await expectHeader(page, "June 2026 Week 25");
  await waitUntilSettled(launchReview(page, "June 20"));
  // One hour earlier
  await dragBy(page, launchReview(page, "June 20"), {
    dx: 0,
    dy: -(await hourHeight(page)),
    offsetY: 20,
  });
  await expect(launchReview(page, "June 20")).toHaveAccessibleName(
    /9:00 AM to 10:30 AM/,
  );

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(launchReview(page, "June 6")).toHaveAccessibleName(
    /10:00 AM to 11:30 AM/,
  );
});

test("the keyboard moves the date it is focused on", async ({ page }) => {
  await nextWeeks(page, 2);
  await launchReview(page, "June 20").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(launchReview(page, "June 20")).toHaveAccessibleName(
    /10:15 AM to 11:45 AM/,
  );

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(launchReview(page, "June 6")).toHaveAccessibleName(
    /10:00 AM to 11:30 AM/,
  );
});

test("the series arrows select the drawn date and add nothing", async ({
  page,
}) => {
  await launchReview(page, "June 6").click();
  await detailSection(page, "recurrence")
    .getByRole("button", { name: "Go to next event in this series" })
    .click();
  await expectHeader(page, "June 2026 Week 25");
  await expect(launchReview(page, "June 20")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("main").getByRole("button", { name: /^Launch Review, / }),
  ).toHaveCount(1);

  const ics = await exportIcs(page);
  expect(countLines(ics, "SUMMARY:Launch Review")).toBe(1);
});

test("event search lists each date of a repeating event", async ({ page }) => {
  await page.getByPlaceholder("Search events").fill("launch");
  const results = contextPanel(page).getByText("Launch Review", {
    exact: true,
  });
  await expect(results).toHaveCount(6);

  await results.nth(1).click();
  await expect(detailTitle(page)).toHaveValue("Launch Review");
  await expect(detailFields(page).startDate).toHaveValue("Sat Jun 20");
});

test("an imported series skips its cancelled date and draws its moved one once", async ({
  page,
}) => {
  // google.ics: "Team sync" every Monday, Wednesday and Friday from June 1,
  // 9 to 9:30 AM here; June 3 moved to 10 AM, June 5 cancelled
  await page.keyboard.press("ControlOrMeta+k");
  const fileChooser = page.waitForEvent("filechooser");
  await page
    .getByRole("dialog", { name: "Command Menu" })
    .getByRole("option", { name: "Import .ics file..." })
    .click();
  await (await fileChooser).setFiles(GOOGLE_ICS);

  const teamSync = (day: string) =>
    page.getByRole("main").getByRole("button", {
      name: new RegExp(`^Team sync, .*${day}$`),
    });
  await expect(teamSync("Monday, June 1")).toHaveCount(1);
  await expect(teamSync("Wednesday, June 3")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("button", {
      name: /^Team sync \(moved\), .*Wednesday, June 3$/,
    }),
  ).toHaveCount(1);
  await expect(teamSync("Friday, June 5")).toHaveCount(0);
  // The week after, in the grid's buffer
  await expect(teamSync("Monday, June 8")).toHaveCount(1);
});

test("undo takes an edited date back to its generated time, and redo edits it again", async ({
  page,
}) => {
  await nextWeeks(page, 2);
  await expectHeader(page, "June 2026 Week 25");
  await waitUntilSettled(launchReview(page, "June 20"));
  await dragBy(page, launchReview(page, "June 20"), {
    dx: 0,
    dy: -(await hourHeight(page)),
    offsetY: 20,
  });
  await expect(launchReview(page, "June 20")).toHaveAccessibleName(
    /9:00 AM to 10:30 AM/,
  );

  // One step: the stored date goes and the generated one is drawn again
  await page.keyboard.press("ControlOrMeta+z");
  await expect(launchReview(page, "June 20")).toHaveAccessibleName(
    /10:00 AM to 11:30 AM/,
  );
  await expect(launchReview(page, "June 20")).toHaveCount(1);
  expect(countLines(await exportIcs(page), "SUMMARY:Launch Review")).toBe(1);

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(launchReview(page, "June 20")).toHaveAccessibleName(
    /9:00 AM to 10:30 AM/,
  );
  await expect(launchReview(page, "June 20")).toHaveCount(1);
  expect(countLines(await exportIcs(page), "SUMMARY:Launch Review")).toBe(2);
});

test("deleting one date leaves the others, and undo brings it back", async ({
  page,
}) => {
  await nextWeeks(page, 2);
  await launchReview(page, "June 20").click();
  await page.keyboard.press("Delete");
  await expect(launchReview(page, "June 20")).toHaveCount(0);
  // The date after it stays
  await nextWeeks(page, 2);
  await expect(launchReview(page, "July 4")).toHaveCount(1);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(launchReview(page, "June 6")).toHaveCount(1);

  // The series skips it: one EXDATE, and the series is still one event
  const exdate = "EXDATE;TZID=America/Sao_Paulo:20260620T110000";
  const ics = await exportIcs(page);
  expect(countLines(ics, exdate)).toBe(1);
  expect(countLines(ics, "SUMMARY:Launch Review")).toBe(1);

  await page.keyboard.press("ControlOrMeta+z");
  await nextWeeks(page, 2);
  await expect(launchReview(page, "June 20")).toHaveAccessibleName(
    /10:00 AM to 11:30 AM/,
  );
  await expect(launchReview(page, "June 20")).toHaveCount(1);
  expect(countLines(await exportIcs(page), exdate)).toBe(0);
});

test("duplicating a date adds a single event on that date", async ({
  page,
}) => {
  await nextWeeks(page, 2);
  await launchReview(page, "June 20").click();
  await page.keyboard.press("ControlOrMeta+d");

  // The original date stays as it was, and the copy is drawn beside it
  await expect(launchReview(page, "June 20")).toHaveCount(2);
  await expect(
    page.getByRole("main").getByRole("button", {
      name: /^Launch Review, 10:00 AM to 11:30 AM, Saturday, June 20$/,
    }),
  ).toHaveCount(2);

  // The copy is a single event: the export has the series and the copy,
  // only the series writes a rule, and neither writes a RECURRENCE-ID
  const ics = await exportIcs(page);
  expect(countLines(ics, "SUMMARY:Launch Review")).toBe(2);
  expect(ics.split("\r\nRRULE:")).toHaveLength(2);
  expect(ics).not.toContain("RECURRENCE-ID");

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(launchReview(page, "June 6")).toHaveCount(1);

  // The copy doesn't repeat: July 4 is still drawn once
  await nextWeeks(page, 4);
  await expectHeader(page, "July 2026 Week 27");
  await expect(launchReview(page, "July 4")).toHaveCount(1);

  await page.keyboard.press("ControlOrMeta+z");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await nextWeeks(page, 2);
  await expect(launchReview(page, "June 20")).toHaveCount(1);
});
