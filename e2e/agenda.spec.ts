import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  detailFields,
  detailTitle,
  expectHeader,
  openCalendar,
} from "./helpers";

/** Header label of the agenda opened on FROZEN_NOW: 30 days from today */
const AGENDA_LABEL = "June 2026 Jun 4 – Jul 3";

/** Header label of the agenda one step (30 days) later */
const NEXT_AGENDA_LABEL = "July 2026 Jul 4 – Aug 2";

/** Name of a weekday ("Thursday, June 4"), the start of every day's label */
const DAY_LABEL = /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, /;

/** The agenda's day groups, in order */
function agendaDays(page: Page) {
  return page.getByRole("main").getByRole("group", { name: DAY_LABEL });
}

/** One day of the agenda, by its full label ("Friday, June 5") */
function agendaDay(page: Page, label: string) {
  return page
    .getByRole("main")
    .getByRole("group", { name: label, exact: true });
}

test.describe("desktop", () => {
  test.beforeEach(async ({ page }) => {
    await openCalendar(page);
  });

  test("key a opens the agenda on today, grouped by day", async ({ page }) => {
    await page.keyboard.press("a");
    await expectHeader(page, AGENDA_LABEL);
    await expect(
      page.getByRole("button", { name: "Agenda", exact: true }),
    ).toBeVisible();

    // Starts today, marked as such, with its events in time order
    const days = agendaDays(page);
    await expect(days.first()).toHaveAccessibleName("Thursday, June 4, today");
    const today = days.first().getByRole("button");
    await expect(today).toHaveCount(3);
    await expect(today.nth(0)).toHaveAccessibleName(/^Architecture Review, /);
    await expect(today.nth(1)).toHaveAccessibleName(/^Lunch with Sarah, /);
    await expect(today.nth(2)).toHaveAccessibleName(/^Gym, /);

    // Earlier days of the week are left out, and so is a day without events
    await expect(agendaDay(page, "Monday, June 1")).toHaveCount(0);
    await expect(agendaDay(page, "Monday, June 15")).toHaveCount(1);
    await expect(agendaDay(page, "Tuesday, June 16")).toHaveCount(0);
    await expect(agendaDay(page, "Wednesday, June 17")).toHaveCount(1);

    // A multi-day event shows under each of its days, all-day events first
    for (const [label, position] of [
      ["Friday, June 5", "Day 1 of 3"],
      ["Saturday, June 6", "Day 2 of 3"],
      ["Sunday, June 7", "Day 3 of 3"],
    ]) {
      const firstEvent = agendaDay(page, label).getByRole("button").first();
      await expect(firstEvent).toHaveAccessibleName(
        new RegExp(`^Weekend in Hudson Valley, all day, .*${position}$`, "i"),
      );
      await expect(firstEvent).toContainText("All day");
      await expect(firstEvent).toContainText(position);
    }
  });

  test("previous, next and today move the agenda by 30 days", async ({
    page,
  }) => {
    await page.keyboard.press("a");
    await expectHeader(page, AGENDA_LABEL);

    await page.keyboard.press("k");
    await expectHeader(page, NEXT_AGENDA_LABEL);
    // Jul 4 and 5 have no events
    await expect(agendaDays(page).first()).toHaveAccessibleName(
      "Monday, July 6",
    );

    await page.keyboard.press("j");
    await expectHeader(page, AGENDA_LABEL);

    await page.getByRole("button", { name: "Next 30 days" }).click();
    await expectHeader(page, NEXT_AGENDA_LABEL);
    await page.getByRole("button", { name: "Today" }).click();
    await expectHeader(page, AGENDA_LABEL);

    // Back to the week view on the current week
    await page.keyboard.press("w");
    await expectHeader(page, CURRENT_WEEK_LABEL);
  });

  test("the view dropdown and the command menu open the agenda", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Week", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Agenda/ }).click();
    await expectHeader(page, AGENDA_LABEL);

    await page.keyboard.press("m");
    await expectHeader(page, "June 2026");

    await page.keyboard.press("ControlOrMeta+k");
    const menu = page.getByRole("dialog", { name: "Command Menu" });
    await menu.getByPlaceholder("Type a command...").fill("agenda");
    await menu.getByRole("option", { name: /Display agenda view/ }).click();
    await expect(menu).toHaveCount(0);
    await expectHeader(page, AGENDA_LABEL);
  });

  test("clicking an event selects it and opens its details", async ({
    page,
  }) => {
    await page.keyboard.press("a");
    const event = calendarEvent(page, "Architecture Review");

    // Wide screens show the details in the context panel
    await event.click();
    await expect(event).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(detailTitle(page)).toHaveValue("Architecture Review");
    await expect(detailFields(page).startTime).toHaveValue("10 AM");
    await expect(detailFields(page).endTime).toHaveValue("11:30 AM");

    // With the context panel closed, the details open in a popover
    await page.keyboard.press("/");
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    await expect(popover.getByPlaceholder("Title")).toHaveValue(
      "Architecture Review",
    );
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(event).toHaveAttribute("aria-pressed", "false");

    // A multi-day event opens one popover, whichever of its days is clicked
    await agendaDay(page, "Saturday, June 6")
      .getByRole("button", { name: /^Weekend in Hudson Valley/ })
      .click();
    await expect(popover).toHaveCount(1);
    await expect(popover.getByPlaceholder("Title")).toHaveValue(
      "Weekend in Hudson Valley",
    );

    // Keyboard: Enter on a focused event opens it
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await calendarEvent(page, "Gym").first().focus();
    await page.keyboard.press("Enter");
    await expect(popover.getByPlaceholder("Title")).toHaveValue("Gym");
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

  test("the agenda lists today's events and opens the details sheet", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Week", exact: true }).tap();
    await page.getByRole("menuitem", { name: /^Agenda/ }).tap();

    const today = agendaDays(page).first();
    await expect(today).toHaveAccessibleName("Thursday, June 4, today");
    await expect(today).toBeInViewport();

    const sheet = page.getByRole("dialog", { name: "Context panel" });
    await expect(sheet).toHaveCount(0);
    await calendarEvent(page, "Architecture Review").tap();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByPlaceholder("Title")).toHaveValue(
      "Architecture Review",
    );
    await expect(detailFields(page).startTime).toHaveValue("10 AM");
  });
});
