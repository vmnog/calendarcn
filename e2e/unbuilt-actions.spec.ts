import { expect, test } from "@playwright/test";

import { openCalendar } from "./helpers";

/**
 * Controls that are drawn but not built yet. Each is disabled or replaced by
 * a "Soon" badge: the
 * view settings the current view doesn't read, the sidebar's scheduling row
 * and "Meet with..." field, and the listed shortcuts nothing handles. Shift+Cmd+D is left to the
 * browser.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("week view marks every view setting as not built", async ({ page }) => {
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("menuitem", { name: "View settings" }).click();

  for (const setting of ["Weekends", "Declined events", "Week numbers"]) {
    const item = page.getByRole("menuitemcheckbox", {
      name: `${setting} Soon`,
      exact: true,
    });
    await expect(item).toBeDisabled();
    await expect(item).toHaveCSS("opacity", "1");
  }
});

test("month view keeps the two settings it reads", async ({ page }) => {
  await page.keyboard.press("m");
  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("menuitem", { name: "View settings" }).click();

  await expect(
    page.getByRole("menuitemcheckbox", { name: /^Weekends(?!.*Soon)/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Week numbers", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("menuitemcheckbox", {
      name: "Declined events Soon",
      exact: true,
    }),
  ).toBeDisabled();
});

test("agenda view keeps weekends and marks week numbers", async ({ page }) => {
  await page.keyboard.press("a");
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await page.getByRole("menuitem", { name: "View settings" }).click();

  await expect(
    page.getByRole("menuitemcheckbox", { name: /^Weekends(?!.*Soon)/ }),
  ).toBeEnabled();
  await expect(
    page.getByRole("menuitemcheckbox", {
      name: "Week numbers Soon",
      exact: true,
    }),
  ).toBeDisabled();
});

test("year view keeps week numbers and marks weekends", async ({ page }) => {
  await page.keyboard.press("y");
  await page.getByRole("button", { name: "Year", exact: true }).click();
  await page.getByRole("menuitem", { name: "View settings" }).click();

  await expect(
    page.getByRole("menuitemcheckbox", { name: "Week numbers", exact: true }),
  ).toBeEnabled();
  for (const setting of ["Weekends", "Declined events"]) {
    await expect(
      page.getByRole("menuitemcheckbox", {
        name: `${setting} Soon`,
        exact: true,
      }),
    ).toBeDisabled();
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

test("the sidebar marks scheduling and meet with", async ({ page }) => {
  await expect(
    page.getByRole("button", { name: "Scheduling Soon", exact: true }),
  ).toBeDisabled();
  // Add calendar account works in the demo: no badge
  await expect(
    page.getByRole("button", { name: "Add calendar account", exact: true }),
  ).toBeEnabled();

  const meetWith = page.getByPlaceholder("Meet with...");
  await expect(meetWith).toBeDisabled();
  await expect(
    meetWith.locator("xpath=..").getByText("Soon", { exact: true }),
  ).toBeVisible();

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
  for (const label of ["Show teammate calendar"]) {
    await expect(row(label).getByText("Soon", { exact: true })).toBeVisible();
  }
  await expect(row("Command menu").getByText("Soon")).toHaveCount(0);
  for (const label of ["Go to date", "All keyboard shortcuts"]) {
    await expect(row(label).getByText("Soon")).toHaveCount(0);
  }
  await expect(row("Toggle sidebar")).toContainText("⌘");
  await expect(row("Toggle sidebar")).toContainText("/");
});
