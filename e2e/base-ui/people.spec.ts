import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, calendarEvent } from "../helpers";

/**
 * The details' participants, conferencing and location in a shadcn/ui
 * project set up with Base UI (e2e/base-ui/fixture): its dropdown menus and
 * avatars, inside the details popover. The fixture's `<Calendar>` passes no
 * contacts, rooms or places, so only typed values are offered.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/");
  await expect(calendarEvent(page, "Design Review")).toBeVisible();
  await calendarEvent(page, "Design Review").click();
  await expect(eventDetails(page).getByPlaceholder("Title")).toHaveValue(
    "Design Review",
  );
});

/** The details popover */
function eventDetails(page: Page): Locator {
  return page.getByRole("dialog", { name: "Event details" });
}

test("a typed email is invited, with an avatar, and removed from its menu", async ({
  page,
}) => {
  const details = eventDetails(page);

  await details
    .getByRole("combobox", { name: "Participants and Rooms" })
    .fill("guest@example.com");
  await page.getByRole("option", { name: "guest@example.com" }).click();

  const row = details.locator('[data-participant="guest@example.com"]');
  await expect(row).toContainText("guest@example.com");
  await expect(row.locator('[data-slot="avatar"]')).toHaveText("G");

  await row.hover();
  await row
    .getByRole("button", { name: "More actions for guest@example.com" })
    .click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
  await expect(details).toBeVisible();
});

test("conferencing: Escape closes the menu first, then a pick adds the call", async ({
  page,
}) => {
  const details = eventDetails(page);
  const trigger = details.getByRole("button", {
    name: "Conferencing",
    exact: true,
  });

  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Zoom" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(details).toBeVisible();

  await trigger.click();
  await menu.getByRole("menuitem", { name: "Zoom" }).click();
  await expect(
    details.getByRole("link", { name: "Join Zoom" }),
  ).toHaveAttribute("href", /^https:\/\/zoom\.us\/j\/\d{10}$/);

  // The copy and menu buttons show on hover
  await details.getByRole("link", { name: "Join Zoom" }).hover();
  await details.getByRole("button", { name: "Change conferencing" }).click();
  await menu.getByRole("menuitem", { name: "No conferencing" }).click();
  await expect(trigger).toBeVisible();
});

test("location: the typed text is kept", async ({ page }) => {
  const details = eventDetails(page);
  const field = details.getByRole("combobox", { name: "Location" });

  await field.fill("Room 12");
  await expect(page.getByRole("option", { name: "Room 12" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(details.getByRole("link", { name: "Room 12" })).toBeVisible();
  await expect(details).toBeVisible();
});
