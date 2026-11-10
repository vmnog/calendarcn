import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { FROZEN_NOW, calendarEvent } from "../helpers";

/**
 * `calendar-sidebar` and `details-sidebar` installed in a shadcn/ui project
 * set up with Base UI (e2e/base-ui/fixture). `/sidebars` renders both around
 * a week view, inside a `SidebarProvider`, with "Design Review" on Thursday,
 * June 4 2026 (calendar "Work") and "Lunch" on Friday, June 5.
 */

/** Opens `/sidebars` on the frozen test date */
async function openSidebars(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/sidebars");
  await expect(calendarEvent(page, "Design Review")).toBeVisible();
}

test.describe("wide screens", () => {
  test.beforeEach(async ({ page }) => {
    await openSidebars(page);
  });

  test("the mini calendar shows the visible week and picks another", async ({
    page,
  }) => {
    // The week of May 31 - June 6 is highlighted, today is selected
    const today = page.locator('button[data-day][data-today="true"]');
    await expect(today).toHaveText("4");
    await expect(today).toHaveAttribute("data-in-view", "true");

    await page.getByRole("button", { name: "Go to next month" }).click();
    // The month's name shows in the nav once away from today's month
    const nav = page.locator('[data-slot="mini-calendar"] nav');
    await expect(nav).toHaveText("July 2026");
    await page
      .locator('button[data-day][data-outside="false"]', { hasText: /^15$/ })
      .click();

    // Picking a day goes to its week, July 12 - 18
    const inView = page.locator('button[data-day][data-in-view="true"]');
    await expect(inView).toHaveCount(7);
    await expect(inView.first()).toHaveText("12");
    await expect(inView.last()).toHaveText("18");
    await expect(calendarEvent(page, "Design Review")).toHaveCount(0);
  });

  test("calendars are listed by account and hide from their eye button", async ({
    page,
  }) => {
    // The eye toggle sits inside the row's button, so find it by its label
    const holidays = page.getByRole("listitem").filter({ hasText: "Holidays" });
    await holidays.hover();
    await holidays.locator('[aria-label="Hide Holidays"]').click();
    await expect(
      holidays.locator('[aria-label="Show Holidays"]'),
    ).toBeVisible();

    // Base UI's Collapsible folds an account away
    const workAccount = page.getByRole("button", {
      name: "you@work.example.com",
      exact: true,
    });
    await workAccount.click();
    await expect(page.getByText("Work", { exact: true })).toBeHidden();
    await workAccount.click();
    await expect(page.getByText("Work", { exact: true })).toBeVisible();
  });

  test("the theme toggle cycles light, dark and system", async ({ page }) => {
    const toggle = page.getByRole("button", { name: "Toggle theme" });
    const html = page.locator("html");

    await toggle.click();
    await expect(html).toHaveClass(/\blight\b/);
    await toggle.click();
    await expect(html).toHaveClass(/\bdark\b/);
    await toggle.click();
    await expect(html).not.toHaveClass(/\bdark\b/);
  });

  test("the context panel shows the selected event and searches events", async ({
    page,
  }) => {
    await expect(page.getByText("Useful shortcuts")).toBeVisible();

    await calendarEvent(page, "Design Review").click();
    await expect(page.getByPlaceholder("Title")).toHaveValue("Design Review");
    await expect(
      page.getByRole("dialog", { name: "Event details" }),
    ).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.getByText("Useful shortcuts")).toBeVisible();
    await page.getByPlaceholder("Search events").fill("lunch");
    await page
      .locator('[data-slot="sidebar-container"]')
      .getByText("Lunch", { exact: true })
      .click();
    await expect(page.getByPlaceholder("Title")).toHaveValue("Lunch");

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByPlaceholder("Search events")).toHaveValue("lunch");
  });

  test("the context panel closes and opens again", async ({ page }) => {
    // Closed, the panel sits past the right edge
    await page.getByRole("button", { name: "Toggle context panel" }).click();
    await expect(page.getByText("Useful shortcuts")).not.toBeInViewport();
    await page.getByRole("button", { name: "Toggle context panel" }).click();
    await expect(page.getByText("Useful shortcuts")).toBeInViewport();
  });
});

test.describe("phones", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await openSidebars(page);
  });

  test("the calendar sidebar opens as a sheet and closes on Escape", async ({
    page,
  }) => {
    const sheet = page.getByRole("dialog", { name: "Calendar sidebar" });
    await expect(sheet).toHaveCount(0);

    await page.getByRole("button", { name: "Open calendar sidebar" }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("you@work.example.com")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });

  test("the context panel sheet opens without focusing its search field", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Toggle context panel" }).click();
    const sheet = page.getByRole("dialog", { name: "Context panel" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByText("Useful shortcuts", { exact: true }),
    ).toBeVisible();
    await expect(sheet.getByPlaceholder("Search events")).not.toBeFocused();
    await expect
      .poll(() =>
        sheet.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
  });
});
