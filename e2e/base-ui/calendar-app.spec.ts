import path from "node:path";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  FROZEN_NOW,
  calendarEvent,
  detailTitle,
} from "../helpers";

/**
 * `@calendarcn/calendar-app` installed in a shadcn/ui project set up with
 * Base UI (e2e/base-ui/fixture). `/calendar-app` renders the block with the
 * sample data it brings, as its docs page does: the live demo, in a stock
 * Base UI project.
 */

/** .ics files the demo's import is tested with */
const FIXTURES_DIR = path.join(__dirname, "..", "fixtures");

/** Opens `/calendar-app` on the frozen test date */
async function openCalendarApp(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/calendar-app");
  await expect(title(page)).toBeVisible();
}

function title(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 1 });
}

test.describe("wide screens", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await openCalendarApp(page);
  });

  test("lays out both sidebars around the header and the week", async ({
    page,
  }) => {
    await expect(title(page)).toHaveAccessibleName(CURRENT_WEEK_LABEL);
    await expect(page.locator('[data-slot="mini-calendar"]')).toBeVisible();
    await expect(page.getByText("Useful shortcuts")).toBeVisible();
    await expect(calendarEvent(page, "Launch Review")).toBeVisible();

    // Selecting an event shows its details in the inline details sidebar
    await calendarEvent(page, "Launch Review").click();
    await expect(detailTitle(page)).toHaveValue("Launch Review");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the app keys toggle the sidebars and open the command menu", async ({
    page,
  }) => {
    const miniCalendar = page.locator('[data-slot="mini-calendar"]');
    // A closed inline sidebar slides out of the viewport
    await page.keyboard.press("Meta+/");
    await expect(miniCalendar).not.toBeInViewport();
    await page.keyboard.press("Meta+/");
    await expect(miniCalendar).toBeInViewport();
    const shortcuts = page.getByText("Useful shortcuts");
    await page.keyboard.press("/");
    await expect(shortcuts).not.toBeInViewport();
    await page.keyboard.press("/");
    await expect(shortcuts).toBeInViewport();

    const menu = page.getByRole("dialog", { name: "Command Menu" });
    await page.keyboard.press("ControlOrMeta+k");
    await expect(menu).toBeVisible();
    // The demo lists Notion Calendar's commands that aren't built yet
    await expect(menu.getByText("Soon").first()).toBeVisible();
    await menu.getByRole("option", { name: /^Display month view/ }).click();
    await expect(menu).toBeHidden();
    await expect(title(page)).toHaveAccessibleName("June 2026");

    await page.keyboard.press("Shift+M");
    await expect(page.locator("html")).toHaveClass(/\blight\b/);
  });

  test("meets with people from the sidebar, F and P", async ({ page }) => {
    // The sidebar's field: Priya's events show and the free time you share
    const field = page.getByRole("combobox", { name: "Meet with" });
    await field.click();
    await page.keyboard.type("pri");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Meeting participants")).toBeVisible();
    await expect(
      page.locator('[data-person-event][title^="Priya Shah: Lunch,"]').first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByRole("group", { name: "Thursday, June 4", exact: true })
        .getByRole("note", { name: "Everyone free, 1:30–3 PM" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // F opens the people picker, a Base UI dialog here
    await page.keyboard.press("f");
    const meetWith = page.getByRole("dialog", { name: "Meet with..." });
    await expect(meetWith).toBeVisible();
    await page.keyboard.type("sam");
    await page.keyboard.press("Enter");
    await expect(meetWith).toBeHidden();
    await expect(
      page.locator('[data-person-row="sam@example.com"]'),
    ).toBeVisible();

    // P shows a teammate's calendar
    await page.keyboard.press("p");
    const teammate = page.getByRole("dialog", {
      name: "Show teammate calendar...",
    });
    await expect(teammate).toBeVisible();
    await teammate.getByRole("option", { name: /Morgan Diaz/ }).click();
    await expect(page.getByText("Team calendars")).toBeVisible();
    await expect(
      page
        .locator('[data-person-event][title^="Morgan Diaz: Conference talk,"]')
        .first(),
    ).toBeVisible();

    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByText("Meeting participants")).toHaveCount(0);
    await expect(page.getByRole("main").getByRole("note")).toHaveCount(0);
  });

  test("Go to date, Search events, Create event and the shortcut list work from their keys and commands", async ({
    page,
  }) => {
    const menu = page.getByRole("dialog", { name: "Command Menu" });

    // . opens Go to date; Enter shows the typed day in the current view
    await page.keyboard.press(".");
    const dateField = menu.getByPlaceholder("e.g. nov 5, in 10 weeks");
    await expect(dateField).toBeFocused();
    await page.keyboard.type("dec 25");
    await expect(menu.getByRole("option")).toHaveText("Friday, December 25");
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(title(page)).toHaveAccessibleName("December 2026 Week 52");

    // ? shows the full list in the context panel, its find field focused
    await page.keyboard.press("?");
    const findField = page.getByRole("textbox", {
      name: "Find keyboard shortcuts",
    });
    await expect(findField).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Calendar navigation" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(findField).toHaveCount(0);

    // Search events keeps the focus it gives the search after the menu closes
    await page.keyboard.press("ControlOrMeta+k");
    await menu.getByPlaceholder("Type a command...").fill("launch");
    await menu
      .getByRole("option", { name: "Search events for “launch”" })
      .click();
    const search = page.getByPlaceholder("Search events");
    await expect(search).toBeFocused();
    await expect(search).toHaveValue("launch");

    // Create event... focuses the new event's title
    await page.keyboard.press("ControlOrMeta+k");
    await menu.getByPlaceholder("Type a command...").fill("create event");
    await page.keyboard.press("Enter");
    await expect(detailTitle(page)).toBeFocused();
    await expect(detailTitle(page)).toHaveValue("New event");
  });

  test("imports and exports .ics files from the command menu", async ({
    page,
  }) => {
    const menu = page.getByRole("dialog", { name: "Command Menu" });

    await page.keyboard.press("ControlOrMeta+k");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await menu.getByRole("option", { name: "Import .ics file..." }).click();
    await (
      await fileChooserPromise
    ).setFiles(path.join(FIXTURES_DIR, "google.ics"));
    await expect(menu).toBeHidden();
    await expect(calendarEvent(page, "Product review")).toBeInViewport();

    await page.keyboard.press("ControlOrMeta+k");
    const downloadPromise = page.waitForEvent("download");
    await menu.getByRole("option", { name: "Export .ics file" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("calendar.ics");
  });

  test("deleting an event shows a toast whose Undo brings it back", async ({
    page,
  }) => {
    await calendarEvent(page, "Launch Review").click();
    await page.keyboard.press("Backspace");
    await expect(calendarEvent(page, "Launch Review")).toHaveCount(0);

    const toaster = page.getByRole("region", { name: "Notifications" });
    await expect(toaster).toContainText("Event deleted");
    await expect(toaster).toContainText("“Launch Review”");
    await toaster.getByRole("button", { name: "Undo" }).click();
    await expect(calendarEvent(page, "Launch Review")).toBeVisible();
    await expect(toaster).toHaveCount(0);
  });
});

test.describe("phones", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await openCalendarApp(page);
  });

  test("tapping an event opens the details sheet", async ({ page }) => {
    const detailsSheet = page.getByRole("dialog", { name: "Context panel" });
    await expect(detailsSheet).toHaveCount(0);
    await calendarEvent(page, "Architecture Review").tap();
    await expect(detailsSheet).toBeVisible();
    await expect(detailsSheet.getByPlaceholder("Title")).toHaveValue(
      "Architecture Review",
    );
  });

  test("the calendar sidebar opens as a sheet", async ({ page }) => {
    await page.getByRole("button", { name: "Toggle Calendar Sidebar" }).tap();
    await expect(
      page.getByRole("dialog", { name: "Calendar sidebar" }),
    ).toBeVisible();
  });
});
