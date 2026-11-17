import { expect, test } from "@playwright/test";

import { openCalendar } from "./helpers";

/**
 * Controls that are drawn but not built yet. Each is disabled or replaced by
 * a "Soon" badge: the sidebar's scheduling row, and the listed shortcuts
 * nothing handles. Shift+Cmd+D is left to the
 * browser.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("no view setting is marked Soon, in any view", async ({ page }) => {
  for (const [key, label] of [
    ["d", "Day"],
    ["w", "Week"],
    ["m", "Month"],
    ["y", "Year"],
    ["a", "Agenda"],
  ]) {
    await page.keyboard.press(key);
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.getByRole("menuitem", { name: "View settings" }).click();

    for (const setting of ["Weekends", "Declined events", "Week numbers"]) {
      const item = page.getByRole("menuitemcheckbox", {
        name: new RegExp(`^${setting}`),
      });
      await expect(item, `${setting} in ${label} view`).toBeEnabled();
      await expect(item).not.toContainText("Soon");
    }
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  }
});

test("Shift+Cmd+D is left to the browser, Shift+Cmd+E still toggles weekends", async ({
  page,
}) => {
  // Dispatched by hand: a real Shift+Cmd+D would open the browser's own dialog
  const prevented = await page.evaluate(() =>
    ["D", "E"].map((key) => {
      const event = new KeyboardEvent("keydown", {
        key,
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );

  expect(prevented).toEqual([false, true]);
});

test("the sidebar marks scheduling, not add calendar account or meet with", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Scheduling Soon", exact: true }),
  ).toBeDisabled();
  // Add calendar account works in the demo: no badge
  await expect(
    page.getByRole("button", { name: "Add calendar account", exact: true }),
  ).toBeEnabled();

  const meetWith = page.getByPlaceholder("Meet with...");
  await expect(meetWith).toBeEnabled();
  await expect(
    meetWith.locator("xpath=..").getByText("Soon", { exact: true }),
  ).toHaveCount(0);

  // The row has a fixed height and clips, so compare the labels themselves:
  // a wrapped label is two lines tall
  const [schedulingLabelHeight, addAccountLabelHeight] = await Promise.all(
    ["Scheduling Soon", "Add calendar account"].map((name) =>
      page
        .getByRole("button", { name, exact: true })
        .getByText(name.replace(" Soon", ""), { exact: true })
        .evaluate((span) => span.getBoundingClientRect().height),
    ),
  );
  expect(addAccountLabelHeight).toBe(schedulingLabelHeight);
});

test("the useful shortcuts mark the ones nothing handles", async ({ page }) => {
  const row = (label: string) =>
    page.getByText(label, { exact: true }).locator("xpath=..");

  // The menu bar calendar is gone: a browser has no menu bar
  await expect(page.getByText("Menu bar calendar")).toHaveCount(0);
  await expect(row("Command menu").getByText("Soon")).toHaveCount(0);
  for (const label of [
    "Show teammate calendar",
    "Go to date",
    "All keyboard shortcuts",
  ]) {
    await expect(row(label).getByText("Soon")).toHaveCount(0);
  }
  await expect(row("Show teammate calendar")).toContainText("P");
  await expect(row("Toggle sidebar")).toContainText("⌘");
  await expect(row("Toggle sidebar")).toContainText("/");
});

test("the week start, day count and hour size commands aren't marked Soon", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  for (const name of [
    "Start week on...",
    "Set number of displayed days...",
    "Default hour size",
    "Zoom hours in",
    "Zoom hours out",
  ]) {
    await menu.getByPlaceholder("Type a command...").fill(name);
    const option = menu.getByRole("option", {
      name: new RegExp(`^${name.replace(/\./g, "\\.")}`),
    });
    await expect(option, name).toBeVisible();
    await expect(option).not.toContainText("Soon");
    await expect(option).not.toHaveAttribute("aria-disabled", "true");
  }
});
