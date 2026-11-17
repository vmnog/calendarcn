import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { FROZEN_NOW } from "../helpers";

/**
 * `@calendarcn/calendar-app`'s account and app controls in a shadcn/ui
 * project set up with Base UI (e2e/base-ui/fixture). `/calendar-app` passes
 * none of their handlers, so none shows; `/settings` turns on the settings
 * dialog (`calendar-settings`, on Base UI's Dialog and Switch) and "Add
 * calendar account".
 */

/** .ics files the import is tested with */
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page, route: string): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto(route);
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
}

function settings(page: Page) {
  return page.getByRole("dialog", { name: "Settings" });
}

test("without handlers, the account and app controls aren't there", async ({
  page,
}) => {
  await open(page, "/calendar-app");
  await expect(
    page.getByRole("button", { name: "Add calendar account" }),
  ).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  const field = menu.getByPlaceholder("Type a command...");
  for (const text of [
    "go to settings",
    "support",
    "about",
    "calendar account",
  ]) {
    await field.fill(text);
    await expect(menu.getByRole("option")).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);

  // Cmd+, opens nothing, and is left to the browser
  const prevented = await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", {
      key: ",",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
  await expect(settings(page)).toHaveCount(0);
});

test("the settings dialog changes the calendar, and lists the accounts", async ({
  page,
}) => {
  await open(page, "/settings");
  await page.keyboard.press("ControlOrMeta+,");
  const dialog = settings(page);
  await expect(dialog).toBeVisible();

  const weekNumbers = dialog.getByRole("switch", { name: "Week numbers" });
  await expect(weekNumbers).toBeChecked();
  await weekNumbers.click();
  await expect(weekNumbers).not.toBeChecked();

  await dialog
    .getByRole("combobox", { name: "Time format" })
    .selectOption({ label: "24-hour time (13:00)" });
  await expect(
    page.locator("main").getByText("14:00", { exact: true }),
  ).toBeVisible();

  await dialog.getByRole("radio", { name: "Dark mode" }).check();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await dialog.getByRole("button", { name: "you@example.com" }).click();
  await expect(dialog.getByText("6 calendars")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Add calendar account adds an .ics file as a calendar", async ({
  page,
}) => {
  await open(page, "/settings");
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Add calendar account" }).click(),
  ]);
  await chooser.setFiles(path.join(FIXTURES_DIR, "google.ics"));
  await expect(
    page.getByRole("button", { name: "Hide google", exact: true }),
  ).toBeVisible();
});
