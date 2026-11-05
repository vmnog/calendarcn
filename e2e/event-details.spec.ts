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

test("picking a type in the details popover keeps it open", async ({
  page,
}) => {
  const popover = page.getByRole("dialog", { name: "Event details" });

  // "/" closes the context panel, so the event opens a popover
  await page.keyboard.press("/");
  await calendarEvent(page, "Architecture Review").click();
  await expect(popover).toBeVisible();

  await popover.getByRole("button", { name: "Event", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Focus time/ }).click();

  // The menu closes, the details stay, showing the new type
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(popover).toBeVisible();
  await expect(
    popover.getByRole("button", { name: "Focus time", exact: true }),
  ).toBeVisible();
});

test("Tab and Shift+Tab loop inside the details popover", async ({ page }) => {
  const popover = page.getByRole("dialog", { name: "Event details" });
  const firstControl = popover.getByRole("button", {
    name: "Event",
    exact: true,
  });

  await page.keyboard.press("/");
  await calendarEvent(page, "Architecture Review").click();
  await expect(popover).toBeVisible();

  // Shift+Tab on the first control wraps to the last one
  await firstControl.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(popover).toBeVisible();
  await expect(firstControl).not.toBeFocused();
  expect(
    await popover.evaluate(
      (details) =>
        details !== document.activeElement &&
        details.contains(document.activeElement),
    ),
  ).toBe(true);

  // Tab on the last control wraps back to the first
  await page.keyboard.press("Tab");
  await expect(firstControl).toBeFocused();
  await expect(popover).toBeVisible();
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
