import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  expectHeader,
  openCalendar,
} from "./helpers";

/**
 * The live demo's account and app controls: the settings dialog (Cmd+,, Go
 * to settings, Manage calendar accounts), Add calendar account (an .ics file
 * as a calendar), Support & feedback and About CalendarCN. They come from
 * CalendarApp's `settingsDialog`, `onAddCalendarAccount`, `onSupport` and
 * `onAbout`, which the demo passes. Base UI's calendar-app fixture, which
 * passes none, checks that they're absent without them.
 */

/** .ics files the import is tested with */
const FIXTURES_DIR = path.join(__dirname, "fixtures");

/** Where Support & feedback goes */
const SUPPORT_URL = "https://github.com/vmnog/calendarcn/issues/new";

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

function commandMenu(page: Page) {
  return page.getByRole("dialog", { name: "Command Menu" });
}

function settings(page: Page) {
  return page.getByRole("dialog", { name: "Settings" });
}

/** Closes the settings and waits until they're gone (reopening mid-close closes them again) */
async function closeSettings(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await expect(settings(page)).toHaveCount(0);
}

/** The calendar, while a dialog hides it from the accessibility tree */
function calendarArea(page: Page) {
  return page.locator("main");
}

/** Width of a day's column in the time grid */
async function dayColumnWidth(page: Page, name: string): Promise<number> {
  const box = await calendarArea(page)
    .locator(`[role="group"][aria-label="${name}"]`)
    .first()
    .boundingBox();
  return box?.width ?? 0;
}

/** Grid columns of the month view's row that holds June 4 (a week number column first, when shown) */
function juneFourthRowColumns(page: Page): Promise<string> {
  return page
    .locator('[data-date="2026-06-04"]')
    .locator("xpath=..")
    .evaluate((row) => getComputedStyle(row).gridTemplateColumns);
}

/** Runs a command from the command menu, found by typing `text` */
async function runCommand(page: Page, text: string): Promise<void> {
  await page.keyboard.press("ControlOrMeta+k");
  await commandMenu(page).getByPlaceholder("Type a command...").fill(text);
  await page.keyboard.press("Enter");
}

/** Adds an .ics fixture through a control that opens the file picker */
async function addCalendarFrom(
  page: Page,
  openPicker: () => Promise<void>,
  fileName: string,
): Promise<void> {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    openPicker(),
  ]);
  await chooser.setFiles(path.join(FIXTURES_DIR, fileName));
}

test("Cmd+, opens the settings on General, and its settings change the calendar", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+,");
  const dialog = settings(page);
  await expect(dialog).toBeVisible();
  for (const section of ["Calendar view", "Time format", "Theme"]) {
    await expect(dialog.getByRole("region", { name: section })).toBeVisible();
  }

  // Time format: the time axis follows
  const main = calendarArea(page);
  await expect(main.getByText("2 PM", { exact: true })).toBeVisible();
  await dialog
    .getByRole("combobox", { name: "Time format" })
    .selectOption({ label: "24-hour time (13:00)" });
  await expect(main.getByText("14:00", { exact: true })).toBeVisible();

  // Theme: Notion's labels
  await dialog.getByRole("radio", { name: "Dark mode" }).check();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  // Number of days in week view: three wide columns instead of seven
  expect(await dayColumnWidth(page, "Monday, June 1")).toBeLessThan(200);
  await dialog
    .getByRole("combobox", { name: "Number of days in week view:" })
    .selectOption("3");
  await closeSettings(page);
  expect(await dayColumnWidth(page, "Monday, June 1")).toBeGreaterThan(200);
});

test("the view settings switch, and declined events wait for the views", async ({
  page,
}) => {
  await page.keyboard.press("m");
  // The demo shows week numbers: a narrow first column in month view
  expect(await juneFourthRowColumns(page)).toMatch(/^32px /);

  await runCommand(page, "go to settings");
  const dialog = settings(page);
  const weekNumbers = dialog.getByRole("switch", { name: "Week numbers" });
  await expect(weekNumbers).toBeChecked();
  await weekNumbers.click();
  await expect(weekNumbers).not.toBeChecked();
  await expect.poll(() => juneFourthRowColumns(page)).not.toMatch(/^32px /);

  await expect(
    dialog.getByRole("switch", { name: "Declined events" }),
  ).toBeDisabled();
  await expect(dialog.getByText("Soon")).toBeVisible();
});

test("Manage calendar accounts opens the first account, whose calendars hide and show", async ({
  page,
}) => {
  await runCommand(page, "manage calendar accounts");
  const dialog = settings(page);
  await expect(
    dialog.getByRole("heading", { name: "you@example.com" }),
  ).toBeVisible();
  await expect(dialog.getByText("6 calendars")).toBeVisible();

  await dialog.getByRole("button", { name: "Hide Personal" }).click();
  await expect(
    dialog.getByRole("button", { name: "Show Personal" }),
  ).toBeVisible();

  // The sidebar's list hides it too
  await closeSettings(page);
  await expect(
    page.getByRole("button", { name: "Show Personal", exact: true }),
  ).toBeVisible();

  // Another account, from the nav
  await page.keyboard.press("ControlOrMeta+,");
  await dialog.getByRole("button", { name: "you@work.example.com" }).click();
  await expect(
    dialog.getByRole("heading", { name: "you@work.example.com" }),
  ).toBeVisible();
});

test("Add calendar account in the sidebar adds an .ics file as a calendar", async ({
  page,
}) => {
  await addCalendarFrom(
    page,
    () => page.getByRole("button", { name: "Add calendar account" }).click(),
    "google.ics",
  );

  // A calendar named after the file, with the file's events
  await expect(
    page.getByRole("button", { name: "Hide google", exact: true }),
  ).toBeVisible();
  await expect(calendarEvent(page, "Product review")).toBeVisible();
  await expectHeader(page, CURRENT_WEEK_LABEL);

  // The same file again updates it rather than adding a second one
  await addCalendarFrom(
    page,
    () => page.getByRole("button", { name: "Add calendar account" }).click(),
    "google.ics",
  );
  await expect(calendarEvent(page, "Product review")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Hide google", exact: true }),
  ).toHaveCount(1);

  // The settings list it under its own account
  await page.keyboard.press("ControlOrMeta+,");
  await settings(page).getByRole("button", { name: "Calendars" }).click();
  await expect(settings(page).getByText("google")).toBeVisible();
});

test("Add calendar account in the command menu and the settings opens the picker too", async ({
  page,
}) => {
  await addCalendarFrom(
    page,
    () => runCommand(page, "add calendar account"),
    "outlook.ics",
  );
  await expect(
    page.getByRole("button", { name: "Hide outlook", exact: true }),
  ).toBeVisible();

  await page.keyboard.press("ControlOrMeta+,");
  await addCalendarFrom(
    page,
    () =>
      settings(page)
        .getByRole("button", { name: "Add calendar account" })
        .click(),
    "apple.ics",
  );
  await expect(
    settings(page).getByRole("button", { name: "Calendars" }),
  ).toBeVisible();
});

test("Support & feedback opens a new GitHub issue in a new tab", async ({
  page,
  context,
}) => {
  await context.route("https://github.com/**", (route) =>
    route.fulfill({ body: "GitHub" }),
  );
  const [popup] = await Promise.all([
    context.waitForEvent("page"),
    runCommand(page, "support"),
  ]);
  await popup.waitForURL(SUPPORT_URL);
  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("About CalendarCN opens the docs", async ({ page }) => {
  await runCommand(page, "about");
  await page.waitForURL("**/docs");
});

test("the removed controls appear nowhere", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+k");
  const field = commandMenu(page).getByPlaceholder("Type a command...");
  for (const text of [
    "mobile app",
    "check for update",
    "log out",
    "google calendar account",
    "menu bar",
  ]) {
    await field.fill(text);
    // Only the event search for the typed text is left
    await expect(
      commandMenu(page)
        .getByRole("option")
        .filter({ hasNotText: "Search events for" }),
    ).toHaveCount(0);
  }

  // The account commands under their neutral names, without "Soon"
  await field.fill("account");
  await expect(
    commandMenu(page).getByRole("option", { name: "Add calendar account" }),
  ).toBeVisible();
  await expect(
    commandMenu(page).getByRole("option", { name: "Manage calendar accounts" }),
  ).toBeVisible();
  await expect(commandMenu(page).getByText("Soon")).toHaveCount(0);
});
