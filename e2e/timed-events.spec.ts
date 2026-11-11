import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  columnDistance,
  detailFields,
  detailTitle,
  dragBy,
  hourHeight,
  openCalendar,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("dragging an event moves it to another day and time", async ({ page }) => {
  // Sprint Planning: Monday Jun 1, 10 AM - 12 PM
  const event = calendarEvent(page, "Sprint Planning");
  await expect(event).toHaveAccessibleName(
    "Sprint Planning, 10:00 AM to 12:00 PM, Monday, June 1",
  );

  // Two columns right (Wednesday Jun 3) and one hour down
  await dragBy(page, event, {
    dx: await columnDistance(page, 1, 3),
    dy: await hourHeight(page),
    offsetY: 20,
  });

  await expect(event).toHaveAccessibleName(
    "Sprint Planning, 11:00 AM to 1:00 PM, Wednesday, June 3",
  );
  const fields = detailFields(page);
  await expect(detailTitle(page)).toHaveValue("Sprint Planning");
  await expect(fields.startTime).toHaveValue("11 AM");
  await expect(fields.endTime).toHaveValue("1 PM");
  await expect(fields.startDate).toHaveValue("Wed Jun 3");

  // It now sits in Wednesday's column, under the "3" day header
  const wednesday = await boxOf(
    page.getByRole("main").getByText("3", { exact: true }),
  );
  const moved = await boxOf(event);
  expect(moved.x).toBeLessThan(wednesday.x + wednesday.width);
  expect(moved.x + moved.width).toBeGreaterThan(wednesday.x);
});

test("dragging the bottom edge resizes an event", async ({ page }) => {
  const event = calendarEvent(page, "Sprint Planning");
  const box = await boxOf(event);

  // Press just above the bottom edge (inside the resize hot zone)
  await dragBy(page, event, {
    dx: 0,
    dy: await hourHeight(page),
    offsetY: box.height - 2,
  });

  await expect(event).toHaveAccessibleName(
    "Sprint Planning, 10:00 AM to 1:00 PM, Monday, June 1",
  );
  const fields = detailFields(page);
  await expect(detailTitle(page)).toHaveValue("Sprint Planning");
  await expect(fields.startTime).toHaveValue("10 AM");
  await expect(fields.endTime).toHaveValue("1 PM");
  await expect(fields.startDate).toHaveValue("Mon Jun 1");
});

test("scrolling an event into view keeps it under its day header", async ({
  page,
}) => {
  // Architecture Review: Thursday Jun 4, right of the visible days' center.
  // Centering it, as automation tools do before a click, must not scroll the
  // grid's buffer wrapper out of line with the headers.
  const event = calendarEvent(page, "Architecture Review");
  await expect(event).toHaveAccessibleName(/, Thursday, June 4$/);
  await event.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "center" }),
  );

  const thursday = await boxOf(
    page.getByRole("main").getByText("4", { exact: true }),
  );
  const box = await boxOf(event);
  expect(box.x).toBeLessThan(thursday.x + thursday.width);
  expect(box.x + box.width).toBeGreaterThan(thursday.x);
});

test.describe("an event that ends at midnight", () => {
  /** Sprint Planning's block in Monday's column of the hour grid */
  const inMondayColumn = (page: Page) =>
    page
      .getByRole("group", { name: "Monday, June 1" })
      .locator('[data-event-id="may21"]');

  // Sprint Planning (Monday Jun 1, 10 AM - 12 PM) gets an end at the midnight
  // that starts Tuesday, typed in the details panel
  test.beforeEach(async ({ page }) => {
    await calendarEvent(page, "Sprint Planning").click();
    const { endTime } = detailFields(page);
    await endTime.click();
    await endTime.fill("12a");
    await endTime.press("Enter");
    await detailTitle(page).click();
    await expect(endTime).toHaveValue("12 AM");
  });

  test("stays in the hour grid on its own day", async ({ page }) => {
    await expect(inMondayColumn(page)).toHaveCount(1);
    await expect(calendarEvent(page, "Sprint Planning")).toHaveAccessibleName(
      "Sprint Planning, 10:00 AM to 12:00 AM, Monday, June 1",
    );
  });

  test("keeps its length when dragged earlier", async ({ page }) => {
    const event = calendarEvent(page, "Sprint Planning");
    await dragBy(page, event, {
      dx: 0,
      dy: -(await hourHeight(page)),
      offsetY: 20,
    });

    await expect(event).toHaveAccessibleName(
      "Sprint Planning, 9:00 AM to 11:00 PM, Monday, June 1",
    );
  });

  test("shows the new start while its top edge is dragged", async ({
    page,
  }) => {
    const event = calendarEvent(page, "Sprint Planning");
    const box = await boxOf(event);
    const x = box.x + box.width / 2;
    const hour = await hourHeight(page);

    // Press just below the top edge (inside the resize hot zone)
    await page.mouse.move(x, box.y + 2);
    await page.mouse.down();
    await page.mouse.move(x, box.y + 2 + hour, { steps: 12 });
    // The faded original and the live preview, both in Monday's column
    await expect(
      page
        .getByRole("group", { name: "Monday, June 1" })
        .getByText("Sprint Planning", { exact: true }),
    ).toHaveCount(2);
    await page.mouse.up();

    await expect(inMondayColumn(page)).toHaveCount(1);
    await expect(event).toHaveAccessibleName(
      "Sprint Planning, 11:00 AM to 12:00 AM, Monday, June 1",
    );
  });
});
