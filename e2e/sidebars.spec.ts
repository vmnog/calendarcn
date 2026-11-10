import { readFile } from "node:fs/promises";

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

/** A calendar's row in the sidebar's list, by its name */
function calendarRow(page: Page, name: string): Locator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(name, { exact: true }) });
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

  test("hiding a calendar takes its events off the views until it's shown again", async ({
    page,
  }) => {
    const work = calendarRow(page, "Work");
    // On the Work calendar: "Launch Review" once, "Friday Wrap-up" every week
    await expect(calendarEvent(page, "Launch Review")).toBeVisible();

    await work.hover();
    await work.locator('[aria-label="Hide Work"]').click();
    await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
    await expect(calendarEvent(page, "Friday Wrap-up")).toHaveCount(0);
    await expect(work.getByText("Work", { exact: true })).toHaveCSS(
      "opacity",
      "0.5",
    );
    // Another calendar's event stays
    await expect(calendarEvent(page, "Weekend in Hudson Valley")).toBeVisible();

    // Month view reads the same events
    await page.keyboard.press("m");
    await expect(page.getByRole("main").getByText("Launch Review")).toHaveCount(
      0,
    );
    await page.keyboard.press("w");

    await work.hover();
    await work.locator('[aria-label="Show Work"]').click();
    await expect(calendarEvent(page, "Launch Review")).toBeVisible();
    await expect(work.getByText("Work", { exact: true })).toHaveCSS(
      "opacity",
      "1",
    );
  });

  test("hiding the selected event's calendar closes its details", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await expect(contextPanel(page).getByPlaceholder("Title")).toHaveValue(
      "Launch Review",
    );

    const work = calendarRow(page, "Work");
    await work.hover();
    await work.locator('[aria-label="Hide Work"]').click();
    await expect(page.getByText("Useful shortcuts")).toBeVisible();
  });

  test("an event moved to a hidden calendar shows that calendar again", async ({
    page,
  }) => {
    const family = calendarRow(page, "Family");
    await family.hover();
    await family.locator('[aria-label="Hide Family"]').click();
    await expect(calendarEvent(page, "Weekend in Hudson Valley")).toHaveCount(
      0,
    );

    // The right-click menu's "Block on calendar" moves the event
    await calendarEvent(page, "Launch Review").click({ button: "right" });
    await page.getByRole("button", { name: "Block on calendar" }).hover();
    await page.getByRole("button", { name: "Family", exact: true }).click();

    await expect(calendarEvent(page, "Launch Review")).toBeVisible();
    await expect(calendarEvent(page, "Weekend in Hudson Valley")).toBeVisible();
    await expect(family.locator('[aria-label="Hide Family"]')).toBeAttached();
  });

  test("the .ics export keeps a hidden calendar's events", async ({ page }) => {
    const work = calendarRow(page, "Work");
    await work.hover();
    await work.locator('[aria-label="Hide Work"]').click();
    await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+k");
    const menu = page.getByRole("dialog", { name: "Command Menu" });
    const download = page.waitForEvent("download");
    await menu.getByRole("option", { name: /^Export \.ics file/ }).click();
    const file = await (await download).path();

    expect(await readFile(file, "utf8")).toContain("SUMMARY:Launch Review");
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
