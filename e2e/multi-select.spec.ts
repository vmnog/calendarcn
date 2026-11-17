import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  detailTitle,
  dragBy,
  hourHeight,
  openCalendar,
} from "./helpers";

/**
 * Selecting several events, as in Notion Calendar: Shift- or Cmd-click adds
 * an event (and takes a selected one out), "Select all visible" (Cmd+A)
 * selects every event on screen, and delete, cut, copy, paste and duplicate
 * act on them together, each as one undo step with Notion's toasts. In the
 * sample week (May 31 to June 6), "Launch Review" is on Saturday June 6, 10
 * to 11:30 AM, "Quick Sync" the same day 2 to 2:30 PM, and "Sprint
 * Planning" on Monday June 1, 10 AM to 12 PM, each once.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** The events drawn selected on screen */
function selectedEvents(page: Page): Locator {
  return page.getByRole("main").locator('[data-event-id][aria-pressed="true"]');
}

/** The toast inside the toaster */
function toast(page: Page): Locator {
  return page
    .getByRole("region", { name: "Notifications" })
    .locator('[data-slot="calendar-toast"]');
}

/** The provider's live region, the page's only status element */
function announcement(page: Page): Locator {
  return page.getByRole("status");
}

/** Selects Launch Review, then adds Quick Sync with Shift-click */
async function selectTwo(page: Page): Promise<void> {
  await calendarEvent(page, "Launch Review").click();
  await calendarEvent(page, "Quick Sync").click({ modifiers: ["Shift"] });
  await expect(selectedEvents(page)).toHaveCount(2);
}

/** Puts the mouse over a day's column at a time of day (in hours) */
async function hoverSlot(page: Page, fullDate: string, hour: number) {
  const column = await boxOf(
    page.getByRole("main").getByRole("group", { name: fullDate, exact: true }),
  );
  await page.mouse.move(
    column.x + column.width / 2,
    column.y + hour * (await hourHeight(page)) + 4,
  );
}

test("Shift- and Cmd-click add events, and Shift-click takes one out", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  await expect(selectedEvents(page)).toHaveCount(1);
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  await calendarEvent(page, "Quick Sync").click({ modifiers: ["Shift"] });
  await calendarEvent(page, "Sprint Planning").click({
    modifiers: ["ControlOrMeta"],
  });
  await expect(selectedEvents(page)).toHaveCount(3);
  for (const title of ["Launch Review", "Quick Sync", "Sprint Planning"]) {
    await expect(calendarEvent(page, title)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  // Several selected events show no details, as in Notion Calendar
  await expect(detailTitle(page)).toHaveCount(0);
  await expect(page.getByText("Useful shortcuts")).toBeVisible();

  await calendarEvent(page, "Quick Sync").click({ modifiers: ["Shift"] });
  await expect(selectedEvents(page)).toHaveCount(2);
  await expect(calendarEvent(page, "Quick Sync")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // Down to one, its details are back
  await calendarEvent(page, "Sprint Planning").click({ modifiers: ["Shift"] });
  await expect(selectedEvents(page)).toHaveCount(1);
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  // A plain click selects that event alone
  await calendarEvent(page, "Quick Sync").click({ modifiers: ["Shift"] });
  await calendarEvent(page, "Sprint Planning").click();
  await expect(selectedEvents(page)).toHaveCount(1);
  await expect(detailTitle(page)).toHaveValue("Sprint Planning");
});

test("Escape and a click on empty grid clear the selection", async ({
  page,
}) => {
  await selectTwo(page);
  await page.keyboard.press("Escape");
  await expect(selectedEvents(page)).toHaveCount(0);

  await selectTwo(page);
  const before = await page
    .getByRole("main")
    .locator("[data-event-id]")
    .count();
  const column = await boxOf(
    page
      .getByRole("main")
      .getByRole("group", { name: "Friday, June 5", exact: true }),
  );
  await page.mouse.click(
    column.x + column.width / 2,
    column.y + 21 * (await hourHeight(page)),
  );
  await expect(selectedEvents(page)).toHaveCount(0);
  // The click only cleared the selection: no event was created
  await expect(page.getByRole("main").locator("[data-event-id]")).toHaveCount(
    before,
  );
  await expect(detailTitle(page)).toHaveCount(0);
});

test("Select all visible selects every event on screen, with Cmd+A and the command", async ({
  page,
}) => {
  const onScreen = page
    .getByRole("main")
    .locator("[data-event-id]:not([inert] *)");
  await page.keyboard.press("ControlOrMeta+a");
  const count = await selectedEvents(page).count();
  expect(count).toBeGreaterThan(10);
  await expect(calendarEvent(page, "Launch Review")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Only this week's: none of the scroll buffer's weeks
  await expect(
    page.getByRole("main").locator('[inert] [aria-pressed="true"]'),
  ).toHaveCount(0);
  expect(count).toBeLessThanOrEqual(await onScreen.count());

  await page.keyboard.press("Escape");
  await expect(selectedEvents(page)).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  const command = menu.getByRole("option", { name: /^Select all visible/ });
  await expect(command).toBeEnabled();
  await expect(command).not.toContainText("Soon");
  await command.click();
  await expect(menu).toHaveCount(0);
  await expect(selectedEvents(page)).toHaveCount(count);
});

test("Cmd+A typed in a field selects its text, not the events", async ({
  page,
}) => {
  const search = page.getByPlaceholder("Search events");
  await search.fill("review");
  await search.press("ControlOrMeta+a");
  await expect(selectedEvents(page)).toHaveCount(0);
  expect(
    await search.evaluate(
      (input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!,
    ),
  ).toBe(6);
});

test("Delete removes them all as one step, and Undo brings them back selected", async ({
  page,
}) => {
  await selectTwo(page);
  await page.keyboard.press("Delete");

  await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);
  await expect(toast(page)).toContainText("2 events deleted");
  await expect(announcement(page)).toHaveText("Deleted 2 events");

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(calendarEvent(page, "Launch Review")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(calendarEvent(page, "Quick Sync")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(toast(page)).toHaveCount(0);

  // Redo deletes both again, and Cmd+Z brings both back
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(calendarEvent(page, "Launch Review")).toHaveCount(1);
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(1);
});

test("the right-click menu acts on every selected event", async ({ page }) => {
  await selectTwo(page);
  await calendarEvent(page, "Quick Sync").click({ button: "right" });
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);
  await expect(toast(page)).toContainText("2 events deleted");
});

test("cut and paste move them together, keeping their distance", async ({
  page,
}) => {
  await selectTwo(page);
  await page.keyboard.press("ControlOrMeta+x");
  await expect(toast(page)).toContainText("2 events cut");
  await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);

  // The earliest goes to Friday at 9 AM, the other 4 hours after it
  await hoverSlot(page, "Friday, June 5", 9);
  await page.keyboard.press("ControlOrMeta+v");
  await expect(calendarEvent(page, "Launch Review")).toHaveAccessibleName(
    "Launch Review, 9:00 AM to 10:30 AM, Friday, June 5",
  );
  await expect(calendarEvent(page, "Quick Sync")).toHaveAccessibleName(
    "Quick Sync, 1:00 PM to 1:30 PM, Friday, June 5",
  );
  await expect(selectedEvents(page)).toHaveCount(2);
  await expect(announcement(page)).toHaveText("Pasted 2 events");

  // One undo takes the paste back
  await page.keyboard.press("ControlOrMeta+z");
  await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);
});

test("copy shows Notion's toast, and duplicate adds a copy of each", async ({
  page,
}) => {
  await selectTwo(page);
  await page.keyboard.press("ControlOrMeta+c");
  await expect(toast(page)).toContainText("2 events copied to clipboard");
  await expect(toast(page).getByRole("button", { name: "Undo" })).toHaveCount(
    0,
  );

  await page.keyboard.press("ControlOrMeta+d");
  await expect(calendarEvent(page, "Launch Review")).toHaveCount(2);
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(2);
  // The copies are the selection now
  await expect(selectedEvents(page)).toHaveCount(2);
  await expect(announcement(page)).toHaveText("Duplicated 2 events");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(calendarEvent(page, "Launch Review")).toHaveCount(1);
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(1);
});

test("in month view, Shift-click selects several too", async ({ page }) => {
  await page.keyboard.press("m");
  // Launch Review repeats every other week: pick June 6's
  const main = page.getByRole("main");
  await main
    .getByRole("button", {
      name: "Launch Review, 10:00 AM to 11:30 AM, Saturday, June 6",
      exact: true,
    })
    .click();
  await main
    .getByRole("button", {
      name: "Quick Sync, 2:00 PM to 2:30 PM, Saturday, June 6",
      exact: true,
    })
    .click({ modifiers: ["Shift"] });
  await expect(selectedEvents(page)).toHaveCount(2);
  await page.keyboard.press("Delete");
  await expect(toast(page)).toContainText("2 events deleted");
});

test("dragging one of several selected events moves them all, as one step", async ({
  page,
}) => {
  await selectTwo(page);
  // A drag from the middle of Launch Review, an hour down
  await dragBy(page, calendarEvent(page, "Launch Review"), {
    dx: 0,
    dy: await hourHeight(page),
  });

  await expect(calendarEvent(page, "Launch Review")).toHaveAccessibleName(
    "Launch Review, 11:00 AM to 12:30 PM, Saturday, June 6",
  );
  await expect(calendarEvent(page, "Quick Sync")).toHaveAccessibleName(
    "Quick Sync, 3:00 PM to 3:30 PM, Saturday, June 6",
  );
  await expect(selectedEvents(page)).toHaveCount(2);
  await expect(announcement(page)).toHaveText("Moved 2 events");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(calendarEvent(page, "Launch Review")).toHaveAccessibleName(
    "Launch Review, 10:00 AM to 11:30 AM, Saturday, June 6",
  );
  await expect(calendarEvent(page, "Quick Sync")).toHaveAccessibleName(
    "Quick Sync, 2:00 PM to 2:30 PM, Saturday, June 6",
  );
});

test("Alt+Down moves every selected event; Alt+Shift+Down resizes one", async ({
  page,
}) => {
  await selectTwo(page);
  await calendarEvent(page, "Quick Sync").focus();
  await page.keyboard.press("Alt+ArrowDown");

  await expect(calendarEvent(page, "Quick Sync")).toHaveAccessibleName(
    "Quick Sync, 2:15 PM to 2:45 PM, Saturday, June 6",
  );
  await expect(calendarEvent(page, "Launch Review")).toHaveAccessibleName(
    "Launch Review, 10:15 AM to 11:45 AM, Saturday, June 6",
  );

  // Undo moves both back, and keeps both selected
  await page.keyboard.press("ControlOrMeta+z");
  await expect(calendarEvent(page, "Quick Sync")).toHaveAccessibleName(
    "Quick Sync, 2:00 PM to 2:30 PM, Saturday, June 6",
  );
  await expect(selectedEvents(page)).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(selectedEvents(page)).toHaveCount(2);

  // A resize changes the focused event alone
  await calendarEvent(page, "Quick Sync").focus();
  await page.keyboard.press("Alt+Shift+ArrowDown");
  await expect(calendarEvent(page, "Quick Sync")).toHaveAccessibleName(
    "Quick Sync, 2:15 PM to 3:00 PM, Saturday, June 6",
  );
  await expect(calendarEvent(page, "Launch Review")).toHaveAccessibleName(
    "Launch Review, 10:15 AM to 11:45 AM, Saturday, June 6",
  );
});

test("a plain click on one of several selected events selects it alone", async ({
  page,
}) => {
  await selectTwo(page);
  await calendarEvent(page, "Quick Sync").click();
  await expect(selectedEvents(page)).toHaveCount(1);
  await expect(detailTitle(page)).toHaveValue("Quick Sync");
});
