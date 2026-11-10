import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { calendarEvent, openCalendar } from "./helpers";

/**
 * The demo's two sidebars: the calendar sidebar on the left (mini calendar,
 * calendar list, theme toggle) and the context panel on the right (details,
 * search, shortcuts). Wide screens show both inline; phones open them as
 * sheets.
 */

/** The days the mini calendar highlights as on screen */
function miniCalendarInView(page: Page): Locator {
  return page.locator('button[data-day][data-in-view="true"]');
}

/** The context panel's inline column */
function contextPanel(page: Page): Locator {
  return page.locator('[data-slot="sidebar-container"]');
}

test.describe("wide screens", () => {
  test.beforeEach(async ({ page }) => {
    await openCalendar(page);
  });

  test("browsing the mini calendar shows the month and a way back to today", async ({
    page,
  }) => {
    await expect(miniCalendarInView(page).first()).toHaveText("31");
    // The month's name shows in the nav once away from today's month
    const nav = page.locator('[data-slot="mini-calendar"] nav');
    await page.getByRole("button", { name: "Go to next month" }).click();
    await expect(nav).toHaveText("July 2026");

    await page.getByRole("button", { name: "Go back to today" }).click();
    await expect(nav).toHaveText("");
    await expect(
      page.getByRole("button", { name: "Go back to today" }),
    ).toHaveCount(0);
    await expect(miniCalendarInView(page)).toHaveCount(7);
  });

  test("an account's calendars fold away and back", async ({ page }) => {
    const workAccount = page.getByRole("button", {
      name: "you@work.example.com",
      exact: true,
    });
    const work = page
      .getByRole("listitem")
      .filter({ has: page.getByText("Work", { exact: true }) });

    await workAccount.click();
    await expect(work).toHaveCount(0);
    await workAccount.click();
    await expect(work).toBeVisible();
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

  test("event search lists matches and opens one", async ({ page }) => {
    await page.getByPlaceholder("Search events").fill("gym");
    const result = contextPanel(page).getByText("Gym", { exact: true });
    await expect(result.first()).toBeVisible();

    await result.first().click();
    await expect(page.getByPlaceholder("Title")).toHaveValue("Gym");

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByPlaceholder("Search events")).toHaveValue("gym");
  });

  test("the sidebars close and open from the header and the keyboard", async ({
    page,
  }) => {
    const shortcuts = page.getByText("Useful shortcuts");
    const miniCalendar = page.locator('[data-slot="mini-calendar"]');

    await page.keyboard.press("/");
    await expect(shortcuts).not.toBeInViewport();
    await page
      .getByRole("button", { name: "Toggle Navigation Sidebar" })
      .click();
    await expect(shortcuts).toBeInViewport();

    await page.getByRole("button", { name: "Toggle Calendar Sidebar" }).click();
    await expect(miniCalendar).not.toBeInViewport();
    await page.getByRole("button", { name: "Toggle Calendar Sidebar" }).click();
    await expect(miniCalendar).toBeInViewport();
  });

  test("selecting an event shows its details in the context panel", async ({
    page,
  }) => {
    await calendarEvent(page, "Architecture Review").click();
    await expect(contextPanel(page).getByPlaceholder("Title")).toHaveValue(
      "Architecture Review",
    );
    await expect(page.getByText("Useful shortcuts")).toHaveCount(0);
  });
});

test.describe("phones", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await openCalendar(page);
  });

  test("the calendar sidebar sheet closes after picking a day", async ({
    page,
  }) => {
    const toggle = page.getByRole("button", {
      name: "Toggle Calendar Sidebar",
    });
    const sheet = page.getByRole("dialog", { name: "Calendar sidebar" });

    await toggle.click();
    await expect(sheet).toBeVisible();
    await sheet
      .locator("button[data-day]", { hasText: /^10$/ })
      .first()
      .click();
    await expect(sheet).toHaveCount(0);

    // The week of June 7 - 13 is now on screen
    await toggle.click();
    await expect(miniCalendarInView(page).first()).toHaveText("7");
  });

  test("the context panel sheet opens without focusing its search field", async ({
    page,
  }) => {
    await page
      .getByRole("button", { name: "Toggle Navigation Sidebar" })
      .click();
    const sheet = page.getByRole("dialog", { name: "Context panel" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByPlaceholder("Search events")).not.toBeFocused();
    await expect
      .poll(() =>
        sheet.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
  });
});
