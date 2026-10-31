import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  expectHeader,
  openCalendar,
} from "./helpers";

/** Header label of the week before the current one (May 24 - 30) */
const PREV_WEEK_LABEL = "May 2026 Week 22";

/** Header label of the week after the current one (Jun 7 - 13) */
const NEXT_WEEK_LABEL = "June 2026 Week 24";

/** Asserts the calendar shows the previous week, by header and content */
async function expectPrevWeek(page: Page): Promise<void> {
  await expectHeader(page, PREV_WEEK_LABEL);
  await expect(calendarEvent(page, "Brunch with Mom")).toBeInViewport();
}

/** Asserts the calendar shows the next week, by header and content */
async function expectNextWeek(page: Page): Promise<void> {
  await expectHeader(page, NEXT_WEEK_LABEL);
  await expect(calendarEvent(page, "Roadmap Sync")).toBeInViewport();
}

/** Asserts the calendar is back on the current week */
async function expectCurrentWeek(page: Page): Promise<void> {
  await expectHeader(page, CURRENT_WEEK_LABEL);
  await expect(calendarEvent(page, "Sprint Planning")).toBeInViewport();
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("J and K move a week back and forward, T returns to today", async ({
  page,
}) => {
  await page.keyboard.press("j");
  await expectPrevWeek(page);

  await page.keyboard.press("k");
  await expectCurrentWeek(page);

  await page.keyboard.press("k");
  await expectNextWeek(page);

  await page.keyboard.press("t");
  await expectCurrentWeek(page);
});

test("arrow keys move a week back and forward", async ({ page }) => {
  await page.keyboard.press("ArrowLeft");
  await expectPrevWeek(page);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expectNextWeek(page);
});

test("header buttons navigate weeks and return to today", async ({ page }) => {
  await page.getByRole("button", { name: "Previous week" }).click();
  await expectPrevWeek(page);

  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await expectNextWeek(page);

  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expectCurrentWeek(page);
});

test("clicking a mini calendar day opens its week", async ({ page }) => {
  await page
    .getByRole("button", { name: "Wednesday, June 17th, 2026" })
    .click();
  await expectHeader(page, "June 2026 Week 25");

  await page.getByRole("button", { name: "Go to next month" }).click();
  await page
    .getByRole("button", { name: "Wednesday, July 15th, 2026" })
    .click();
  await expectHeader(page, "July 2026 Week 29");
});
