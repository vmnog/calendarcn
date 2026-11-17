import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  FROZEN_NOW,
  answerThisEvent,
  boxOf,
  calendarEvent,
  calendarHeader,
  detailTitle,
  dragBy,
  hourHeight,
  openCalendar,
} from "./helpers";

/**
 * Calendar Toaster in the demo: Notion Calendar's toasts after a delete, a
 * cut or a copy, their Undo, and when they close. In the sample week (May
 * 31 to June 6), "Quick Sync" is on Saturday June 6, 2 to 2:30 PM, "Launch
 * Review" the same day 10 to 11:30 AM, and "Sprint Planning" on Monday
 * June 1, 10 AM to 12 PM, each once.
 */

/** The toaster: a region that is there only while a toast shows */
function toaster(page: Page) {
  return page.getByRole("region", { name: "Notifications" });
}

/** The toast inside the toaster */
function toast(page: Page) {
  return toaster(page).locator('[data-slot="calendar-toast"]');
}

/** The provider's live region, the page's only status element */
function announcement(page: Page) {
  return page.getByRole("status");
}

/**
 * Opens the demo like `openCalendar`, but with the page's timers under the
 * test's control: time starts at FROZEN_NOW and runs, and
 * `page.clock.fastForward()` jumps ahead, firing the timers due.
 */
async function openCalendarWithClock(page: Page): Promise<void> {
  await page.clock.install({ time: FROZEN_NOW });
  await page.goto("/");
  await expect(calendarHeader(page)).toBeVisible();
}

test.describe("the toasts", () => {
  test.beforeEach(async ({ page }) => {
    await openCalendar(page);
  });

  test("deleting an event shows Event deleted with its title, and Undo brings it back", async ({
    page,
  }) => {
    const event = calendarEvent(page, "Launch Review");
    await event.click({ button: "right" });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    // Launch Review repeats: its question's first option, This event
    await answerThisEvent(page, "Delete event");
    await expect(event).toHaveCount(0);

    await expect(toast(page)).toContainText("Event deleted");
    await expect(toast(page)).toContainText("“Launch Review”");
    // The live region speaks; the toast isn't announced a second time
    await expect(announcement(page)).toHaveText("Deleted Launch Review");
    await expect(toaster(page)).not.toHaveAttribute("aria-live");
    await expect(
      toaster(page).locator('[aria-live], [role="status"], [role="alert"]'),
    ).toHaveCount(0);

    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(event).toHaveAccessibleName(
      "Launch Review, 10:00 AM to 11:30 AM, Saturday, June 6",
    );
    await expect(detailTitle(page)).toHaveValue("Launch Review");
    await expect(toaster(page)).toHaveCount(0);
    await expect(announcement(page)).toHaveText("Undid deleting Launch Review");
  });

  test("cutting shows Event cut without the title, and Undo puts the event back", async ({
    page,
  }) => {
    await calendarEvent(page, "Quick Sync").click();
    await page.keyboard.press("ControlOrMeta+x");
    await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);

    await expect(toast(page)).toContainText("Event cut");
    await expect(toast(page)).not.toContainText("Quick Sync");
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(calendarEvent(page, "Quick Sync")).toHaveAccessibleName(
      "Quick Sync, 2:00 PM to 2:30 PM, Saturday, June 6",
    );
    await expect(toaster(page)).toHaveCount(0);
  });

  test("copying shows Event copied to clipboard with the title and no Undo", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("ControlOrMeta+c");

    await expect(toast(page)).toContainText("Event copied to clipboard");
    await expect(toast(page)).toContainText("“Launch Review”");
    await expect(toast(page).getByRole("button", { name: "Undo" })).toHaveCount(
      0,
    );
  });

  test("duplicate and paste show no toast, and a paste closes the cut toast", async ({
    page,
  }) => {
    const quickSyncs = calendarEvent(page, "Quick Sync");
    await quickSyncs.click();
    await page.keyboard.press("ControlOrMeta+d");
    await expect(quickSyncs).toHaveCount(2);
    await expect(toaster(page)).toHaveCount(0);

    // Cut the selected copy, then paste it: undoing the cut now would
    // leave two copies, so its toast goes
    await page.keyboard.press("ControlOrMeta+x");
    await expect(quickSyncs).toHaveCount(1);
    await expect(toast(page)).toContainText("Event cut");
    await page.keyboard.press("ControlOrMeta+v");
    await expect(quickSyncs).toHaveCount(2);
    await expect(toaster(page)).toHaveCount(0);
  });

  test("Cmd+Z closes the toast of the action it undoes, and redo shows none", async ({
    page,
  }) => {
    await calendarEvent(page, "Quick Sync").click();
    await page.keyboard.press("Backspace");
    await expect(toast(page)).toContainText("Event deleted");

    await page.keyboard.press("ControlOrMeta+z");
    await expect(calendarEvent(page, "Quick Sync")).toHaveCount(1);
    await expect(toaster(page)).toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(calendarEvent(page, "Quick Sync")).toHaveCount(0);
    await expect(toaster(page)).toHaveCount(0);
  });

  test("a newer change closes the toast, so its Undo never takes back anything else", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click({ button: "right" });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await answerThisEvent(page, "Delete event");
    await expect(toast(page)).toContainText("Event deleted");

    const sprint = calendarEvent(page, "Sprint Planning");
    await dragBy(page, sprint, {
      dx: 0,
      dy: await hourHeight(page),
      offsetY: 20,
    });
    await expect(sprint).toHaveAccessibleName(
      "Sprint Planning, 11:00 AM to 1:00 PM, Monday, June 1",
    );
    await expect(toaster(page)).toHaveCount(0);

    // Cmd+Z takes back the drag, then the delete; the toast stays closed
    await page.keyboard.press("ControlOrMeta+z");
    await expect(sprint).toHaveAccessibleName(
      "Sprint Planning, 10:00 AM to 12:00 PM, Monday, June 1",
    );
    await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
    await expect(toaster(page)).toHaveCount(0);
    await page.keyboard.press("ControlOrMeta+z");
    await expect(calendarEvent(page, "Launch Review")).toHaveCount(1);
  });

  test("a newer toast replaces the last one", async ({ page }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("Backspace");
    await answerThisEvent(page, "Delete event");
    await calendarEvent(page, "Quick Sync").click();
    await page.keyboard.press("Backspace");

    await expect(toast(page)).toHaveCount(1);
    await expect(toast(page)).toContainText("“Quick Sync”");
    await expect(toast(page)).not.toContainText("Launch Review");
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(calendarEvent(page, "Quick Sync")).toHaveCount(1);
    await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);
  });

  test("the close button dismisses a toast", async ({ page }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("ControlOrMeta+c");
    await toast(page).getByRole("button", { name: "Close" }).click();
    await expect(toaster(page)).toHaveCount(0);
    await expect(calendarEvent(page, "Launch Review")).toHaveCount(1);
  });

  test("the toast sits at the bottom right of the calendar, dark in both themes", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("ControlOrMeta+c");
    // Hovering holds it open while this test measures it
    await toast(page).hover();

    // Over the view, inside <main>, left of the details sidebar
    await expect(
      page.getByRole("main").getByRole("region", { name: "Notifications" }),
    ).toHaveCount(1);
    const main = await boxOf(page.getByRole("main"));
    const box = await boxOf(toast(page));
    const rightGap = main.x + main.width - (box.x + box.width);
    const bottomGap = main.y + main.height - (box.y + box.height);
    expect(rightGap).toBeGreaterThan(12);
    expect(rightGap).toBeLessThan(20);
    expect(bottomGap).toBeGreaterThan(12);
    expect(bottomGap).toBeLessThan(20);

    await expect(toast(page)).toHaveCSS("background-color", "rgb(37, 37, 37)");
    await expect(toast(page)).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(toast(page)).toHaveCSS("background-color", "rgb(37, 37, 37)");
    await expect(toast(page)).toHaveCSS("border-top-color", "rgb(48, 48, 48)");
  });
});

test.describe("timing", () => {
  test("a toast closes by itself about 5 seconds after it shows", async ({
    page,
  }) => {
    await openCalendarWithClock(page);
    await calendarEvent(page, "Quick Sync").click();
    await page.keyboard.press("Backspace");
    await expect(toast(page)).toContainText("Event deleted");

    await page.clock.fastForward(3000);
    await expect(toast(page)).toBeVisible();
    await page.clock.fastForward(3000);
    await expect(toaster(page)).toHaveCount(0);
  });

  test("the pointer on a toast holds it open until it leaves", async ({
    page,
  }) => {
    await openCalendarWithClock(page);
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("ControlOrMeta+c");

    await toast(page).hover();
    await page.clock.fastForward(10_000);
    await expect(toast(page)).toBeVisible();

    // Its full time starts over once the pointer leaves
    await page.mouse.move(10, 10);
    await page.clock.fastForward(6000);
    await expect(toaster(page)).toHaveCount(0);
  });
});
