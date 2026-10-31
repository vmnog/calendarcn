import { expect, test } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  detailFields,
  detailTitle,
  hourHeight,
  openCalendar,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("clicking an empty slot creates, selects and names a new event", async ({
  page,
}) => {
  const main = page.getByRole("main");
  // Friday Jun 5 is free at 2 PM; click a few minutes past the hour line
  const friday = await boxOf(main.getByText("5", { exact: true }));
  const twoPm = await boxOf(main.getByText("2 PM", { exact: true }));
  await page.mouse.click(
    friday.x + friday.width / 2,
    twoPm.y + twoPm.height / 2 + (await hourHeight(page)) / 6,
  );

  const created = calendarEvent(page, "New event");
  await expect(created).toHaveAccessibleName(
    "New event, 2:00 PM to 3:00 PM, Friday, June 5",
  );

  // Selected: the detail panel shows it, with the title focused and selected
  const title = detailTitle(page);
  await expect(title).toHaveValue("New event");
  await expect(title).toBeFocused();
  const fields = detailFields(page);
  await expect(fields.startTime).toHaveValue("2 PM");
  await expect(fields.endTime).toHaveValue("3 PM");
  await expect(fields.startDate).toHaveValue("Fri Jun 5");

  // Typing replaces the selected title and updates the calendar live
  await page.keyboard.type("Quarterly review");
  await expect(title).toHaveValue("Quarterly review");
  await expect(title).toBeFocused();
  await expect(calendarEvent(page, "Quarterly review")).toHaveAccessibleName(
    "Quarterly review, 2:00 PM to 3:00 PM, Friday, June 5",
  );
  await expect(calendarEvent(page, "New event")).toHaveCount(0);
});
