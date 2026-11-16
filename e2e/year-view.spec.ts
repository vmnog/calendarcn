import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  FROZEN_NOW,
  boxOf,
  calendarEvent,
  expectHeader,
  openCalendar,
} from "./helpers";

/**
 * Year view (YearView): twelve month grids opened with Y, the view dropdown
 * or the command menu. Each day is a button named by its date, "today" and
 * its number of events, e.g. "Thursday, June 4, today, 3 events".
 */

/** The year view's month grids, January first */
function monthGrids(page: Page): Locator {
  return page.getByRole("main").getByRole("grid");
}

/** A day of the year view, by its full name */
function yearDay(page: Page, name: string): Locator {
  return page.getByRole("main").getByRole("button", { name, exact: true });
}

/** A day of the year view, by the date its name starts with ("Friday, June 5") */
function yearDayByDate(page: Page, date: string): Locator {
  return page
    .getByRole("main")
    .getByRole("button", { name: new RegExp(`^${date}(,|$)`) });
}

test.describe("desktop", () => {
  test.beforeEach(async ({ page }) => {
    await openCalendar(page);
  });

  test("key y opens the year with today marked and event days counted", async ({
    page,
  }) => {
    await page.keyboard.press("y");
    await expectHeader(page, "2026");
    await expect(
      page.getByRole("button", { name: "Year", exact: true }),
    ).toBeVisible();

    const grids = monthGrids(page);
    await expect(grids).toHaveCount(12);
    await expect(grids.first()).toHaveAccessibleName("January 2026");
    await expect(grids.last()).toHaveAccessibleName("December 2026");

    // Today has Architecture Review, Lunch with Sarah and Gym
    const today = yearDay(page, "Thursday, June 4, today, 3 events");
    await expect(today).toBeVisible();
    await expect(today).toHaveAttribute("aria-current", "date");

    // New Year's Day is January 1's only event; January 2 has none
    const newYear = yearDay(page, "Thursday, January 1, 1 event");
    await expect(newYear).toBeVisible();
    await expect(newYear.locator("span")).toHaveCount(1);
    const quietDay = yearDay(page, "Friday, January 2");
    await expect(quietDay).toBeVisible();
    await expect(quietDay.locator("span")).toHaveCount(0);
    await expect(yearDay(page, "Tuesday, June 16")).toBeVisible();

    // January's grid leaves out December's days
    await expect(
      grids.first().getByRole("button", { name: /^Sunday, December 28/ }),
    ).toHaveCount(0);
  });

  test("previous, next and today move a year, and leaving lands on today's period", async ({
    page,
  }) => {
    await page.keyboard.press("y");
    await expectHeader(page, "2026");

    await page.keyboard.press("k");
    await expectHeader(page, "2027");
    await expect(yearDay(page, "Friday, January 1, 1 event")).toBeVisible();
    await page.keyboard.press("j");
    await page.keyboard.press("j");
    await expectHeader(page, "2025");

    await page.getByRole("button", { name: "Next year" }).click();
    await page.getByRole("button", { name: "Next year" }).click();
    await expectHeader(page, "2027");
    await page.getByRole("button", { name: "Previous year" }).click();
    await expectHeader(page, "2026");

    // From the year that holds today, week and month view open on today
    await page.keyboard.press("w");
    await expectHeader(page, CURRENT_WEEK_LABEL);
    await page.keyboard.press("y");
    await page.keyboard.press("m");
    await expectHeader(page, "June 2026");

    // From another year, they open on its first week
    await page.keyboard.press("y");
    await page.keyboard.press("k");
    await expectHeader(page, "2027");
    await page.keyboard.press("w");
    await expectHeader(page, "January 2027 Week 1");

    await page.getByRole("button", { name: "Today", exact: true }).click();
    await expectHeader(page, CURRENT_WEEK_LABEL);
  });

  test("arrow keys move between days and stay in the year", async ({
    page,
  }) => {
    await page.keyboard.press("y");
    await yearDay(page, "Thursday, June 4, today, 3 events").focus();

    await page.keyboard.press("ArrowRight");
    await expect(yearDayByDate(page, "Friday, June 5")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(yearDayByDate(page, "Friday, June 12")).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(yearDayByDate(page, "Sunday, July 12")).toBeFocused();
    // The arrows move focus, not the year
    await expectHeader(page, "2026");

    // A year change keeps the same day focused
    await page.keyboard.press("k");
    await expectHeader(page, "2027");
    await expect(yearDayByDate(page, "Monday, July 12")).toBeFocused();

    // The last day of the year is as far as the arrows go
    await page.keyboard.press("j");
    await expectHeader(page, "2026");
    await yearDayByDate(page, "Thursday, December 31").focus();
    await page.keyboard.press("ArrowRight");
    await expect(yearDayByDate(page, "Thursday, December 31")).toBeFocused();
    await expectHeader(page, "2026");
  });

  test("a click or Enter on a day opens its week", async ({ page }) => {
    await page.keyboard.press("y");
    await yearDay(page, "Tuesday, June 16").click();
    await expectHeader(page, "June 2026 Week 25");

    await page.keyboard.press("y");
    await yearDay(page, "Thursday, January 1, 1 event").focus();
    await page.keyboard.press("Enter");
    await expectHeader(page, "January 2026 Week 1");
  });

  test("the view dropdown and the command menu open the year", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Year/ }).click();
    await expectHeader(page, "2026");

    await page.keyboard.press("m");
    await expectHeader(page, "June 2026");

    await page.keyboard.press("ControlOrMeta+k");
    const menu = page.getByRole("dialog", { name: "Command Menu" });
    await menu.getByPlaceholder("Type a command...").fill("year");
    await menu.getByRole("option", { name: /Display year view/ }).click();
    await expect(menu).toHaveCount(0);
    await expectHeader(page, "2026");
  });

  test("week numbers show beside each month's weeks, and turn off with the setting", async ({
    page,
  }) => {
    // The demo starts with week numbers on
    await page.keyboard.press("y");
    const january = monthGrids(page).first();
    await expect(january.getByRole("rowheader")).toHaveText([
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);

    await page.getByRole("button", { name: "Year", exact: true }).click();
    await page.getByRole("menuitem", { name: "View settings" }).click();
    await page
      .getByRole("menuitemcheckbox", { name: "Week numbers", exact: true })
      .click();

    await expect(january.getByRole("rowheader")).toHaveCount(0);
  });

  test("a paste does nothing in year view, where no day or slot is drawn", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("ControlOrMeta+c");
    await page.keyboard.press("m");
    await expectHeader(page, "June 2026");
    const launchReviews = calendarEvent(page, "Launch Review");
    const before = await launchReviews.count();
    expect(before).toBeGreaterThan(0);

    await page.keyboard.press("y");
    await expectHeader(page, "2026");
    await yearDayByDate(page, "Wednesday, June 10").hover();
    await page.keyboard.press("ControlOrMeta+v");

    await page.keyboard.press("m");
    await expectHeader(page, "June 2026");
    await expect(launchReviews).toHaveCount(before);
  });

  test("a repeating event counts on each of its dates", async ({ page }) => {
    await page.keyboard.press("y");
    // Launch Review repeats every 2 weeks on Saturday from June 6, 6 times
    await expect(
      yearDayByDate(page, "Saturday, July 18").first(),
    ).toHaveAccessibleName(/, \d+ events?$/);
    await expect(
      yearDayByDate(page, "Saturday, August 15").first(),
    ).toHaveAccessibleName(/, \d+ events?$/);
    // July 25 falls between two repeats and has no events of its own
    await expect(yearDay(page, "Saturday, July 25")).toBeVisible();
    // The series ends after August 15
    await expect(yearDay(page, "Saturday, August 29")).toBeVisible();
  });

  test("a toast stays at the bottom right, over the year grid", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("Delete");
    await page.keyboard.press("y");
    await expectHeader(page, "2026");

    const toast = page
      .getByRole("region", { name: "Notifications" })
      .locator('[data-slot="calendar-toast"]');
    await expect(toast).toContainText("Event deleted");
    const box = await boxOf(toast);
    expect(box.x + box.width).toBeGreaterThan(1440 - 400);
    expect(box.y + box.height).toBeGreaterThan(900 - 100);
    // Nothing of the year grid sits on top of it
    const isOnTop = await toast.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return hit !== null && element.contains(hit);
    });
    expect(isOnTop).toBe(true);
  });

  test("y typed into a field stays there, and opens the year outside it", async ({
    page,
  }) => {
    await page.keyboard.press("ControlOrMeta+k");
    const menu = page.getByRole("dialog", { name: "Command Menu" });
    const input = menu.getByPlaceholder("Type a command...");
    await expect(input).toBeFocused();
    await page.keyboard.type("y");
    await expect(input).toHaveValue("y");

    // The dialog hides the page behind it, so the header is read once it closes
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expectHeader(page, CURRENT_WEEK_LABEL);
    await page.keyboard.press("y");
    await expectHeader(page, "2026");
  });
});

test.describe("phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await openCalendar(page);
  });

  test("months sit two to a row and fit the screen", async ({ page }) => {
    await page.getByRole("button", { name: "Week", exact: true }).tap();
    await page.getByRole("menuitem", { name: /^Year/ }).tap();
    await expectHeader(page, "2026");

    const grids = monthGrids(page);
    await expect(grids).toHaveCount(12);
    const january = await boxOf(grids.nth(0));
    const february = await boxOf(grids.nth(1));
    const march = await boxOf(grids.nth(2));
    expect(february.y).toBe(january.y);
    expect(february.x).toBeGreaterThanOrEqual(january.x + january.width);
    expect(march.y).toBeGreaterThanOrEqual(january.y + january.height);
    expect(february.x + february.width).toBeLessThanOrEqual(390);
  });
});

test.describe("docs example", () => {
  test("the year draws with only a provider around it", async ({ page }) => {
    await page.clock.setFixedTime(FROZEN_NOW);
    await page.goto("/docs/components/year-view");
    const example = page.locator('[data-example="year-view-demo"]');

    await expect(example.getByRole("grid")).toHaveCount(12);
    await expect(example.getByRole("grid").first()).toHaveAccessibleName(
      "January 2026",
    );
    await expect(
      example.getByRole("button", {
        name: /^Thursday, June 4, today, \d+ events?$/,
      }),
    ).toBeVisible();
  });
});
