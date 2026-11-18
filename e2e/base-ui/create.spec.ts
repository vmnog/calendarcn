import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, calendarEvent, draftTint, slotPoint } from "../helpers";

/**
 * Creating events in a shadcn/ui project set up with Base UI. /create
 * renders an empty `<Calendar />` in the week of May 31 2026, lists the
 * titles `onEventCreate` reports above it, and has a "Start draft" button
 * that calls `startEventDraft` for Friday, June 5, 9 to 9:30 AM. The details
 * open in a popover there.
 */

/** The titles `onEventCreate` has reported, in order */
function createdEvents(page: Page): Locator {
  return page.getByLabel("Created events");
}

/** The details popover of the selected event */
function eventDetails(page: Page): Locator {
  return page.getByRole("dialog", { name: "Event details" });
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/create");
  await expect(page.getByRole("button", { name: "Start draft" })).toBeVisible();
});

test("a double-clicked slot is a draft until it is named, then reported once", async ({
  page,
}) => {
  const slot = await slotPoint(page, 5, "2 PM");
  await page.mouse.dblclick(slot.x, slot.y);

  // A tinted range with its details open and the title focused
  await expect(draftTint(page)).toHaveCount(1);
  const details = eventDetails(page);
  const title = details.getByPlaceholder("Title");
  await expect(title).toBeFocused();
  await expect(details.getByTestId("event-start-time")).toHaveValue("2 PM");
  await expect(details.getByTestId("event-end-time")).toHaveValue("2:30 PM");

  // Typing turns it into an event block and reports nothing yet
  await page.keyboard.type("Planning");
  await expect(draftTint(page)).toHaveCount(0);
  await expect(calendarEvent(page, "Planning")).toBeVisible();
  await expect(title).toBeFocused();
  await expect(createdEvents(page)).toHaveText("");

  // Enter saves it: reported once, with the title it was given, and the
  // details stay open
  await page.keyboard.press("Enter");
  await expect(createdEvents(page)).toHaveText("Planning");
  await expect(details).toBeVisible();

  // Later edits change the stored event: nothing new is reported
  await title.fill("Planning (moved)");
  await title.press("Enter");
  await expect(calendarEvent(page, "Planning (moved)")).toBeVisible();
  await expect(createdEvents(page)).toHaveText("Planning");
});

test("a draft that is thrown away is never reported", async ({ page }) => {
  const slot = await slotPoint(page, 5, "2 PM");
  await page.mouse.dblclick(slot.x, slot.y);
  const details = eventDetails(page);
  await expect(details.getByPlaceholder("Title")).toBeFocused();

  // Escape leaves the title, then closes the details and drops the draft
  await page.keyboard.press("Escape");
  await expect(details).toBeVisible();
  await expect(draftTint(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await expect(draftTint(page)).toHaveCount(0);
  await expect(createdEvents(page)).toHaveText("");
});

test("the first edit of another field saves the draft and keeps its details open", async ({
  page,
}) => {
  const slot = await slotPoint(page, 5, "2 PM");
  await page.mouse.dblclick(slot.x, slot.y);
  const details = eventDetails(page);
  const title = details.getByPlaceholder("Title");
  await expect(title).toBeFocused();

  // A description is saved when its box is left. Until then nothing is
  // stored
  await details.getByText("Description", { exact: true }).click();
  await page.keyboard.type("Bring the roadmap");
  await expect(createdEvents(page)).toHaveText("");

  // Leaving it stores the draft, untitled, and the popover stays as it is:
  // the press on the title lands and focuses it
  await title.click();
  await expect(createdEvents(page)).toHaveText("(untitled)");
  await expect(details).toBeVisible();
  await expect(title).toBeFocused();
  await expect(details.getByText("Bring the roadmap")).toBeVisible();
  await expect(draftTint(page)).toHaveCount(0);
});

test("startEventDraft starts a draft drawn as an event, saved by its first edit", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Start draft" }).click();

  // An event block from the start, as Notion Calendar's C key draws it,
  // with its details open and the title focused
  const draft = calendarEvent(page, "Untitled event");
  await expect(draft).toHaveAccessibleName(
    "Untitled event, 9:00 AM to 9:30 AM, Friday, June 5",
  );
  await expect(draft).toHaveAttribute("aria-pressed", "true");
  await expect(draftTint(page)).toHaveCount(0);
  const details = eventDetails(page);
  await expect(details.getByPlaceholder("Title")).toBeFocused();
  await expect(createdEvents(page)).toHaveText("");

  // Untouched, it is thrown away like any draft
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(draft).toHaveCount(0);
  await expect(createdEvents(page)).toHaveText("");

  // Named, it is saved
  await page.getByRole("button", { name: "Start draft" }).click();
  await expect(details.getByPlaceholder("Title")).toBeFocused();
  await page.keyboard.type("Sync");
  await page.keyboard.press("Enter");
  await expect(createdEvents(page)).toHaveText("Sync");
  await expect(calendarEvent(page, "Sync")).toBeVisible();
});
