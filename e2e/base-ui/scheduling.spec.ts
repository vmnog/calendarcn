import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, boxOf, hourHeight } from "../helpers";

/**
 * Scheduling in a shadcn/ui project set up with Base UI: `/scheduling`
 * renders `@calendarcn/calendar-app` with an `onCreateSchedulingLink` that
 * writes each request into an output, the way an app with a booking backend
 * wires the scheduling links. Thursday June 4 2026, America/New_York.
 */

/** Opens `/scheduling` on the frozen test date */
async function openScheduling(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/scheduling");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
}

/** The link requests the page received, as JSON */
async function readRequests(page: Page) {
  const text = await page.getByTestId("scheduling-requests").textContent();
  return JSON.parse(text ?? "[]") as {
    kind: string;
    durationMinutes: number;
    timeZone: string;
    ranges: { start: string; end: string }[];
  }[];
}

/** The layer for marking times on one day, e.g. "Friday, June 5" */
function markingDay(page: Page, fullDate: string): Locator {
  return page.getByRole("group", {
    name: `Mark available times on ${fullDate}`,
  });
}

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openScheduling(page);
});

test("the Scheduling row opens a menu, and a recurring link goes to the app", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Scheduling" }).click();
  await expect(
    page.getByRole("menuitem", { name: /Share availability/ }),
  ).toBeVisible();
  await page.getByRole("menuitem", { name: "Create recurring link" }).click();

  await expect
    .poll(() => readRequests(page))
    .toEqual([
      {
        kind: "recurring",
        durationMinutes: 30,
        timeZone: "America/New_York",
        ranges: [],
      },
    ]);
});

test("a one-off link marks times first, and Create hands them to the app", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  await expect(
    menu.getByRole("option", { name: "Create recurring scheduling link..." }),
  ).toBeVisible();
  await menu
    .getByRole("option", { name: "Create one-off scheduling link..." })
    .click();

  const panel = page.getByTestId("availability-panel");
  await expect(
    panel.getByRole("heading", { name: "One-off link" }),
  ).toBeVisible();

  const friday = markingDay(page, "Friday, June 5");
  const box = await boxOf(friday);
  const hour = await hourHeight(page);
  await page.mouse.move(box.x + box.width / 2, box.y + 10.1 * hour);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 11.85 * hour, {
    steps: 8,
  });
  await page.mouse.up();

  await panel.getByRole("button", { name: "Create", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect
    .poll(() => readRequests(page))
    .toEqual([
      {
        kind: "one-off",
        durationMinutes: 30,
        timeZone: "America/New_York",
        ranges: [
          {
            start: "2026-06-05T14:00:00.000Z",
            end: "2026-06-05T16:00:00.000Z",
          },
        ],
      },
    ]);
  // The output collapses the text's line breaks into spaces
  await expect(page.getByTestId("scheduling-text")).toHaveText(
    [
      "Would 30 min anytime tomorrow Fri Jun 5, 10 AM - 12 PM (EDT) work for you?",
      "You can just let me know or confirm here: https://example.com/meet/you",
    ].join("\n\n"),
  );
});

test("sharing availability copies the text in Base UI too", async ({
  page,
}) => {
  await page.keyboard.press("s");
  const panel = page.getByTestId("availability-panel");
  await panel.getByRole("button", { name: "Duration: 30 min" }).click();
  await page.getByRole("menuitem", { name: "45 min", exact: true }).click();

  const saturday = markingDay(page, "Saturday, June 6");
  const box = await boxOf(saturday);
  const hour = await hourHeight(page);
  await page.mouse.click(box.x + box.width / 2, box.y + 9.1 * hour);

  await panel.getByRole("button", { name: "Copy", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Would 45 min anytime Sat Jun 6, 9-9:45 AM (EDT) work for you?",
  );
  await expect(panel).toHaveCount(0);
});
