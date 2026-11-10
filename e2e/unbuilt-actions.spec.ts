import { expect, test } from "@playwright/test";

import { calendarEvent, openCalendar } from "./helpers";

/**
 * Controls that are drawn but not built yet. Each is disabled or replaced by
 * a "Soon" badge: cut, copy, duplicate and delete in both event menus, the
 * view settings the current view doesn't read, the sidebar's scheduling row,
 * "Meet with..." field and "Add calendar account", hiding a calendar in the
 * app, and the listed shortcuts nothing handles. Shift+Cmd+D is left to the
 * browser.
 */

/** Event actions with no handler yet */
const UNBUILT_ACTIONS = ["Cut", "Copy", "Duplicate", "Delete"] as const;

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("the event's right-click menu marks its unbuilt actions", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click({ button: "right" });

  for (const action of UNBUILT_ACTIONS) {
    await expect(
      page.getByRole("button", { name: `${action} Soon`, exact: true }),
    ).toBeDisabled();
  }
});

test("the details panel's menu marks its unbuilt actions", async ({ page }) => {
  await calendarEvent(page, "Quick Sync").click();
  await page.getByRole("button", { name: "More actions" }).click();

  const menu = page.getByRole("menu");
  for (const action of UNBUILT_ACTIONS) {
    await expect(
      menu.getByRole("menuitem", { name: `${action} Soon`, exact: true }),
    ).toBeDisabled();
  }
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

test("the app marks hiding a calendar as not built", async ({ page }) => {
  const family = page
    .getByRole("listitem")
    .filter({ has: page.getByText("Family", { exact: true }) });
  await family.hover();

  await expect(family.getByText("Soon", { exact: true })).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(family.locator('[aria-label="Hide Family"]')).toHaveCount(0);
});

test("the useful shortcuts mark the ones nothing handles", async ({ page }) => {
  const row = (label: string) =>
    page.getByText(label, { exact: true }).locator("xpath=..");

  for (const label of [
    "Menu bar calendar",
    "Show teammate calendar",
    "Go to date",
    "All keyboard shortcuts",
  ]) {
    await expect(row(label).getByText("Soon", { exact: true })).toBeVisible();
  }
  await expect(row("Command menu").getByText("Soon")).toHaveCount(0);
  await expect(row("Toggle sidebar")).toContainText("⌘");
  await expect(row("Toggle sidebar")).toContainText("/");
});
