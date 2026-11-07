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

test("on a 24-hour clock the time menu and typed times read as written, and the date picker starts on Monday", async ({
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

  // The date picker's weeks start on the provider's weekStartsOn, Monday
  await details.getByTestId("event-start-date").click();
  const picker = page.locator("[data-event-detail-field-popover]");
  await expect(picker.locator("thead th").first()).toHaveText("Mo");
  await expect(picker.locator("[data-day]").first()).toHaveAttribute(
    "data-day",
    "2026-06-01",
  );
});

test("the all-day switch is blue when checked", async ({ page }) => {
  await calendarEvent(page, "Team Offsite").click();

  // Base UI marks a checked switch with data-checked, not data-state
  const allDay = eventDetails(page).getByRole("switch");
  await expect(allDay).toHaveAttribute("data-checked", "");
  await expect(allDay).toHaveCSS("background-color", SWITCH_CHECKED_BACKGROUND);
});

test("the time zone and repeat rows edit the event", async ({ page }) => {
  await calendarEvent(page, "Design Review").click();
  const details = eventDetails(page);
  await settle(details);
  await details.getByText("Time zone", { exact: true }).click();

  // The zone list renders beside the details and keeps them open. Toronto
  // shares New York's offset, so the event stays where it is.
  const timezone = details.locator('[data-section="timezone"]');
  await timezone.getByRole("button").click();
  const input = details.getByRole("combobox", { name: "Time zone" });
  await input.fill("toronto");
  await page
    .getByRole("listbox", { name: "Time zones" })
    .getByRole("option", { name: /Toronto$/ })
    .click();
  // Escape would close the details here (no layer is open): Tab leaves the field
  await expect(input).toHaveValue("Toronto");
  await input.press("Tab");
  await expect(timezone).toHaveText("GMT−4Toronto");

  // Base UI's menu and dialog: a preset, then the custom rule
  const recurrence = details.locator('[data-section="recurrence"]');
  await recurrence.getByRole("button", { name: /^Repeat:/ }).click();
  await page.getByRole("menuitem", { name: "Every week on Thu" }).click();
  await expect(recurrence).toContainText("Every week on Thu");
  await expect(page.getByRole("menu")).toHaveCount(0);

  await recurrence.getByRole("button", { name: /^Repeat:/ }).click();
  await page.getByRole("menuitem", { name: "Custom…" }).click();
  const dialog = page.getByRole("dialog", { name: "Repeat" });
  await dialog.getByRole("button", { name: "Monday" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(recurrence).toContainText("Every week on Mon, Thu");
  await expect(details).toBeVisible();
  // Focus goes back to the Repeat button
  await expect(
    recurrence.getByRole("button", { name: /^Repeat:/ }),
  ).toBeFocused();

  // The provider steps through the series: the next occurrence is added as
  // a copy and the calendar moves to its week
  const previous = recurrence.getByRole("button", {
    name: "Go to previous event in this series",
  });
  await expect(previous).toBeDisabled();
  await recurrence
    .getByRole("button", { name: "Go to next event in this series" })
    .click();
  await expect(details.getByTestId("event-start-date")).toHaveValue(
    "Mon Jun 8",
  );
  await expect(previous).toBeEnabled();
  await previous.click();
  await expect(details.getByTestId("event-start-date")).toHaveValue(
    "Thu Jun 4",
  );
});

test("an occurrence the series arrows add is reported to onEventCreate", async ({
  page,
}) => {
  // /series: a weekly "Standup" on Thursday, June 4, the ids onEventCreate
  // reports listed above the calendar
  await page.goto("/series");
  const created = page.getByLabel("Created events");
  await calendarEvent(page, "Standup").click();
  const details = eventDetails(page);
  const recurrence = details.locator('[data-section="recurrence"]');
  const next = recurrence.getByRole("button", {
    name: "Go to next event in this series",
  });
  const previous = recurrence.getByRole("button", {
    name: "Go to previous event in this series",
  });

  await next.click();
  await expect(details.getByTestId("event-start-date")).toHaveValue(
    "Thu Jun 11",
  );
  await expect(created).toHaveText("standup-2026-06-11");

  // Opening it again reports nothing new
  await previous.click();
  await expect(details.getByTestId("event-start-date")).toHaveValue(
    "Thu Jun 4",
  );
  await next.click();
  await expect(details.getByTestId("event-start-date")).toHaveValue(
    "Thu Jun 11",
  );
  await expect(created).toHaveText("standup-2026-06-11");
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
