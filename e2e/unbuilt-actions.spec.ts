import { expect, test } from "@playwright/test";

import { openCalendar } from "./helpers";

/**
 * Controls that are drawn but not built yet. Each is disabled or replaced by
 * a "Soon" badge: the sidebar's scheduling row,
 * "Meet with..." field and "Add calendar account", and the listed shortcuts nothing handles. Shift+Cmd+D is left to the
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

test("the sidebar marks scheduling, meet with and add calendar account", async ({
  page,
}) => {
  for (const name of ["Scheduling", "Add calendar account"]) {
    await expect(
      page.getByRole("button", { name: `${name} Soon`, exact: true }),
    ).toBeDisabled();
  }

  const meetWith = page.getByPlaceholder("Meet with...");
  await expect(meetWith).toBeDisabled();
  await expect(
    meetWith.locator("xpath=..").getByText("Soon", { exact: true }),
  ).toBeVisible();

  // The row has a fixed height and clips, so compare the labels themselves:
  // a wrapped label is two lines tall
  const [schedulingLabelHeight, addAccountLabelHeight] = await Promise.all(
    ["Scheduling", "Add calendar account"].map((label) =>
      page
        .getByRole("button", { name: `${label} Soon`, exact: true })
        .getByText(label, { exact: true })
        .evaluate((span) => span.getBoundingClientRect().height),
    ),
  );
  expect(addAccountLabelHeight).toBe(schedulingLabelHeight);
});

test("the useful shortcuts mark the ones nothing handles", async ({ page }) => {
  const row = (label: string) =>
    page.getByText(label, { exact: true }).locator("xpath=..");

  for (const label of ["Menu bar calendar", "Show teammate calendar"]) {
    await expect(row(label).getByText("Soon", { exact: true })).toBeVisible();
  }
  await expect(row("Command menu").getByText("Soon")).toHaveCount(0);
  for (const label of ["Go to date", "All keyboard shortcuts"]) {
    await expect(row(label).getByText("Soon")).toHaveCount(0);
  }
  await expect(row("Toggle sidebar")).toContainText("⌘");
  await expect(row("Toggle sidebar")).toContainText("/");
});
