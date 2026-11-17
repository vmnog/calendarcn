import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, dragBy, hourHeight } from "../helpers";

/**
 * The series question in a Base UI project (/series-scope: a daily
 * "Standup" from Monday, June 1, 9 to 9:30 AM, with the ids each callback
 * reports listed above the calendar)
 */

/** Thursday's date, at the series' time or an hour later */
function thursday(page: Page, time = "9:00 AM to 9:30 AM"): Locator {
  return page.getByRole("main").getByRole("button", {
    name: new RegExp(`^Standup, ${time}, Thursday, June 4`),
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/series-scope");
  await expect(thursday(page)).toBeVisible();
});

test("This and following events splits the series and reports each change", async ({
  page,
}) => {
  await dragBy(page, thursday(page), { dx: 0, dy: await hourHeight(page) });
  const dialog = page.getByRole("dialog", { name: /^Edit repeat event/ });
  await dialog
    .getByRole("radio", { name: "This and following events" })
    .click();
  await dialog.getByRole("button", { name: "Save event" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(thursday(page, "10:00 AM to 10:30 AM")).toBeVisible();
  await expect(page.getByLabel("Updated events")).toHaveText("standup");
  // The new series' id is random: one id, not the old one
  await expect(page.getByLabel("Created events")).toHaveText(/^[\w-]+$/);
  await expect(page.getByLabel("Created events")).not.toHaveText("standup");
  await expect(page.getByLabel("Deleted events")).toHaveText("");
});

test("Discard change changes and reports nothing", async ({ page }) => {
  await dragBy(page, thursday(page), { dx: 0, dy: await hourHeight(page) });
  const dialog = page.getByRole("dialog", { name: /^Edit repeat event/ });
  await dialog.getByRole("button", { name: "Discard change" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(thursday(page)).toBeVisible();
  await expect(page.getByLabel("Updated events")).toHaveText("");
  await expect(page.getByLabel("Created events")).toHaveText("");
});
