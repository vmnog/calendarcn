import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, boxOf, calendarEvent } from "../helpers";

/**
 * The registry installed in a shadcn/ui project set up with Base UI
 * (e2e/base-ui/fixture, built by tools/scripts/base-ui-fixture.sh). The page
 * renders `<Calendar defaultEvents={...} />` with "Design Review" (10-11 AM)
 * and the all-day "Team Offsite" on Thursday, June 4 2026.
 */

/** Gap between an event and its details (POPOVER_SIDE_OFFSET) */
const DETAILS_GAP = 8;

/** Checked background of the details' all-day switch, #3A85D3 */
const SWITCH_CHECKED_BACKGROUND = "rgb(58, 133, 211)";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/");
  await expect(calendarEvent(page, "Design Review")).toBeVisible();
});

test("week view: the details open beside the event", async ({ page }) => {
  const event = calendarEvent(page, "Design Review");
  await event.click();

  const details = eventDetails(page);
  await expect(details.getByPlaceholder("Title")).toHaveValue("Design Review");
  await settle(details);

  const eventBox = await boxOf(event);
  const detailsBox = await boxOf(details);
  const eventRight = eventBox.x + eventBox.width;
  const gap =
    detailsBox.x >= eventRight
      ? detailsBox.x - eventRight
      : eventBox.x - (detailsBox.x + detailsBox.width);
  expect(gap).toBeCloseTo(DETAILS_GAP, 0);
});

test("picking an event type changes it and keeps the details open", async ({
  page,
}) => {
  await calendarEvent(page, "Design Review").click();
  const details = eventDetails(page);

  await eventTypeTrigger(details, "Event").click();
  const menu = page.getByRole("menu");
  await menu.getByRole("menuitem", { name: /^Focus time/ }).click();

  await expect(menu).toHaveCount(0);
  await expect(eventTypeTrigger(details, "Focus time")).toBeVisible();
  await expect(details.getByPlaceholder("Title")).toHaveValue("Design Review");
});

test("Escape closes the type menu first, then the details", async ({
  page,
}) => {
  const event = calendarEvent(page, "Design Review");
  await event.click();
  const details = eventDetails(page);

  await eventTypeTrigger(details, "Event").click();
  // Base UI moves focus into the menu once its open animation ends
  const menu = page.getByRole("menu");
  await expect(menu).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(details).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(event).toBeFocused();
});

test("the time menu and the date picker set times and days inside the details", async ({
  page,
}) => {
  await calendarEvent(page, "Design Review").click();
  const details = eventDetails(page);
  const startTime = details.getByTestId("event-start-time");
  const endTime = details.getByTestId("event-end-time");

  // The Popover takes focus as it opens and hands it back to the field
  await startTime.click();
  const startMenu = page.getByRole("listbox", { name: "Start time" });
  await expect(startMenu).toBeVisible();
  await expect(startTime).toBeFocused();
  await startTime.press("ArrowDown");
  await expect(startTime).toHaveValue("10:15 AM");
  await startTime.press("Enter");
  await expect(startMenu).toHaveCount(0);
  await expect(endTime).toHaveValue("11:15 AM");

  // A press in the menu sets the time and keeps the details open
  await endTime.click();
  await page
    .getByRole("listbox", { name: "End time" })
    .getByRole("option", { name: /^11:45 AM/ })
    .click();
  await expect(endTime).toHaveValue("11:45 AM");
  await expect(details).toBeVisible();

  const startDate = details.getByTestId("event-start-date");
  await startDate.click();
  const picker = page.locator("[data-event-detail-field-popover]");
  await picker.locator('[data-day="2026-06-05"]').click();
  await expect(picker).toHaveCount(0);
  await expect(startDate).toHaveValue("Fri Jun 5");
  await expect(details).toBeVisible();

  // Escape closes the menu, not the details, and puts back a hovered time
  await startTime.click();
  await expect(startMenu).toBeVisible();
  await startMenu.getByRole("option", { name: "9 AM", exact: true }).hover();
  await expect(startTime).toHaveValue("9 AM");
  await page.keyboard.press("Escape");
  await expect(startMenu).toHaveCount(0);
  await expect(details).toBeVisible();
  await expect(startTime).toHaveValue("10:15 AM");
  // Base UI hands focus back to the field as the menu closes; it stays left
  await expect(startTime).not.toBeFocused();
  await expect(startMenu).toHaveCount(0);
});

test("on a 24-hour clock the time menu and typed times read as written", async ({
  page,
}) => {
  await page.goto("/24-hour");
  await calendarEvent(page, "Design Review").click();
  const details = eventDetails(page);
  const startTime = details.getByTestId("event-start-time");
  const endTime = details.getByTestId("event-end-time");
  await expect(startTime).toHaveValue("10:00");

  await startTime.click();
  const options = page
    .getByRole("listbox", { name: "Start time" })
    .getByRole("option");
  await expect(options.first()).toHaveText("00:00");
  await expect(options.last()).toHaveText("23:45");

  await startTime.fill("7");
  await expect(options).toHaveText(["07:00", "19:00"]);
  await startTime.fill("12");
  await expect(options).toHaveText(["12:00", "00:00", "01:20", "13:20"]);
  await startTime.fill("19");
  await startTime.press("Enter");
  await expect(startTime).toHaveValue("19:00");
  await expect(endTime).toHaveValue("20:00");
});

test("the all-day switch is blue when checked", async ({ page }) => {
  await calendarEvent(page, "Team Offsite").click();

  // Base UI marks a checked switch with data-checked, not data-state
  const allDay = eventDetails(page).getByRole("switch");
  await expect(allDay).toHaveAttribute("data-checked", "");
  await expect(allDay).toHaveCSS("background-color", SWITCH_CHECKED_BACKGROUND);
});

test("the details open in month and agenda views", async ({ page }) => {
  const details = eventDetails(page);

  await switchView(page, "Week", "Month");
  await calendarEvent(page, "Design Review").click();
  await expect(details.getByPlaceholder("Title")).toHaveValue("Design Review");
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);

  await switchView(page, "Month", "Agenda");
  await calendarEvent(page, "Design Review").click();
  await expect(details.getByPlaceholder("Title")).toHaveValue("Design Review");
});

/** The event details popover */
function eventDetails(page: Page): Locator {
  return page.getByRole("dialog", { name: "Event details" });
}

/** The details' event type menu trigger, by the type it shows */
function eventTypeTrigger(details: Locator, type: string): Locator {
  return details.getByRole("button", { name: type, exact: true });
}

/** Picks a view in the toolbar's view menu, opened from the current one */
async function switchView(page: Page, from: string, to: string) {
  await page.getByRole("button", { name: from, exact: true }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${to}`) }).click();
  await expect(
    page.getByRole("button", { name: to, exact: true }),
  ).toBeVisible();
}

/** Waits for the enter animation, which scales the popover, to finish */
async function settle(locator: Locator) {
  await locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    ),
  );
}
