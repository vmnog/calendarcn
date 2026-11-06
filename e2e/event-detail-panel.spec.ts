import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  calendarEvent,
  detailFields,
  detailTitle,
  openCalendar,
} from "./helpers";

/** Sections of the detail panel in Notion Calendar's order, by `data-section` */
const SECTION_ORDER = [
  "time",
  "all-day",
  "timezone",
  "recurrence",
  "participants",
  "conferencing",
  "ai-notes",
  "location",
  "links",
  "description",
  "calendar",
  "availability",
  "reminders",
];

/** One section of the context panel's event details */
function detailSection(page: Page, name: string): Locator {
  return page.locator(`[data-section="${name}"]`);
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("the detail panel shows every field of an event that sets them all", async ({
  page,
}) => {
  await calendarEvent(page, "Launch Review").click();
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  // Every section, in Notion's order
  const sections = await page
    .locator("[data-section]")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-section")),
    );
  expect(sections).toEqual(SECTION_ORDER);

  await expect(
    page.getByRole("button", { name: "Event", exact: true }),
  ).toBeVisible();

  const fields = detailFields(page);
  await expect(fields.startTime).toHaveValue("10 AM");
  await expect(fields.endTime).toHaveValue("11:30 AM");
  await expect(fields.startDate).toHaveValue("Sat Jun 6");
  await expect(detailSection(page, "time")).toContainText("1h 30min");

  await expect(page.getByRole("switch", { name: "All-day" })).not.toBeChecked();
  await expect(detailSection(page, "timezone")).toHaveText("GMT-3Sao Paulo");
  await expect(detailSection(page, "recurrence")).toContainText(
    "Every 2 weeks on Sat, 6 times",
  );
  await expect(
    page.getByRole("button", { name: "Next in series" }),
  ).toBeVisible();

  const participants = detailSection(page, "participants");
  for (const name of [
    "Alex Rivera",
    "Priya Shah",
    "Sam Lee",
    "jordan@example.com",
    "Room 4B",
  ]) {
    await expect(participants).toContainText(name);
  }
  await expect(detailSection(page, "conferencing")).toHaveText("Google Meet");
  await expect(detailSection(page, "ai-notes")).toHaveText("AI meeting notes");
  await expect(detailSection(page, "location")).toHaveText(
    "Room 4B, 5th floor",
  );
  await expect(detailSection(page, "links")).toContainText("Launch checklist");
  await expect(detailSection(page, "links")).toContainText("release-notes.pdf");
  await expect(detailSection(page, "description")).toHaveText(
    "Walk through the launch checklist, then sign off on the release notes.",
  );
  await expect(detailSection(page, "calendar")).toHaveText("me@vmnog.com");
  await expect(detailSection(page, "availability")).toHaveText("BusyPrivate");
  await expect(detailSection(page, "reminders")).toHaveText(
    "Reminders10min before1hour before",
  );
});

test("the detail panel shows Notion's placeholders for an event without details", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  await expect(detailTitle(page)).toHaveValue("Quick Sync");

  // All-day, time zone and repeat wait behind one muted line
  await expect(detailSection(page, "all-day")).toHaveCount(0);
  await page.getByText("Time zone", { exact: true }).click();
  await expect(page.getByRole("switch", { name: "All-day" })).toBeVisible();
  await expect(detailSection(page, "timezone")).toBeVisible();
  await expect(detailSection(page, "recurrence")).toHaveText("Repeat");

  for (const [name, placeholder] of [
    ["participants", "Participants and Rooms"],
    ["conferencing", "Conferencing"],
    ["ai-notes", "Add AI meeting notes"],
    ["location", "Location"],
    ["links", "Add links and attachments"],
    ["description", "Description"],
    ["calendar", "Calendar"],
    ["availability", "BusyDefault visibility"],
    ["reminders", "Reminders"],
  ]) {
    await expect(detailSection(page, name)).toHaveText(placeholder);
  }
});
