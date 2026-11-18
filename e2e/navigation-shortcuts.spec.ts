import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  detailTitle,
  draftTint,
  expectHeader,
  openCalendar,
} from "./helpers";

/**
 * Notion Calendar's Go to date (.), Search events, Create event (C) and the
 * full keyboard shortcut list (?), from their keys and the command menu.
 * They come from CommandMenu's Go to date page, DetailsSidebar's
 * `actionsRef`, the provider's `navigateToDate` and `addEventAtNextSlot`,
 * and useCalendarShortcuts. Now is Thursday, June 4 2026, 8:00 AM.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

function commandMenu(page: Page) {
  return page.getByRole("dialog", { name: "Command Menu" });
}

/** Go to date's field, in the command menu */
function goToDateField(page: Page) {
  return commandMenu(page).getByPlaceholder("e.g. nov 5, in 10 weeks");
}

/** The context panel, inline on the right (wide screens) */
function contextPanel(page: Page) {
  return page.locator('[data-slot="sidebar"][data-side="right"]');
}

/** The context panel's full shortcut list: its find field */
function findShortcutsField(page: Page) {
  return page.getByRole("textbox", { name: "Find keyboard shortcuts" });
}

test(". opens Go to date, which shows the typed day and goes there on Enter", async ({
  page,
}) => {
  await page.keyboard.press(".");
  await expect(goToDateField(page)).toBeFocused();

  // The day it reads, with its weekday, before going there
  await page.keyboard.type("dec 25");
  const result = commandMenu(page).getByRole("option");
  await expect(result).toHaveText("Friday, December 25");

  await page.keyboard.press("Enter");
  await expect(commandMenu(page)).toBeHidden();
  await expectHeader(page, "December 2026 Week 52");
});

test("Go to date reads relative phrases and shows other years", async ({
  page,
}) => {
  await page.keyboard.press(".");
  const field = goToDateField(page);
  const result = commandMenu(page).getByRole("option");

  // Next week's Friday, the week starting on Sunday
  await field.fill("next friday");
  await expect(result).toHaveText("Friday, June 12");
  await field.fill("in 2 weeks");
  await expect(result).toHaveText("Thursday, June 18");
  // A date without a year is the next one: March has passed
  await field.fill("3/1");
  await expect(result).toHaveText("Monday, March 1, 2027");

  // Text that isn't a date lists nothing
  await field.fill("lunch with sarah");
  await expect(result).toHaveCount(0);
  await expect(commandMenu(page).getByText("No results found.")).toBeVisible();

  await field.fill("tomorrow");
  await expect(result).toHaveText("Friday, June 5");
  await page.keyboard.press("Enter");
  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("Escape closes Go to date and changes nothing", async ({ page }) => {
  await page.keyboard.press(".");
  await page.keyboard.type("dec 25");
  await page.keyboard.press("Escape");

  await expect(commandMenu(page)).toBeHidden();
  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("Go to date keeps the current view", async ({ page }) => {
  await page.keyboard.press("d");
  // The demo has week numbers on, and day view names the week too
  await expectHeader(page, "June 2026 Thursday, Jun 4 Week 23");

  await page.keyboard.press(".");
  await page.keyboard.type("aug 10");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Day", exact: true }),
  ).toBeVisible();
  await expectHeader(page, "August 2026 Monday, Aug 10 Week 33");
});

test("Go to date... in the command menu opens the date field, and Backspace leaves it", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");
  const menu = commandMenu(page);
  await expect(menu.getByRole("option", { name: /^Go to date/ })).toContainText(
    ".",
  );

  await menu.getByPlaceholder("Type a command...").fill("go to date");
  await page.keyboard.press("Enter");
  await expect(goToDateField(page)).toBeFocused();
  await expect(goToDateField(page)).toHaveValue("");

  // Backspace in the empty field goes back to the commands
  await page.keyboard.press("Backspace");
  await expect(menu.getByPlaceholder("Type a command...")).toBeFocused();
  await expect(
    menu.getByRole("option", { name: /^Go to today/ }),
  ).toBeVisible();
});

test("Search events opens the context panel's search, focused", async ({
  page,
}) => {
  // Even with an event selected, which the search replaces
  await calendarEvent(page, "Launch Review").click();
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  await page.keyboard.press("ControlOrMeta+k");
  await commandMenu(page).getByPlaceholder("Type a command...").fill("search");
  await commandMenu(page)
    .getByRole("option", { name: "Search events", exact: true })
    .click();

  const search = page.getByPlaceholder("Search events");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("");
  await expect(detailTitle(page)).toHaveCount(0);
});

test("text typed in the command menu searches events for it", async ({
  page,
}) => {
  await page.keyboard.press("/");
  await expect(page.getByText("Useful shortcuts")).not.toBeInViewport();

  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.type("launch");
  const searchFor = commandMenu(page).getByRole("option", {
    name: "Search events for “launch”",
  });
  await expect(searchFor).toBeVisible();
  await searchFor.click();

  // The closed panel opens on the results
  const search = page.getByPlaceholder("Search events");
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("launch");
  await expect(
    contextPanel(page).getByText("Launch Review").first(),
  ).toBeVisible();
});

test("C starts a draft at the next half hour, saved once it is named, and undo removes it", async ({
  page,
}) => {
  await page.keyboard.press("c");

  // A draft drawn as an event from the start, as Notion Calendar's C draws
  // it: untitled, half an hour long, with its title focused
  const draft = calendarEvent(page, "Untitled event");
  await expect(draft).toHaveAccessibleName(
    "Untitled event, 8:00 AM to 8:30 AM, Thursday, June 4",
  );
  await expect(draft).toHaveAttribute("aria-pressed", "true");
  await expect(draftTint(page)).toHaveCount(0);
  await expect(detailTitle(page)).toBeFocused();
  await expect(detailTitle(page)).toHaveValue("");

  // Naming it saves it; then undo the create
  await page.keyboard.type("Quick call");
  await page.keyboard.press("Enter");
  await expect(detailTitle(page)).not.toBeFocused();
  const created = calendarEvent(page, "Quick call");
  await expect(created).toHaveAccessibleName(
    "Quick call, 8:00 AM to 8:30 AM, Thursday, June 4",
  );
  await page.keyboard.press("ControlOrMeta+z");
  await expect(created).toHaveCount(0);
});

test("Escape, twice, throws C's draft away", async ({ page }) => {
  await page.keyboard.press("c");
  const draft = calendarEvent(page, "Untitled event");
  await expect(draft).toBeVisible();
  await expect(detailTitle(page)).toBeFocused();

  // Once to leave the title, once more for the draft
  await page.keyboard.press("Escape");
  await expect(draft).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(draft).toHaveCount(0);
  await expect(detailTitle(page)).toHaveCount(0);
});

test("C in month view starts an all-day draft on today", async ({ page }) => {
  await page.keyboard.press("m");
  await expectHeader(page, "June 2026");
  await page.keyboard.press("c");

  await expect(calendarEvent(page, "Untitled event")).toHaveAccessibleName(
    "Untitled event, all day, Thursday, June 4",
  );
  await expect(detailTitle(page)).toBeFocused();
  await expect(page.getByRole("switch", { name: "All-day" })).toBeChecked();
});

test("Create event... in the command menu starts a draft, title focused", async ({
  page,
}) => {
  // On another week, the event goes on its first day
  await page.keyboard.press("k");
  await expectHeader(page, "June 2026 Week 24");

  await page.keyboard.press("ControlOrMeta+k");
  await commandMenu(page)
    .getByPlaceholder("Type a command...")
    .fill("create event");
  await page.keyboard.press("Enter");

  await expect(calendarEvent(page, "Untitled event")).toHaveAccessibleName(
    "Untitled event, 8:00 AM to 8:30 AM, Sunday, June 7",
  );
  await expect(detailTitle(page)).toBeFocused();
  await page.keyboard.type("Planning");
  await expect(calendarEvent(page, "Planning")).toBeVisible();
});

test("C after Go to date starts the draft on the day gone to", async ({
  page,
}) => {
  await page.keyboard.press(".");
  await page.keyboard.type("jun 17");
  await page.keyboard.press("Enter");
  await expectHeader(page, "June 2026 Week 25");

  await page.keyboard.press("c");
  await expect(calendarEvent(page, "Untitled event")).toHaveAccessibleName(
    "Untitled event, 8:00 AM to 8:30 AM, Wednesday, June 17",
  );
});

test("? shows the full shortcut list, which finds shortcuts by name or key", async ({
  page,
}) => {
  await page.keyboard.press("?");
  const field = findShortcutsField(page);
  await expect(field).toBeFocused();

  const panel = contextPanel(page);
  for (const heading of [
    "General",
    "Workflows",
    "Editing",
    "Calendar view",
    "Calendar navigation",
    "App navigation",
  ]) {
    await expect(panel.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(panel.getByText("Useful shortcuts")).toHaveCount(0);

  // By name
  await field.fill("date");
  await expect(panel.getByText("Go to date", { exact: true })).toBeVisible();
  await expect(panel.getByText("Go to today", { exact: true })).toHaveCount(0);
  // By key
  await field.fill("t");
  await expect(panel.getByText("Go to today", { exact: true })).toBeVisible();
  await field.fill("nothing like this");
  await expect(panel.getByText("No keyboard shortcut found")).toBeVisible();

  // Escape goes back to the useful shortcuts
  await page.keyboard.press("Escape");
  await expect(field).toHaveCount(0);
  await expect(panel.getByText("Useful shortcuts")).toBeVisible();
});

test("Show keyboard shortcuts opens the list, and its button closes it", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");
  const option = commandMenu(page).getByRole("option", {
    name: /^Show keyboard shortcuts/,
  });
  await expect(option).toContainText("?");
  await option.click();

  await expect(findShortcutsField(page)).toBeFocused();
  await page.getByRole("button", { name: "Close keyboard shortcuts" }).click();
  await expect(findShortcutsField(page)).toHaveCount(0);
  await expect(page.getByText("Useful shortcuts")).toBeVisible();
});

test("the useful shortcuts list Go to date and all keyboard shortcuts", async ({
  page,
}) => {
  const row = (label: string) =>
    page.getByText(label, { exact: true }).locator("xpath=..");
  await expect(row("Go to date")).toContainText(".");
  await expect(row("All keyboard shortcuts")).toContainText("?");
  for (const label of ["Go to date", "All keyboard shortcuts"]) {
    await expect(row(label).getByText("Soon")).toHaveCount(0);
  }
});

test(". and ? typed in the title field are text, not shortcuts", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  const title = detailTitle(page);
  await title.click();
  await page.keyboard.press("End");
  await page.keyboard.type(".?c");

  await expect(title).toHaveValue("Launch Review.?c");
  await expect(commandMenu(page)).toHaveCount(0);
  await expect(findShortcutsField(page)).toHaveCount(0);
  await expect(calendarEvent(page, "New event")).toHaveCount(0);
});
