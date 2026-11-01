import { expect, test } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  expectHeader,
  monthCell,
  openCalendar,
} from "./helpers";

/** Header label of the day view on FROZEN_NOW */
const DAY_LABEL = "June 2026 Thursday, Jun 4";

/** Header label of the month view opened from the current week */
const MONTH_LABEL = "June 2026";

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("starts in week view on the current week", async ({ page }) => {
  await expectHeader(page, CURRENT_WEEK_LABEL);
  await expect(
    page.getByRole("button", { name: "Week", exact: true }),
  ).toBeVisible();
  await expect(calendarEvent(page, "Sprint Planning")).toBeInViewport();
});

test("keys d, w and m switch between day, week and month", async ({ page }) => {
  await page.keyboard.press("d");
  await expectHeader(page, DAY_LABEL);
  await expect(
    page.getByRole("button", { name: "Day", exact: true }),
  ).toBeVisible();
  // Day view shows today only: Thursday's event, not Monday's
  await expect(calendarEvent(page, "Architecture Review")).toBeInViewport();
  await expect(calendarEvent(page, "Sprint Planning")).not.toBeInViewport();

  await page.keyboard.press("w");
  await expectHeader(page, CURRENT_WEEK_LABEL);
  await expect(calendarEvent(page, "Sprint Planning")).toBeInViewport();

  await page.keyboard.press("m");
  await expectHeader(page, MONTH_LABEL);
  await expect(
    page.getByRole("button", { name: "Month", exact: true }),
  ).toBeVisible();
  await expect(monthCell(page, "2026-06-30")).toBeVisible();
  await expect(
    monthCell(page, "2026-06-01").getByRole("button", {
      name: /Sprint Planning/,
    }),
  ).toBeVisible();

  await page.keyboard.press("w");
  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("view dropdown switches views", async ({ page }) => {
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Month/ }).click();
  await expectHeader(page, MONTH_LABEL);

  await page.getByRole("button", { name: "Month", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Day/ }).click();
  await expectHeader(page, DAY_LABEL);

  await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Week/ }).click();
  await expectHeader(page, CURRENT_WEEK_LABEL);
});
