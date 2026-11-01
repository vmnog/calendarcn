import { expect, test } from "@playwright/test";

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
