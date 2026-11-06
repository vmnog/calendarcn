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

test("the all-day switch is blue when checked", async ({ page }) => {
  await calendarEvent(page, "Team Offsite").click();

  // Base UI marks a checked switch with data-checked, not data-state
  const allDay = eventDetails(page).getByRole("switch");
  await expect(allDay).toHaveAttribute("data-checked", "");
  await expect(allDay).toHaveCSS("background-color", SWITCH_CHECKED_BACKGROUND);
});

test("the calendar, availability and reminder menus edit the event", async ({
  page,
}) => {
  await calendarEvent(page, "Design Review").click();
  const details = eventDetails(page);
  await settle(details);

  // Busy/free: Escape closes the menu and leaves the details open
  const availability = details.getByRole("button", { name: /^Availability:/ });
  await availability.click();
  const busyMenu = page.getByRole("menu", { name: "Availability" });
  await expect(
    busyMenu.getByRole("menuitemradio", { name: "Busy" }),
  ).toBeChecked();
  // Base UI moves focus into the menu once its open animation ends
  await expect(busyMenu).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(busyMenu).toHaveCount(0);
  await expect(details).toBeVisible();
  await availability.click();
  await busyMenu.getByRole("menuitemradio", { name: "Free" }).click();
  await expect(availability).toHaveAccessibleName("Availability: Free");

  // Visibility
  const visibility = details.getByRole("button", { name: /^Visibility:/ });
  await visibility.click();
  await page
    .getByRole("menu", { name: "Visibility" })
    .getByRole("menuitemradio", { name: "Public" })
    .click();
  await expect(visibility).toHaveAccessibleName("Visibility: Public");

  // The event's own color, from the calendar menu (no calendars configured)
  await details.getByRole("button", { name: /^Calendar:/ }).click();
  await page
    .getByRole("group", { name: "Event color" })
    .getByRole("menuitemradio", { name: "Purple" })
    .click();
  await details.getByRole("button", { name: /^Calendar:/ }).click();
  await expect(
    page
      .getByRole("group", { name: "Event color" })
      .getByRole("menuitemradio", { name: "Purple" }),
  ).toBeChecked();
  await expect(page.getByRole("menu", { name: "Calendar" })).toBeFocused();
  await page.keyboard.press("Escape");

  // A reminder from the presets
  await details.getByRole("combobox", { name: "Add reminder" }).click();
  await page
    .getByRole("listbox", { name: "Reminders" })
    .getByRole("option", { name: /^10\s?min before$/ })
    .click();
  await expect(details.getByTestId("event-reminder")).toHaveText(
    /^10\s?min before$/,
  );
  await expect(details).toBeVisible();
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
