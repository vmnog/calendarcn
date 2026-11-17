import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  dragBy,
  hourHeight,
  monthCell,
  openCalendar,
} from "./helpers";

/**
 * The command menu's "Start week on...", "Set number of displayed days..."
 * and hour size commands (Default hour size, Zoom hours in, Zoom hours out),
 * and their keys. The demo starts on the week of Sunday, May 31 2026, at the
 * default hour height, which fills the screen (48px at this viewport).
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** A day column of the time grid, by its full date ("Monday, June 1") */
function dayColumn(page: Page, date: string): Locator {
  return page.getByRole("main").getByRole("group", { name: date, exact: true });
}

/** Whether a day column is on screen: off-screen buffer columns are inert */
async function expectOnScreen(column: Locator, onScreen: boolean) {
  if (onScreen) {
    await expect(column).not.toHaveAttribute("inert", "");
    return;
  }
  await expect(column).toHaveAttribute("inert", "");
}

/** The open command menu */
function commandMenu(page: Page): Locator {
  return page.getByRole("dialog", { name: "Command Menu" });
}

/** Opens the command menu and picks the command named `name` */
async function pickCommand(page: Page, query: string, name: string) {
  await page.keyboard.press("ControlOrMeta+k");
  await commandMenu(page).getByPlaceholder("Type a command...").fill(query);
  await commandMenu(page)
    .getByRole("option", { name: new RegExp(`^${name}`) })
    .click();
}

/** The time at the middle of the time grid's scroll area, in minutes */
async function middleMinutes(page: Page, rowHeight: number): Promise<number> {
  return page
    .getByRole("main")
    .locator(".overflow-auto")
    .first()
    .evaluate(
      (grid, height) =>
        ((grid.scrollTop + grid.clientHeight / 2) / height) * 60,
      rowHeight,
    );
}

test("Start week on... lists the other days and starts the week on the one picked", async ({
  page,
}) => {
  await expect(dayColumn(page, "Sunday, May 31")).toBeInViewport();

  await pickCommand(page, "start week", "Start week on");
  const menu = commandMenu(page);
  await expect(menu.getByPlaceholder("Start week on...")).toBeVisible();
  await expect(menu.getByRole("option")).toHaveText([
    "Mondays",
    "Tuesdays",
    "Wednesdays",
    "Thursdays",
    "Fridays",
    "Saturdays",
  ]);
  await menu.getByRole("option", { name: "Mondays" }).click();
  await expect(menu).toHaveCount(0);

  // The week holding today now runs Monday to Sunday
  await expectOnScreen(dayColumn(page, "Monday, June 1"), true);
  await expectOnScreen(dayColumn(page, "Sunday, June 7"), true);
  await expectOnScreen(dayColumn(page, "Sunday, May 31"), false);
  // The mini calendar's weeks start on Monday too
  await expect(page.locator(".rdp-weekday").first()).toHaveText("Mo");

  // Month view's rows end on Sunday
  await page.keyboard.press("m");
  const monday = await boxOf(monthCell(page, "2026-06-01"));
  const sunday = await boxOf(monthCell(page, "2026-06-07"));
  expect(sunday.x).toBeGreaterThan(monday.x);
  expect(Math.abs(sunday.y - monday.y)).toBeLessThan(1);

  // The list now offers Sunday back, and leaves Monday out
  await pickCommand(page, "start week", "Start week on");
  await expect(menu.getByRole("option", { name: "Mondays" })).toHaveCount(0);
  await expect(menu.getByRole("option", { name: "Sundays" })).toBeVisible();
});

test("Backspace in an empty search goes back to the commands", async ({
  page,
}) => {
  await pickCommand(page, "start week", "Start week on");
  const menu = commandMenu(page);
  await expect(menu.getByPlaceholder("Start week on...")).toBeFocused();
  await page.keyboard.press("Backspace");
  await expect(menu.getByPlaceholder("Type a command...")).toBeVisible();
  await expect(
    menu.getByRole("option", { name: /^Go to today/ }),
  ).toBeVisible();
});

test("Set number of displayed days... sets the week view's day count", async ({
  page,
}) => {
  await pickCommand(page, "number of", "Set number of displayed days");
  const menu = commandMenu(page);
  await expect(
    menu.getByPlaceholder("Set number of displayed days..."),
  ).toBeVisible();
  // The view switcher's choices, as bare numbers like Notion Calendar's
  await expect(menu.getByRole("option")).toHaveText([
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
  ]);
  await menu.getByRole("option", { name: "3", exact: true }).click();
  await expect(menu).toHaveCount(0);

  await expectOnScreen(dayColumn(page, "Sunday, May 31"), true);
  await expectOnScreen(dayColumn(page, "Tuesday, June 2"), true);
  await expectOnScreen(dayColumn(page, "Wednesday, June 3"), false);
});

test("zoom keys make the hours taller and shorter, and keep the middle hour in place", async ({
  page,
}) => {
  await expect.poll(() => hourHeight(page)).toBe(48);
  const middle = await middleMinutes(page, 48);

  await page.keyboard.press("ControlOrMeta+Shift+Period");
  await expect.poll(() => hourHeight(page)).toBe(64);
  expect(Math.abs((await middleMinutes(page, 64)) - middle)).toBeLessThan(2);

  await page.keyboard.press("ControlOrMeta+Shift+Period");
  await expect.poll(() => hourHeight(page)).toBe(80);
  expect(Math.abs((await middleMinutes(page, 80)) - middle)).toBeLessThan(2);

  await page.keyboard.press("ControlOrMeta+Shift+Comma");
  await page.keyboard.press("ControlOrMeta+Shift+Comma");
  await page.keyboard.press("ControlOrMeta+Shift+Comma");
  await expect.poll(() => hourHeight(page)).toBe(40);

  // Shift+Cmd+0 goes back to filling the screen
  await page.keyboard.press("ControlOrMeta+Shift+Digit0");
  await expect.poll(() => hourHeight(page)).toBe(48);
});

test("zooming stops at the smallest and largest hour heights", async ({
  page,
}) => {
  for (let step = 0; step < 12; step++) {
    await page.keyboard.press("ControlOrMeta+Shift+Period");
  }
  await expect.poll(() => hourHeight(page)).toBe(160);
  for (let step = 0; step < 12; step++) {
    await page.keyboard.press("ControlOrMeta+Shift+Comma");
  }
  await expect.poll(() => hourHeight(page)).toBe(24);
});

test("the hour size commands do what their keys do", async ({ page }) => {
  await pickCommand(page, "zoom", "Zoom hours in");
  await expect.poll(() => hourHeight(page)).toBe(64);
  await pickCommand(page, "zoom", "Zoom hours out");
  await pickCommand(page, "zoom", "Zoom hours out");
  await expect.poll(() => hourHeight(page)).toBe(40);
  await pickCommand(page, "hour size", "Default hour size");
  await expect.poll(() => hourHeight(page)).toBe(48);

  // Each lists Notion Calendar's keys
  await page.keyboard.press("ControlOrMeta+k");
  await commandMenu(page).getByPlaceholder("Type a command...").fill("hour");
  await expect(commandMenu(page).getByRole("option")).toHaveText([
    /^Default hour size\s*shift⌘0$/,
    /^Zoom hours in\s*shift⌘\.$/,
    /^Zoom hours out\s*shift⌘,$/,
  ]);
});

test("a drag after zooming in lands on the time under the pointer", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+Shift+Period");
  await expect.poll(() => hourHeight(page)).toBe(64);

  // Architecture Review: Thursday June 4, 10 to 11:30 AM. Centered first,
  // so the drag stays clear of the edges that scroll the grid. One hour down.
  await page
    .getByRole("main")
    .locator(".overflow-auto")
    .first()
    .evaluate((grid) => {
      grid.scrollTop = 10 * 64 - grid.clientHeight / 2;
    });
  const event = calendarEvent(page, "Architecture Review");
  await dragBy(page, event, { dx: 0, dy: 64, offsetY: 20 });
  await expect(event).toHaveAccessibleName(
    "Architecture Review, 11:00 AM to 12:30 PM, Thursday, June 4",
  );
});
