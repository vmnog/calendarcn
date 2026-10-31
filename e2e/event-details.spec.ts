import { expect, test } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  detailFields,
  detailTitle,
  expectHeader,
  openCalendar,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("clicking an event shows it in the context panel, Escape deselects", async ({
  page,
}) => {
  await calendarEvent(page, "Architecture Review").click();

  // Wide screens keep the context panel open, so no popover
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(detailTitle(page)).toHaveValue("Architecture Review");
  const fields = detailFields(page);
  await expect(fields.startTime).toHaveValue("10 AM");
  await expect(fields.endTime).toHaveValue("11:30 AM");
  await expect(fields.startDate).toHaveValue("Thu Jun 4");

  await page.keyboard.press("Escape");
  await expect(detailTitle(page)).toHaveCount(0);
  await expect(page.getByText("Useful shortcuts")).toBeVisible();
});

test("with the context panel closed, an event opens a popover that closes and docks", async ({
  page,
}) => {
  const event = calendarEvent(page, "Architecture Review");
  const popover = page.getByRole("dialog");

  // "/" closes the context panel
  await page.keyboard.press("/");
  await expect(
    page.getByRole("button", { name: "Toggle Navigation Sidebar" }),
  ).toBeVisible();

  // Open, then close with the close button
  await event.click();
  await expect(popover).toBeVisible();
  await expect(popover.getByPlaceholder("Title")).toHaveValue(
    "Architecture Review",
  );
  await popover.getByRole("button", { name: "Close" }).click();
  await expect(popover).toHaveCount(0);

  // Open, then close with Escape
  await event.click();
  await expect(popover).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popover).toHaveCount(0);

  // Open, then expand into the context panel
  await event.click();
  await expect(popover).toBeVisible();
  await popover.getByRole("button", { name: "Dock to sidebar" }).click();
  await expect(popover).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Toggle Navigation Sidebar" }),
  ).toHaveCount(0);
  await expect(detailTitle(page)).toHaveValue("Architecture Review");
  await expect(detailFields(page).endTime).toHaveValue("11:30 AM");
});

test("Cmd+K opens the command menu without changing the week", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");

  const menu = page.getByRole("dialog", { name: "Command Menu" });
  const input = menu.getByPlaceholder("Type a command...");
  await expect(menu).toBeVisible();
  await expect(input).toBeFocused();

  // A shortcut letter typed in the menu goes to its search, not navigation
  await page.keyboard.type("k");
  await expect(input).toHaveValue("k");

  // The modal hides the calendar from the accessibility tree, so check the
  // week once it closes
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expectHeader(page, CURRENT_WEEK_LABEL);
});
