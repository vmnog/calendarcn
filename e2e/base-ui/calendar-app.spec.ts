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
