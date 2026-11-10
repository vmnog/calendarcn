import { expect, test } from "@playwright/test";

import { calendarEvent, openCalendar } from "./helpers";

/**
 * Actions and settings that are drawn but not built yet: cut, copy, duplicate
 * and delete in both event menus, and the "Declined events" setting. Each is
 * disabled and says "Soon", and Shift+Cmd+D is left to the browser.
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

test("the declined events setting is marked as not built", async ({ page }) => {
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("menuitem", { name: "View settings" }).click();

  await expect(
    page.getByRole("menuitemcheckbox", {
      name: "Declined events Soon",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("menuitemcheckbox", { name: /^Weekends/ }),
  ).toBeEnabled();
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
