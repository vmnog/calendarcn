import { expect, test } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  detailFields,
  detailTitle,
  draftTint,
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

test("a long press on an empty slot starts a draft and opens it in the sheet", async ({
  page,
}) => {
  const main = page.getByRole("main");
  // Today's column, at 3 PM, where Thursday has nothing
  const column = main.getByRole("group", { name: "Thursday, June 4" });
  const columnBox = await boxOf(column);
  const hour = await boxOf(main.getByText("3 PM", { exact: true }));
  const touch = {
    pointerType: "touch",
    pointerId: 7,
    isPrimary: true,
    button: 0,
    clientX: columnBox.x + columnBox.width / 2,
    clientY: hour.y + hour.height / 2 + 2,
  };

  await column.dispatchEvent("pointerdown", touch);
  await expect(draftTint(page)).toHaveCount(1);
  await page.evaluate((init) => {
    window.dispatchEvent(new PointerEvent("pointerup", init));
  }, touch);

  // The sheet opens on the draft, untitled, its title focused
  const sheet = page.getByRole("dialog", { name: "Context panel" });
  await expect(sheet).toBeVisible();
  const title = sheet.getByPlaceholder("Title");
  await expect(title).toHaveValue("");
  await expect(title).toBeFocused();
  await expect(detailFields(page).startTime).toHaveValue("3 PM");
  await expect(detailFields(page).endTime).toHaveValue("3:30 PM");

  // Naming it saves it: it is still there once the sheet is closed
  await page.keyboard.type("Pick up keys");
  await page.keyboard.press("Enter");
  await expect(title).toHaveValue("Pick up keys");
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(calendarEvent(page, "Pick up keys")).toHaveAccessibleName(
    "Pick up keys, 3:00 PM to 3:30 PM, Thursday, June 4",
  );
});
