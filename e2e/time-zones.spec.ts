import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { boxOf, openCalendar } from "./helpers";

/**
 * Notion Calendar's time zone controls in the live demo: "Show additional
 * time zones...", "Travel to time zone..." (Z), the labels above the time
 * axis and their menus, and the "+" that adds a zone. The browser runs in
 * New York (GMT−4 in June) and the clock is frozen at Thursday June 4 2026,
 * 8:00 AM, when it is 9:00 PM in Tokyo (GMT+9, 13 hours ahead).
 */

/** The time grid, without the sidebars around it */
function grid(page: Page): Locator {
  return page.getByRole("main");
}

/** `text` as a regular expression that matches it literally */
function literal(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The label above a time zone column, by its short label ("EDT", "GMT+9") */
function zoneLabel(page: Page, label: string): Locator {
  return grid(page).getByRole("button", {
    name: new RegExp(`^${literal(label)} .* time zone$`),
  });
}

/** An event of the week by the start of its accessible name */
function event(page: Page, title: string): Locator {
  return grid(page).getByRole("button", { name: new RegExp(`^${title},`) });
}

/** The command menu's input */
function commandInput(page: Page): Locator {
  return page.getByRole("dialog").getByRole("combobox");
}

/** Opens the command menu and runs a time zone command by its label */
async function runZoneCommand(page: Page, label: string): Promise<void> {
  await page.keyboard.press("ControlOrMeta+k");
  await commandInput(page).fill(label.replace("...", ""));
  await page
    .getByRole("option", { name: new RegExp(`^${literal(label)}`) })
    .click();
  await expect(commandInput(page)).toHaveAttribute("placeholder", label);
}

/** Picks Tokyo in an open time zone list */
async function pickTokyo(page: Page): Promise<void> {
  await page.keyboard.type("Tokyo");
  await page
    .getByRole("option", { name: "(GMT+09:00) Japan Standard Time – Tokyo" })
    .click();
}

/**
 * An hour label of the time axis in the left-most or right-most column it
 * appears in: with a whole-hour offset, each column has every hour
 */
async function hourLabelBox(
  page: Page,
  text: string,
  column: "left" | "right",
): Promise<{ x: number; y: number; width: number; height: number }> {
  const boxes = await Promise.all(
    (await grid(page).getByText(text, { exact: true }).all()).map(boxOf),
  );
  boxes.sort((a, b) => a.x - b.x);
  return column === "left" ? boxes[0] : boxes[boxes.length - 1];
}

/** Vertical center of a box */
function centerY(box: { y: number; height: number }): number {
  return box.y + box.height / 2;
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
  await expect(event(page, "Lunch with Sarah")).toHaveAccessibleName(
    "Lunch with Sarah, 12:30 PM to 1:30 PM, Thursday, June 4",
  );
});

test("the time zone commands are built, and list a zone to pick", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");
  await commandInput(page).fill("time zone");
  const group = page.getByRole("group", { name: "Time zones" });
  await expect(group.getByRole("option")).toHaveText([
    /^Travel to time zone\.\.\.Z$/,
    "Show additional time zones...",
  ]);
  await expect(group.getByText("Soon")).toHaveCount(0);

  // The list replaces the commands: the popular zones first, searchable by
  // city or offset
  await page.getByRole("option", { name: /^Travel to time zone/ }).click();
  await expect(commandInput(page)).toHaveAttribute(
    "placeholder",
    "Travel to time zone...",
  );
  await expect(page.getByRole("option").first()).toHaveText(
    "(GMT−07:00) Pacific Daylight Time – Los Angeles",
  );
  await page.keyboard.type("+9");
  await expect(
    page.getByRole("option", {
      name: "(GMT+09:00) Japan Standard Time – Tokyo",
    }),
  ).toBeVisible();

  // Backspace in an empty search goes back to the commands
  await commandInput(page).fill("");
  await page.keyboard.press("Backspace");
  await expect(commandInput(page)).toHaveAttribute(
    "placeholder",
    "Type a command...",
  );
});

test("an additional zone gets its column, and its label menu removes it", async ({
  page,
}) => {
  await runZoneCommand(page, "Show additional time zones...");
  await pickTokyo(page);

  // Tokyo's column sits left of New York's, 13 hours ahead on each row
  const tokyo = await boxOf(zoneLabel(page, "GMT+9"));
  const newYork = await boxOf(zoneLabel(page, "EDT"));
  expect(tokyo.x).toBeLessThan(newYork.x);
  const tenAm = await hourLabelBox(page, "10 AM", "right");
  const elevenPm = await hourLabelBox(page, "11 PM", "left");
  expect(elevenPm.x).toBeLessThan(tenAm.x);
  expect(Math.abs(centerY(tenAm) - centerY(elevenPm))).toBeLessThan(1);
  // The events stay on New York's clock
  await expect(event(page, "Lunch with Sarah")).toHaveAccessibleName(
    "Lunch with Sarah, 12:30 PM to 1:30 PM, Thursday, June 4",
  );

  // With two zones, the menu can make one primary or hide one
  await page.keyboard.press("ControlOrMeta+k");
  await commandInput(page).fill("time zone");
  await expect(
    page.getByRole("option", { name: "Make time zone primary..." }),
  ).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Hide time zone..." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await zoneLabel(page, "GMT+9").click();
  await expect(
    page.getByRole("option", { name: /^Change time zone/ }),
  ).toHaveText("Change time zoneTokyo");
  await page
    .getByRole("option", { name: "Remove time zone from list" })
    .click();
  await expect(zoneLabel(page, "GMT+9")).toHaveCount(0);
  await expect(zoneLabel(page, "EDT")).toBeVisible();
});

test("travelling draws the calendar on the zone's clock, until you travel back", async ({
  page,
}) => {
  // Z opens the command menu on "Travel to time zone..."
  await page.keyboard.press("z");
  await expect(commandInput(page)).toHaveAttribute(
    "placeholder",
    "Travel to time zone...",
  );
  await pickTokyo(page);

  // Tokyo is the calendar's zone now, with home beside it
  const tokyo = zoneLabel(page, "GMT+9");
  await expect(tokyo).toBeVisible();
  const home = await boxOf(zoneLabel(page, "EDT"));
  expect(home.x).toBeLessThan((await boxOf(tokyo)).x);
  // Events and the now line follow Tokyo's clock: lunch at 12:30 PM in New
  // York is 1:30 AM on Friday in Tokyo, and it is 9:00 PM there
  await expect(event(page, "Lunch with Sarah")).toHaveAccessibleName(
    "Lunch with Sarah, 1:30 AM to 2:30 AM, Friday, June 5",
  );
  await expect(grid(page).getByText("9:00PM", { exact: true })).toBeVisible();
  await expect(grid(page).getByText("8:00AM", { exact: true })).toHaveCount(0);

  // Escape with nothing selected travels back home
  await page.keyboard.press("Escape");
  await expect(zoneLabel(page, "GMT+9")).toHaveCount(0);
  await expect(event(page, "Lunch with Sarah")).toHaveAccessibleName(
    "Lunch with Sarah, 12:30 PM to 1:30 PM, Thursday, June 4",
  );
  await expect(grid(page).getByText("8:00AM", { exact: true })).toBeVisible();

  // The x on the travel label travels back home too
  await runZoneCommand(page, "Travel to time zone...");
  await pickTokyo(page);
  await expect(zoneLabel(page, "GMT+9")).toBeVisible();
  await grid(page).getByRole("button", { name: "Travel back home" }).click();
  await expect(zoneLabel(page, "GMT+9")).toHaveCount(0);
});

test("a zone travelled to can be kept as the primary one", async ({ page }) => {
  await runZoneCommand(page, "Travel to time zone...");
  await pickTokyo(page);

  await zoneLabel(page, "GMT+9").click();
  await expect(page.getByRole("option")).toHaveText([
    "Add as primary time zone",
    "Add as secondary time zone",
    "Travel back homeesc",
  ]);
  await page.getByRole("option", { name: "Add as primary time zone" }).click();

  // Not travelling any more: no x, and Escape keeps Tokyo
  await expect(
    grid(page).getByRole("button", { name: "Travel back home" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(event(page, "Lunch with Sarah")).toHaveAccessibleName(
    "Lunch with Sarah, 1:30 AM to 2:30 AM, Friday, June 5",
  );

  // Home stays beside it as an additional zone; making Tokyo secondary
  // swaps them back
  await zoneLabel(page, "GMT+9").click();
  await page.getByRole("option", { name: "Make time zone secondary" }).click();
  await expect(event(page, "Lunch with Sarah")).toHaveAccessibleName(
    "Lunch with Sarah, 12:30 PM to 1:30 PM, Thursday, June 4",
  );
  const tokyo = await boxOf(zoneLabel(page, "GMT+9"));
  const newYork = await boxOf(zoneLabel(page, "EDT"));
  expect(tokyo.x).toBeLessThan(newYork.x);
});

test("the + adds a zone from a list searched by offset", async ({ page }) => {
  await grid(page).getByRole("button", { name: "Add time zone" }).click();
  await page.getByRole("textbox", { name: "Time zone" }).fill("+5:30");
  await page.getByRole("option").first().click();

  await expect(zoneLabel(page, "GMT+5:30")).toBeVisible();
});

test("travelling works in day view too", async ({ page }) => {
  await page.keyboard.press("d");
  await page.keyboard.press("z");
  await pickTokyo(page);

  await expect(zoneLabel(page, "GMT+9")).toBeVisible();
  await expect(grid(page).getByText("9:00PM", { exact: true })).toBeVisible();
  // Still Thursday in Tokyo: Wednesday's 3 PM meeting in New York is
  // Thursday morning there
  await expect(event(page, "1:1 with Manager")).toHaveAccessibleName(
    "1:1 with Manager, 4:00 AM to 4:30 AM, Thursday, June 4",
  );
});

test("while travelling, the details read on the zone's clock and switch to the event's", async ({
  page,
}) => {
  await runZoneCommand(page, "Travel to time zone...");
  await pickTokyo(page);
  await event(page, "Lunch with Sarah").click();

  const timezone = page.locator('[data-section="timezone"]');
  const startTime = page.getByTestId("event-start-time");
  await expect(startTime).toHaveValue("1:30 AM");
  await expect(timezone).toContainText("GMT+9Tokyo");

  // The event is set in New York: switch to its clock to edit its zone
  await timezone
    .getByRole("button", { name: "Switch to event's time zone to edit" })
    .click();
  await expect(startTime).toHaveValue("12:30 PM");
  await expect(timezone).toContainText("GMT−4New York");

  await timezone
    .getByRole("button", { name: "Switch to your primary time zone" })
    .click();
  await expect(startTime).toHaveValue("1:30 AM");
});
