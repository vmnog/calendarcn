import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  detailFields,
  detailTitle,
  openCalendar,
} from "./helpers";

/**
 * The details panel's time block, as in Notion Calendar: the floating time
 * menu of the start and end times, the date picker and the all-day switch.
 * "Launch Review" is Saturday, June 6 2026, 10–11:30 AM.
 */

/** The time menu a time field opens */
function timeMenu(page: Page, name: "Start time" | "End time"): Locator {
  return page.getByRole("listbox", { name });
}

/** The option the arrow keys, typing or the pointer made active */
function activeOption(menu: Locator): Locator {
  return menu.getByRole("option", { selected: true });
}

/** The date picker a date field opens */
function datePicker(page: Page): Locator {
  return page.locator("[data-event-detail-field-popover]");
}

/** The time section of the context panel */
function timeSection(page: Page): Locator {
  return page.locator('[data-section="time"]');
}

/** The selected part of an input's text, e.g. all of it */
function selectedText(input: Locator): Promise<string> {
  return input.evaluate((el: HTMLInputElement) =>
    el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
  );
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
  await calendarEvent(page, "Launch Review").click();
  await expect(detailTitle(page)).toHaveValue("Launch Review");
});

test("the start time opens a menu of every 15 minutes beside the panel, at the current time", async ({
  page,
}) => {
  const { startTime } = detailFields(page);
  await startTime.click();

  const menu = timeMenu(page, "Start time");
  await expect(menu).toBeVisible();
  await expect(startTime).toHaveAttribute("aria-expanded", "true");
  await expect.poll(() => selectedText(startTime)).toBe("10 AM");

  const options = menu.getByRole("option");
  await expect(options).toHaveCount(96);
  await expect(options.first()).toHaveText("12 AM");
  await expect(options.nth(1)).toHaveText("12:15 AM");
  await expect(options.last()).toHaveText("11:45 PM");
  await expect(activeOption(menu)).toHaveText("10 AM");
  await expect(activeOption(menu)).toBeInViewport();

  // Left of the panel, its top on the field's
  const menuBox = await boxOf(menu);
  const sectionBox = await boxOf(timeSection(page));
  expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(sectionBox.x - 4);
  expect(Math.abs(menuBox.y - sectionBox.y)).toBeLessThan(6);
});

test("the arrow keys preview a time, and Enter sets it and keeps the duration", async ({
  page,
}) => {
  const { startTime, endTime } = detailFields(page);
  await startTime.click();
  const menu = timeMenu(page, "Start time");

  await startTime.press("ArrowDown");
  await expect(startTime).toHaveValue("10:15 AM");
  await expect(activeOption(menu)).toHaveText("10:15 AM");
  await startTime.press("ArrowDown");
  await expect(startTime).toHaveValue("10:30 AM");
  await startTime.press("ArrowUp");
  await expect(startTime).toHaveValue("10:15 AM");
  // A preview isn't set yet
  await expect(endTime).toHaveValue("11:30 AM");

  await startTime.press("Enter");
  await expect(menu).toBeHidden();
  await expect(startTime).toBeFocused();
  await expect(startTime).toHaveValue("10:15 AM");
  await expect(endTime).toHaveValue("11:45 AM");
  await expect(calendarEvent(page, "Launch Review")).toHaveAccessibleName(
    /10:15 AM to 11:45 AM/,
  );

  // Arrow keys open it again
  await startTime.press("ArrowDown");
  await expect(menu).toBeVisible();
  await expect(activeOption(menu)).toHaveText("10:15 AM");
});

test("a typed time set with Enter stays when another field takes focus", async ({
  page,
}) => {
  const { startTime, endTime } = detailFields(page);
  await startTime.click();
  await startTime.fill("2p");
  await expect(activeOption(timeMenu(page, "Start time"))).toHaveText("2 PM");
  await startTime.press("Enter");
  await expect(startTime).toHaveValue("2 PM");

  await endTime.click();
  await expect(timeMenu(page, "End time")).toBeVisible();
  await expect(startTime).toHaveValue("2 PM");
  await expect(endTime).toHaveValue("3:30 PM");
});

test("typing lists the times the text can mean, the daytime one first", async ({
  page,
}) => {
  const { startTime, endTime } = detailFields(page);
  await startTime.click();
  const options = timeMenu(page, "Start time").getByRole("option");

  await startTime.fill("7");
  await expect(options).toHaveText(["7 PM", "7 AM"]);
  await startTime.fill("9");
  await expect(options).toHaveText(["9 AM", "9 PM"]);
  await startTime.fill("12");
  await expect(options).toHaveText(["12 PM", "12 AM", "1:20 PM", "1:20 AM"]);
  await startTime.fill("7:3p");
  await expect(options).toHaveText(["7:30 PM"]);
  await startTime.fill("930");
  await expect(options).toHaveText(["9:30 AM", "9:30 PM"]);
  // Typing previews nothing: the field keeps the text
  await expect(startTime).toHaveValue("930");

  await startTime.press("Enter");
  await expect(startTime).toHaveValue("9:30 AM");
  await expect(endTime).toHaveValue("11 AM");
});

test("the end time lists the times after the start with how long the event lasts", async ({
  page,
}) => {
  const { endTime } = detailFields(page);
  await endTime.click();
  const menu = timeMenu(page, "End time");
  const options = menu.getByRole("option");

  await expect(options.first()).toHaveText("10:15 AM 15min");
  await expect(options.nth(3)).toHaveText("11 AM 1h");
  await expect(options.nth(4)).toHaveText("11:15 AM 1h 15min");
  await expect(activeOption(menu)).toHaveText("11:30 AM 1h 30min");
  // A day of options, into the next day
  await expect(options).toHaveCount(96);
  await expect(options.last()).toHaveText("10 AM 24h");

  // Times before the start fall on the next day; numbers read as durations too
  await endTime.fill("2");
  await expect(options).toHaveText([
    "2 PM 4h",
    "2 AM 16h",
    "12 PM 2h",
    "10:02 AM 2min",
  ]);
  await endTime.fill("45");
  await expect(options).toHaveText([
    "4:50 PM 6h 50min",
    "4:50 AM 18h 50min",
    "10:45 AM 45min",
    "7 AM 45h",
  ]);

  await menu.getByRole("option", { name: "10:45 AM 45min" }).click();
  await expect(menu).toBeHidden();
  await expect(endTime).toBeFocused();
  await expect(endTime).toHaveValue("10:45 AM");
  await expect(timeSection(page)).toContainText("45min");
});

test("hovering an option previews it, and Escape keeps it and leaves the field", async ({
  page,
}) => {
  const { startTime, endTime } = detailFields(page);
  await startTime.click();
  const menu = timeMenu(page, "Start time");

  await menu.getByRole("option", { name: "9 AM", exact: true }).hover();
  await expect(startTime).toHaveValue("9 AM");
  await expect(activeOption(menu)).toHaveText("9 AM");

  // As in Notion Calendar, Escape sets the previewed time
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(startTime).not.toBeFocused();
  await expect(startTime).toHaveValue("9 AM");
  await expect(endTime).toHaveValue("10:30 AM");
  // The event stays selected
  await expect(detailTitle(page)).toHaveValue("Launch Review");
});

test("text that isn't a time puts the time back when the field is left", async ({
  page,
}) => {
  const { startTime, endTime } = detailFields(page);
  await startTime.click();
  await startTime.fill("soon");
  await expect(timeMenu(page, "Start time").getByRole("option")).toHaveCount(0);

  await startTime.press("Tab");
  await expect(startTime).toHaveValue("10 AM");
  // Tab goes on to the end time, which opens its own menu
  await expect(endTime).toBeFocused();
  await expect(timeMenu(page, "End time")).toBeVisible();
  await expect(timeMenu(page, "Start time")).toBeHidden();
});

test("the date picker marks a typed date, Enter or a click on a day moves the event", async ({
  page,
}) => {
  const { startDate, startTime } = detailFields(page);
  await startDate.click();

  const picker = datePicker(page);
  await expect(picker).toBeVisible();
  await expect(picker).toContainText("June 2026");
  await expect(picker.getByRole("gridcell", { selected: true })).toHaveText(
    "6",
  );
  await expect.poll(() => selectedText(startDate)).toBe("Sat Jun 6");

  // Typing marks the day, Escape puts the date back
  await startDate.fill("Jun 12");
  await expect(picker.getByRole("gridcell", { selected: true })).toHaveText(
    "12",
  );
  await startDate.press("Escape");
  await expect(picker).toBeHidden();
  await expect(startDate).toHaveValue("Sat Jun 6");

  await startDate.click();
  await startDate.fill("Jun 12");
  await startDate.press("Enter");
  await expect(startDate).toHaveValue("Fri Jun 12");
  await expect(startDate).toBeFocused();
  await expect(startTime).toHaveValue("10 AM");

  // A press on the focused field opens the picker again; a click on a day
  // sets it and leaves the field
  await startDate.click();
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "Next month" }).click();
  await expect(picker).toContainText("July 2026");
  await picker.locator('[data-day="2026-07-03"]').click();
  await expect(picker).toBeHidden();
  await expect(startDate).toHaveValue("Fri Jul 3");
  await expect(startDate).not.toBeFocused();
});

test("all-day mutes the times and shows the end date under the end time", async ({
  page,
}) => {
  const { startTime, endTime } = detailFields(page);
  const allDay = page.getByRole("switch", { name: "All-day" });
  const endDate = page.getByTestId("event-end-date");
  await expect(endDate).toBeHidden();

  await allDay.click();
  await expect(allDay).toBeChecked();
  await expect(startTime).toHaveAttribute("readonly", "");
  await expect(startTime).toHaveCSS("pointer-events", "none");
  await expect(startTime).toHaveAttribute("tabindex", "-1");
  await expect(endDate).toHaveValue("Sat Jun 6");
  // The end date lines up under the end time
  const endTimeBox = await boxOf(endTime);
  const endDateBox = await boxOf(endDate);
  expect(Math.abs(endDateBox.x - endTimeBox.x)).toBeLessThan(2);

  await allDay.click();
  await expect(allDay).not.toBeChecked();
  await expect(startTime).toHaveValue("10 AM");
  await expect(endTime).toHaveValue("11:30 AM");
  await expect(endDate).toBeHidden();
});
