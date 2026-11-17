import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  answerThisEvent,
  boxOf,
  calendarEvent,
  detailFields,
  detailTitle,
  dragBy,
  hourHeight,
  monthCell,
  openCalendar,
} from "./helpers";

/**
 * Deleting, duplicating, cutting, copying and pasting events, and undoing
 * and redoing changes: the right-click menu, the details' "..." menu and
 * the event keys of useCalendarShortcuts. In the sample week (May 31 to
 * June 6), "Quick Sync" is on Saturday June 6, 2 to 2:30 PM, "Launch
 * Review" the same day 10 to 11:30 AM, and "Sprint Planning" on Monday
 * June 1, 10 AM to 12 PM, each once.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** The provider's live region, the page's only status element */
function announcement(page: Page) {
  return page.getByRole("status");
}

/** Each action and the keys both menus show beside it */
const ACTION_KEYS = [
  ["Cut", "⌘X"],
  ["Copy", "⌘C"],
  ["Duplicate", "⌘D"],
  ["Delete", "delete"],
] as const;

test("both event menus offer cut, copy, duplicate and delete with their keys", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click({ button: "right" });
  for (const [action, keys] of ACTION_KEYS) {
    const item = page.getByRole("button", { name: action, exact: true });
    await expect(item).toBeEnabled();
    await expect(item).toContainText(keys);
  }
  await page.keyboard.press("Escape");

  await calendarEvent(page, "Quick Sync").click();
  await page.getByRole("button", { name: "More actions" }).click();
  const menu = page.getByRole("menu");
  for (const [action, keys] of ACTION_KEYS) {
    const item = menu.getByRole("menuitem", { name: action, exact: true });
    await expect(item).toBeEnabled();
    await expect(item).toContainText(keys);
  }
});

test("Delete in the right-click menu removes the event, and Cmd+Z brings it back", async ({
  page,
}) => {
  const event = calendarEvent(page, "Launch Review");
  await event.click({ button: "right" });
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  // Launch Review repeats: its question's first option, This event
  await answerThisEvent(page, "Delete event");
  await expect(event).toHaveCount(0);
  await expect(announcement(page)).toHaveText("Deleted Launch Review");

  await page.keyboard.press("ControlOrMeta+z");
  await expect(event).toHaveAccessibleName(
    "Launch Review, 10:00 AM to 11:30 AM, Saturday, June 6",
  );
  await expect(announcement(page)).toHaveText("Undid deleting Launch Review");
  // Undo selects the event it brought back
  await expect(detailTitle(page)).toHaveValue("Launch Review");
});

test("Backspace and Delete remove the selected event and close its details", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  await expect(detailTitle(page)).toHaveValue("Quick Sync");
  await page.keyboard.press("Backspace");
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);
  await expect(page.getByText("Useful shortcuts")).toBeVisible();

  await calendarEvent(page, "Launch Review").click();
  await page.keyboard.press("Delete");
  await answerThisEvent(page, "Delete event");
  await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
});

test("with nothing to act on, the event keys are left to the browser", async ({
  page,
}) => {
  // Nothing selected, nothing copied, nothing to undo or redo
  const prevented = await page.evaluate(() =>
    [
      { key: "Delete" },
      { key: "Backspace" },
      { key: "d", metaKey: true },
      { key: "c", metaKey: true },
      { key: "x", metaKey: true },
      { key: "v", metaKey: true },
      { key: "z", metaKey: true },
      { key: "z", metaKey: true, shiftKey: true },
    ].map((init) => {
      const event = new KeyboardEvent("keydown", {
        ...init,
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );

  expect(prevented).toEqual(new Array(8).fill(false));
});

test("the details' menu duplicates an event at the same time and selects the copy", async ({
  page,
}) => {
  const copies = calendarEvent(
    page,
    "Quick Sync, 2:00 PM to 2:30 PM, Saturday, June 6",
  );
  await calendarEvent(page, "Quick Sync").click();
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Duplicate", exact: true }).click();

  await expect(copies).toHaveCount(2);
  await expect(detailTitle(page)).toHaveValue("Quick Sync");
  await expect(announcement(page)).toHaveText(
    "Duplicated Quick Sync, 2:00 PM to 2:30 PM, Saturday, June 6",
  );

  // Cmd+D duplicates the selected copy; Cmd+Z takes that one away
  await page.keyboard.press("ControlOrMeta+d");
  await expect(copies).toHaveCount(3);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(copies).toHaveCount(2);
});

test("cut, then paste with the mouse over a slot, moves the event there", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  await page.keyboard.press("ControlOrMeta+x");
  await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);

  // Friday June 5 at 10 AM: the column's top edge is midnight
  const friday = page
    .getByRole("main")
    .getByRole("group", { name: "Friday, June 5", exact: true });
  const column = await boxOf(friday);
  await page.mouse.move(
    column.x + column.width / 2,
    column.y + 10 * (await hourHeight(page)) + 4,
  );
  await page.keyboard.press("ControlOrMeta+v");

  const pasted = calendarEvent(page, "Quick Sync");
  await expect(pasted).toHaveAccessibleName(
    "Quick Sync, 10:00 AM to 10:30 AM, Friday, June 5",
  );
  await expect(detailTitle(page)).toHaveValue("Quick Sync");

  // Undo the paste, then the cut; redo the cut
  await page.keyboard.press("ControlOrMeta+z");
  await expect(pasted).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(pasted).toHaveAccessibleName(
    "Quick Sync, 2:00 PM to 2:30 PM, Saturday, June 6",
  );
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(pasted).toHaveCount(0);
});

test("in month view, a paste lands on the day under the mouse at the event's time", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  await page.keyboard.press("ControlOrMeta+c");
  await expect(announcement(page)).toHaveText("Copied Launch Review");

  await page.keyboard.press("m");
  await monthCell(page, "2026-06-10").hover();
  await page.keyboard.press("ControlOrMeta+v");

  await expect(announcement(page)).toHaveText(
    "Pasted Launch Review, 10:00 AM to 11:30 AM, Wednesday, June 10",
  );
  await expect(detailTitle(page)).toHaveValue("Launch Review");
  await expect(detailFields(page).startDate).toHaveValue("Wed Jun 10");
  await expect(detailFields(page).startTime).toHaveValue("10 AM");
});

test("Cmd+Z and Shift+Cmd+Z undo and redo a drag", async ({ page }) => {
  const event = calendarEvent(page, "Sprint Planning");
  await dragBy(page, event, {
    dx: 0,
    dy: await hourHeight(page),
    offsetY: 20,
  });
  await expect(event).toHaveAccessibleName(
    "Sprint Planning, 11:00 AM to 1:00 PM, Monday, June 1",
  );

  await page.keyboard.press("ControlOrMeta+z");
  await expect(event).toHaveAccessibleName(
    "Sprint Planning, 10:00 AM to 12:00 PM, Monday, June 1",
  );
  await expect(announcement(page)).toHaveText("Undid editing Sprint Planning");

  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(event).toHaveAccessibleName(
    "Sprint Planning, 11:00 AM to 1:00 PM, Monday, June 1",
  );
});

test("a title typed letter by letter is undone in one step", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  const title = detailTitle(page);
  await title.click();
  await title.press("ControlOrMeta+a");
  await title.pressSequentially("Zebra");
  await title.press("Enter");
  await expect(calendarEvent(page, "Zebra")).toBeVisible();

  await page.keyboard.press("ControlOrMeta+z");
  await expect(title).toHaveValue("Quick Sync");
  await expect(calendarEvent(page, "Quick Sync")).toBeVisible();
});
