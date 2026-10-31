import { expect, test } from "@playwright/test";

import {
  calendarEvent,
  detailFields,
  detailTitle,
  openCalendar,
} from "./helpers";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("tapping an event opens the details sheet", async ({ page }) => {
  const sheet = page.getByRole("dialog", { name: "Context panel" });
  await expect(sheet).toHaveCount(0);

  await calendarEvent(page, "Architecture Review").tap();

  await expect(sheet).toBeVisible();
  await expect(sheet.getByPlaceholder("Title")).toHaveValue(
    "Architecture Review",
  );
  await expect(detailTitle(page)).toHaveCount(1);
  await expect(detailFields(page).startTime).toHaveValue("10 AM");
  await expect(detailFields(page).endTime).toHaveValue("11:30 AM");
});
