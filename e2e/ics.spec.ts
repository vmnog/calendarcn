import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import type { DetailedCalendarEvent } from "../src/components/calendar-types";
import { parseIcs } from "../src/lib/ics";
import { createSampleEvents } from "../src/lib/sample-events";
import { FROZEN_NOW, calendarEvent, openCalendar } from "./helpers";

/** Folder with the .ics files the parser is checked against */
const FIXTURES_DIR = path.join(__dirname, "fixtures");

/** Docs page that shows the import / export example */
const IMPORT_EXPORT_PAGE = "/docs/import-export";

function fixturePath(name: string): string {
  return path.join(FIXTURES_DIR, name);
}

function readFixture(name: string): string {
  return readFileSync(fixturePath(name), "utf8");
}

function findEvent(
  events: DetailedCalendarEvent[],
  id: string,
): DetailedCalendarEvent {
  const event = events.find((item) => item.id === id);
  if (!event) throw new Error(`No event with id ${id}`);
  return event;
}

test.describe("import and export example", () => {
  /** The live preview on the docs page */
  function preview(page: Page): Locator {
    return page.locator('[data-example="ics-demo"]');
  }

  /** An event block in the preview's visible week, by title */
  function previewEvent(page: Page, title: string): Locator {
    return preview(page)
      .getByRole("button", { name: new RegExp(`^${escapeRegExp(title)}, `) })
      .and(page.locator("[data-event-id]"));
  }

  /**
   * The example's status line. The provider has its own (empty) status
   * region for drag announcements, so pick the paragraph.
   */
  function importStatus(page: Page): Locator {
    return preview(page).locator('p[role="status"]');
  }

  async function openExample(page: Page): Promise<void> {
    await page.clock.setFixedTime(FROZEN_NOW);
    await page.goto(IMPORT_EXPORT_PAGE);
    await expect(previewEvent(page, "Design review")).toBeVisible();
  }

  test("imports a file picked with Import .ics", async ({ page }) => {
    await openExample(page);

    await preview(page)
      .getByLabel("Import .ics file")
      .setInputFiles(fixturePath("google.ics"));

    await expect(importStatus(page)).toHaveText(
      "Imported 5 events from google.ics.",
    );
    for (const title of [
      "Team sync (moved)",
      "Product review",
      "Company offsite",
      "Design conference",
    ]) {
      await expect(previewEvent(page, title)).toBeInViewport();
    }
    // Imported next to the events the calendar already had
    await expect(previewEvent(page, "Design review")).toBeVisible();
  });

  test("imports a file dropped on the calendar", async ({ page }) => {
    await openExample(page);
    // The drop event carries the fixture as a File, like a drag from Finder
    const dataTransfer = await page.evaluateHandle((text) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([text], "outlook.ics", { type: "text/calendar" }),
      );
      return transfer;
    }, readFixture("outlook.ics"));

    await preview(page)
      .locator("[data-event-id]")
      .first()
      .dispatchEvent("dragenter", { dataTransfer });
    const dropZone = preview(page).getByTestId("ics-drop-zone");
    await expect(dropZone).toHaveText("Drop the .ics file to import it");
    await dropZone.dispatchEvent("drop", { dataTransfer });

    await expect(dropZone).toBeHidden();
    await expect(importStatus(page)).toHaveText(
      "Imported 4 events from outlook.ics.",
    );
    // 9 AM Pacific is noon in the test's New York time zone
    const planning = previewEvent(page, "Quarterly planning");
    await expect(planning).toBeInViewport();
    await expect(planning).toHaveAccessibleName(/12:00 PM to 2:00 PM/);
    await expect(previewEvent(page, "Out of office")).toBeInViewport();
  });

  test("exports the calendar's events", async ({ page }) => {
    await openExample(page);
    await preview(page)
      .getByLabel("Import .ics file")
      .setInputFiles(fixturePath("apple.ics"));
    await expect(importStatus(page)).toHaveText(
      "Imported 3 events from apple.ics.",
    );

    const downloadPromise = page.waitForEvent("download");
    await preview(page).getByRole("button", { name: "Export .ics" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("calendar.ics");
    const exported = parseIcs(readFileSync(await download.path(), "utf8"));

    // The sample events plus the imported ones, which survive the round trip
    const sampleEvents = createSampleEvents(FROZEN_NOW);
    expect(exported).toHaveLength(sampleEvents.length + 3);
    expect(exported.map((event) => event.id)).toEqual(
      expect.arrayContaining(sampleEvents.map((event) => event.id)),
    );
    for (const imported of parseIcs(readFixture("apple.ics"))) {
      expect(findEvent(exported, imported.id)).toEqual(imported);
    }
  });
});

test.describe("demo command menu", () => {
  test("imports and exports .ics files", async ({ page }) => {
    await openCalendar(page);
    const menu = page.getByRole("dialog", { name: "Command Menu" });

    await page.keyboard.press("ControlOrMeta+k");
    const fileChooserPromise = page.waitForEvent("filechooser");
    await menu.getByRole("option", { name: "Import .ics file..." }).click();
    await (await fileChooserPromise).setFiles(fixturePath("google.ics"));
    await expect(menu).toBeHidden();
    // The week of the file's first event, June 1, is the current week
    await expect(calendarEvent(page, "Product review")).toBeInViewport();
    await expect(calendarEvent(page, "Design conference")).toBeInViewport();

    await page.keyboard.press("ControlOrMeta+k");
    const downloadPromise = page.waitForEvent("download");
    await menu.getByRole("option", { name: "Export .ics file" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("calendarcn.ics");
    const exported = parseIcs(readFileSync(await download.path(), "utf8"));
    for (const imported of parseIcs(readFixture("google.ics"))) {
      expect(findEvent(exported, imported.id)).toEqual(imported);
    }
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
