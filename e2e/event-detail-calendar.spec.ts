import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { calendarEvent, detailTitle, openCalendar } from "./helpers";

/**
 * The bottom block of the detail panel: the calendar picker with the event
 * color, busy/free, visibility and reminders. "Launch Review" (Sat Jun 6) is
 * on the Work calendar of the you@work.example.com account, green, busy,
 * private, with 10min and 1hour reminders.
 */

/** One section of the context panel's event details */
function detailSection(page: Page, name: string): Locator {
  return page.locator(`[data-section="${name}"]`);
}

/** The calendar row, which opens the calendar picker */
function calendarTrigger(page: Page): Locator {
  return detailSection(page, "calendar").getByRole("button");
}

/** The reminder input heading the reminders */
function reminderInput(page: Page): Locator {
  return page.getByRole("combobox", { name: "Add reminder" });
}

/** Reminder rows of the panel, as text ("10 min before") */
function reminderRows(page: Page): Locator {
  return page.getByTestId("event-reminder");
}

/** Matches a reminder label whatever space Notion's hair space shows as */
function reminderText(amount: string, unit: string): RegExp {
  return new RegExp(`^${amount}\\s?${unit} before$`);
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("the calendar picker lists every account's calendars and moves the event", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  await expect(calendarTrigger(page)).toHaveAccessibleName("Calendar: Work");

  await calendarTrigger(page).click();
  const menu = page.getByRole("menu", { name: "Calendar" });
  await expect(
    menu.getByRole("group", { name: "you@example.com" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("group", { name: "you@work.example.com" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("menuitemradio", { name: "Work", exact: true }),
  ).toBeChecked();
  await expect(
    menu.getByRole("menuitemradio", { name: "Personal" }),
  ).not.toBeChecked();

  // Hovering a calendar previews it in the row (hidden from the
  // accessibility tree while the menu is open, so found by its section)
  await menu.getByRole("menuitemradio", { name: "Personal" }).hover();
  await expect(detailSection(page, "calendar").locator("button")).toContainText(
    "Personal",
  );

  await menu.getByRole("menuitemradio", { name: "Personal" }).click();
  await expect(menu).toHaveCount(0);
  await expect(calendarTrigger(page)).toHaveAccessibleName(
    "Calendar: Personal",
  );
  // The event keeps its own green, drawn in front of the calendar's purple
  await expect(
    page.getByTestId("event-calendar-swatch").locator("span"),
  ).toHaveCount(2);
  await expect(detailTitle(page)).toHaveValue("Launch Review");
});

test("an event that kept its calendar's color and reminders takes the new calendar's", async ({
  page,
}) => {
  // On you@example.com, red like its calendar, with its 10min default
  await calendarEvent(
    page,
    "1:1 with Manager, 3:00 PM to 3:30 PM, Wednesday, June 3",
  ).click();
  await expect(calendarTrigger(page)).toHaveAccessibleName(
    "Calendar: you@example.com",
  );
  await expect(
    page.getByTestId("event-calendar-swatch").locator("span"),
  ).toHaveCount(0);

  await calendarTrigger(page).click();
  await page
    .getByRole("menuitemradio", { name: "you@work.example.com" })
    .click();

  await expect(calendarTrigger(page)).toHaveAccessibleName(
    "Calendar: you@work.example.com",
  );
  // Gray like its new calendar (one swatch), with the work account's 30min
  await expect(
    page.getByTestId("event-calendar-swatch").locator("span"),
  ).toHaveCount(0);
  await expect(reminderRows(page)).toHaveCount(1);
  await expect(reminderRows(page)).toHaveText(reminderText("30", "min"));
});

test("the calendar picker sets the event's own color", async ({ page }) => {
  await calendarEvent(page, "Launch Review").click();
  await calendarTrigger(page).click();

  const colors = page.getByRole("group", { name: "Event color" });
  await expect(colors.getByRole("menuitemradio")).toHaveCount(7);
  await expect(
    colors.getByRole("menuitemradio", { name: "Green" }),
  ).toBeChecked();

  // A swatch's name shows in a tooltip
  await colors.getByRole("menuitemradio", { name: "Purple" }).hover();
  await expect(page.getByRole("tooltip")).toHaveText("Purple");

  await colors.getByRole("menuitemradio", { name: "Purple" }).click();
  await expect(colors).toHaveCount(0);

  await calendarTrigger(page).click();
  await expect(
    page
      .getByRole("group", { name: "Event color" })
      .getByRole("menuitemradio", { name: "Purple" }),
  ).toBeChecked();
});

test("busy/free and visibility menus change the event, and Escape only closes them", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  const availability = page.getByRole("button", { name: /^Availability:/ });
  const visibility = page.getByRole("button", { name: /^Visibility:/ });
  await expect(availability).toHaveAccessibleName("Availability: Busy");
  await expect(visibility).toHaveAccessibleName("Visibility: Private");

  await availability.click();
  const busyMenu = page.getByRole("menu", { name: "Availability" });
  await expect(
    busyMenu.getByRole("menuitemradio", { name: "Busy" }),
  ).toBeChecked();

  // Hovering a choice previews it (the trigger is hidden from the
  // accessibility tree while the menu is open, so found by its section);
  // Escape closes the menu, not the event
  await busyMenu.getByRole("menuitemradio", { name: "Free" }).hover();
  await expect(
    detailSection(page, "availability").locator("button").first(),
  ).toHaveText("Free");
  await page.keyboard.press("Escape");
  await expect(busyMenu).toHaveCount(0);
  await expect(availability).toHaveText("Busy");
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  await availability.click();
  await busyMenu.getByRole("menuitemradio", { name: "Free" }).click();
  await expect(availability).toHaveAccessibleName("Availability: Free");

  await visibility.click();
  const visibilityMenu = page.getByRole("menu", { name: "Visibility" });
  await expect(visibilityMenu.getByRole("menuitemradio")).toHaveText([
    "Default visibility",
    "Public",
    "Private",
  ]);
  await visibilityMenu.getByRole("menuitemradio", { name: "Public" }).click();
  await expect(visibility).toHaveAccessibleName("Visibility: Public");

  // The "?" of a choice explains it
  await visibility.click();
  await visibilityMenu
    .getByRole("menuitemradio", { name: "Private" })
    .getByTestId("menu-help")
    .hover();
  await expect(page.getByRole("tooltip")).toHaveText(
    "Nobody can see the details of this event unless they have permission to make changes to this calendar.",
  );
});

test("reminders are added from the presets or a typed number, and removed", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  await expect(reminderRows(page)).toHaveText([
    reminderText("10", "min"),
    reminderText("1", "hour"),
  ]);

  // Focusing the input lists the presets beside the panel
  await reminderInput(page).click();
  const suggestions = page.getByRole("listbox", { name: "Reminders" });
  await expect(suggestions.getByRole("option")).toHaveText([
    "At start of event",
    reminderText("5", "min"),
    reminderText("10", "min"),
    reminderText("30", "min"),
    reminderText("1", "hour"),
  ]);
  await suggestions.getByRole("option", { name: "At start of event" }).click();
  await expect(reminderRows(page)).toHaveCount(3);
  await expect(reminderRows(page).last()).toHaveText("At start of event");

  // A typed number is offered in every unit; Down previews the next one
  await reminderInput(page).fill("2");
  await expect(suggestions.getByRole("option")).toHaveText([
    reminderText("2", "min"),
    reminderText("2", "hours"),
    reminderText("2", "days"),
    reminderText("2", "weeks"),
  ]);
  await page.keyboard.press("ArrowDown");
  await expect(reminderInput(page)).toHaveValue(/^2\s?hours$/);
  await page.keyboard.press("Enter");
  await expect(reminderRows(page).last()).toHaveText(
    reminderText("2", "hours"),
  );

  // Escape leaves the input and keeps the event selected
  await page.keyboard.press("Escape");
  await expect(suggestions).toHaveCount(0);
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  // Each reminder's × removes it
  await page
    .getByRole("button", { name: "Remove reminder at start of event" })
    .click();
  await expect(reminderRows(page)).toHaveText([
    reminderText("10", "min"),
    reminderText("1", "hour"),
    reminderText("2", "hours"),
  ]);
});

test("an all-day event offers day and week reminders", async ({ page }) => {
  await calendarEvent(page, "Launch Review").click();
  await page.getByRole("switch", { name: "All-day" }).click();

  await reminderInput(page).click();
  await expect(
    page.getByRole("listbox", { name: "Reminders" }).getByRole("option"),
  ).toHaveText([
    "At start of event",
    reminderText("1", "day"),
    reminderText("2", "days"),
    reminderText("3", "days"),
    reminderText("1", "week"),
  ]);
});
