import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  calendarEvent,
  detailTitle,
  dragBy,
  hourHeight,
  monthCell,
  openCalendar,
} from "./helpers";

/**
 * The questions a change to a repeating event's date asks, as in Notion
 * Calendar (plans/notion-reference-2026-11-16.md). Each test first makes
 * "Design Critique" (Tuesday June 2, 2 to 3:30 PM) repeat every day: Tuesday
 * is its first date, and it has a date on every day after it.
 */

/** The series' time, and a date dragged an hour later */
const AT_TWO = "2:00 PM to 3:30 PM";
const AT_THREE = "3:00 PM to 4:30 PM";
/** The week's dates from the series' first */
const DAYS = [
  "Tuesday, June 2",
  "Wednesday, June 3",
  "Thursday, June 4",
  "Friday, June 5",
  "Saturday, June 6",
];

/** One section of the context panel's event details */
function detailSection(page: Page, name: string): Locator {
  return page.locator(`[data-section="${name}"]`);
}

/** A date's block, by day ("Thursday, June 4"), time and title */
function occurrence(
  page: Page,
  day: string,
  time = AT_TWO,
  title = "Design Critique",
): Locator {
  return page
    .getByRole("main")
    .getByRole("button", { name: new RegExp(`^${title}, ${time}, ${day}`) });
}

/** The edit question, or the delete question */
function question(page: Page, kind: "Edit" | "Delete" = "Edit"): Locator {
  return page.getByRole("dialog", {
    name: new RegExp(`^${kind} repeat event`),
  });
}

/** Opens the selected event's repeat menu */
async function openRepeatMenu(page: Page): Promise<Locator> {
  await expect(page.getByRole("menu")).toHaveCount(0);
  await detailSection(page, "recurrence")
    .getByRole("button", { name: /^Repeat:/ })
    .click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

/** Drags Thursday's date an hour later */
async function dragThursdayLater(page: Page): Promise<void> {
  await dragBy(page, occurrence(page, "Thursday, June 4"), {
    dx: 0,
    dy: await hourHeight(page),
  });
}

/** Picks an option in the open question and presses its main button */
async function answer(
  page: Page,
  option: string,
  button = "Save event",
): Promise<void> {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: option }).click();
  await dialog.getByRole("button", { name: button }).click();
  await expect(dialog).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
  await calendarEvent(page, "Design Critique").click();
  await expect(detailTitle(page)).toHaveValue("Design Critique");
  await page.getByText("Time zone", { exact: true }).click();
  const menu = await openRepeatMenu(page);
  await menu.getByRole("menuitem", { name: "Every day" }).click();
  // Not repeating yet when changed, so nothing asks
  await expect(question(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(occurrence(page, "Saturday, June 6")).toBeVisible();
});

test("dragging a date asks Notion's edit question, and This event moves only it", async ({
  page,
}) => {
  await dragThursdayLater(page);
  const dialog = question(page);
  await expect(dialog).toHaveAccessibleName(
    "Edit repeat event “Design Critique”",
  );
  await expect(dialog.getByRole("radio")).toHaveText([
    "This event",
    "This and following events",
    "All events",
  ]);
  await expect(dialog.getByRole("radio", { name: "This event" })).toBeChecked();
  await expect(dialog.getByText("Time", { exact: true })).toBeVisible();
  await expect(dialog.getByText("3–4:30 PM")).toBeVisible();
  await expect(dialog.getByText("2–3:30 PM")).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(dialog.getByRole("button")).toHaveText([
    "Discard change",
    "Continue editing",
    "Save event",
  ]);
  // While it asks, the date shows where it was dropped. The modal question
  // hides the calendar from role queries, so find it by its label
  await expect(
    page.locator(
      `[aria-label^="Design Critique, ${AT_THREE}, Thursday, June 4"]`,
    ),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Save event" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Event updated", { exact: true })).toBeVisible();
  await expect(occurrence(page, "Thursday, June 4", AT_THREE)).toBeVisible();
  await expect(occurrence(page, "Wednesday, June 3")).toBeVisible();
  await expect(occurrence(page, "Friday, June 5")).toBeVisible();
});

test("the first date offers only This event and All events", async ({
  page,
}) => {
  await dragBy(page, occurrence(page, "Tuesday, June 2"), {
    dx: 0,
    dy: await hourHeight(page),
  });
  await expect(question(page).getByRole("radio")).toHaveText([
    "This event",
    "All events",
  ]);
  await answer(page, "This event");
  await expect(occurrence(page, "Tuesday, June 2", AT_THREE)).toBeVisible();
  await expect(occurrence(page, "Wednesday, June 3")).toBeVisible();
});

test("This and following events moves the dragged date and the ones after it", async ({
  page,
}) => {
  await dragThursdayLater(page);
  await answer(page, "This and following events");
  await expect(occurrence(page, "Tuesday, June 2")).toBeVisible();
  await expect(occurrence(page, "Wednesday, June 3")).toBeVisible();
  for (const day of DAYS.slice(2)) {
    await expect(occurrence(page, day, AT_THREE)).toBeVisible();
  }
});

test("All events moves every date", async ({ page }) => {
  await dragThursdayLater(page);
  await answer(page, "All events");
  for (const day of DAYS) {
    await expect(occurrence(page, day, AT_THREE)).toBeVisible();
  }
});

test("Discard change puts a dragged date back", async ({ page }) => {
  await dragThursdayLater(page);
  await question(page).getByRole("button", { name: "Discard change" }).click();
  await expect(question(page)).toHaveCount(0);
  await expect(occurrence(page, "Thursday, June 4")).toBeVisible();
  await expect(occurrence(page, "Thursday, June 4", AT_THREE)).toHaveCount(0);
});

test("Escape continues editing: the change waits with its dot until the event is left", async ({
  page,
}) => {
  await dragThursdayLater(page);
  await page.keyboard.press("Escape");
  await expect(question(page)).toHaveCount(0);
  const moved = occurrence(page, "Thursday, June 4", AT_THREE);
  await expect(moved).toContainText("●");
  // The date is selected, its details open
  await expect(detailTitle(page)).toHaveValue("Design Critique");

  // Leaving it asks again
  await page.keyboard.press("Escape");
  await question(page).getByRole("button", { name: "Discard change" }).click();
  await expect(occurrence(page, "Thursday, June 4")).toBeVisible();
  await expect(occurrence(page, "Thursday, June 4")).not.toContainText("●");
});

test("details changes wait and ask once, with a summary, when the event is left", async ({
  page,
}) => {
  await occurrence(page, "Friday, June 5").click();
  await detailTitle(page).fill("Design Sync");
  await detailTitle(page).press("Enter");
  // Shown at once on that date, marked, and nothing asks yet
  await expect(question(page)).toHaveCount(0);
  const friday = occurrence(page, "Friday, June 5", AT_TWO, "Design Sync");
  await expect(friday).toContainText("●");
  await expect(occurrence(page, "Thursday, June 4")).toBeVisible();

  await page.keyboard.press("Escape");
  const dialog = question(page);
  await expect(dialog.getByText("Title", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Design Sync")).toBeVisible();
  await answer(page, "All events");
  for (const day of DAYS) {
    await expect(occurrence(page, day, AT_TWO, "Design Sync")).toBeVisible();
  }
});

test("Shift-clicking another event while a change waits asks first, then selects both", async ({
  page,
}) => {
  await occurrence(page, "Friday, June 5").click();
  await detailTitle(page).fill("Design Sync");
  await detailTitle(page).press("Enter");
  const friday = occurrence(page, "Friday, June 5", AT_TWO, "Design Sync");
  await expect(friday).toContainText("●");

  // Adding an event to the selection leaves the waiting date: it asks first
  await calendarEvent(page, "Quick Sync").click({ modifiers: ["Shift"] });
  await answer(page, "This event");
  await expect(friday).not.toContainText("●");
  await expect(occurrence(page, "Thursday, June 4")).toBeVisible();
  await expect(
    page.getByRole("main").locator('[data-event-id][aria-pressed="true"]'),
  ).toHaveCount(2);
});

test("a repeat rule change in the details offers only the following or all events", async ({
  page,
}) => {
  await occurrence(page, "Thursday, June 4").click();
  const menu = await openRepeatMenu(page);
  await menu.getByRole("menuitem", { name: "Every weekday" }).click();
  await expect(question(page)).toHaveCount(0);
  // The closing menu would take this Escape itself
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(question(page).getByRole("radio")).toHaveText([
    "This and following events",
    "All events",
  ]);
  await answer(page, "This and following events");
  // From Thursday on, weekdays only: Saturday's date goes
  await expect(occurrence(page, "Saturday, June 6")).toHaveCount(0);
  await expect(occurrence(page, "Wednesday, June 3")).toBeVisible();
  await expect(occurrence(page, "Friday, June 5")).toBeVisible();
});

test("deleting a date asks Notion's delete question, and This event removes only it", async ({
  page,
}) => {
  await occurrence(page, "Thursday, June 4").click({ button: "right" });
  await page.getByRole("button", { name: /^Delete/ }).click();
  const dialog = question(page, "Delete");
  await expect(dialog).toHaveAccessibleName(
    "Delete repeat event “Design Critique”",
  );
  await expect(dialog.getByRole("radio", { name: "This event" })).toBeChecked();
  await expect(dialog.getByRole("button")).toHaveText([
    "Cancel",
    "Delete event",
  ]);
  await dialog.getByRole("button", { name: "Delete event" }).click();
  await expect(page.getByText("Event deleted", { exact: true })).toBeVisible();
  await expect(
    page.getByText("“Design Critique”", { exact: true }),
  ).toBeVisible();
  await expect(occurrence(page, "Thursday, June 4")).toHaveCount(0);
  await expect(occurrence(page, "Wednesday, June 3")).toBeVisible();
  await expect(occurrence(page, "Friday, June 5")).toBeVisible();
});

test("deleting All events from the first date removes the series", async ({
  page,
}) => {
  await occurrence(page, "Tuesday, June 2").click({ button: "right" });
  await page.getByRole("button", { name: /^Delete/ }).click();
  await expect(question(page, "Delete").getByRole("radio")).toHaveText([
    "This event",
    "All events",
  ]);
  await answer(page, "All events", "Delete event");
  await expect(
    page.getByText("All events deleted", { exact: true }),
  ).toBeVisible();
  for (const day of DAYS) {
    await expect(occurrence(page, day)).toHaveCount(0);
  }
});

test("one undo takes back an All events answer", async ({ page }) => {
  await dragThursdayLater(page);
  await answer(page, "All events");
  await expect(occurrence(page, "Tuesday, June 2", AT_THREE)).toBeVisible();

  await page.keyboard.press("ControlOrMeta+z");
  for (const day of DAYS) {
    await expect(occurrence(page, day)).toBeVisible();
  }
  await expect(occurrence(page, "Tuesday, June 2", AT_THREE)).toHaveCount(0);
});

test("month view asks too", async ({ page }) => {
  await page.keyboard.press("m");
  // Sunday: few other events, so the date isn't behind "+N more"
  const from = monthCell(page, "2026-06-07");
  const to = monthCell(page, "2026-06-14");
  const chip = from.getByRole("button", { name: /^Design Critique/ });
  const fromBox = await from.boundingBox();
  const toBox = await to.boundingBox();
  if (!fromBox || !toBox) throw new Error("month cells are not rendered");
  await dragBy(page, chip, { dx: 0, dy: toBox.y - fromBox.y });
  await question(page).getByRole("button", { name: "Discard change" }).click();
  await expect(chip).toBeVisible();
});

test("while travelling, a date's change is saved at the time the zone's clock shows", async ({
  page,
}) => {
  // Measured before travelling: then two columns label each hour
  const hour = await hourHeight(page);
  // Tokyo is 13 hours ahead of New York: Thursday's 2 PM date is Friday
  // 3 AM there, and Wednesday's is Thursday 3 AM
  await page.keyboard.press("z");
  await page.keyboard.type("Tokyo");
  await page
    .getByRole("option", { name: "(GMT+09:00) Japan Standard Time – Tokyo" })
    .click();
  const friday = occurrence(page, "Friday, June 5", "3:00 AM to 4:30 AM");
  await friday.scrollIntoViewIfNeeded();
  await dragBy(page, friday, { dx: 0, dy: hour });

  // The question reads the times on Tokyo's clock
  await expect(question(page).getByText("4–5:30 AM")).toBeVisible();
  await answer(page, "This event");
  await expect(
    occurrence(page, "Friday, June 5", "4:00 AM to 5:30 AM"),
  ).toBeVisible();
  await expect(
    occurrence(page, "Thursday, June 4", "3:00 AM to 4:30 AM"),
  ).toBeVisible();

  // Back home, the date moved by the same hour and the others stayed
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(occurrence(page, "Thursday, June 4", AT_THREE)).toBeVisible();
  await expect(occurrence(page, "Wednesday, June 3")).toBeVisible();
  await expect(occurrence(page, "Friday, June 5")).toBeVisible();
});
