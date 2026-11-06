import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, calendarEvent } from "../helpers";

/**
 * The details' participants, conferencing and location in a shadcn/ui
 * project set up with Base UI (e2e/base-ui/fixture): its dropdown menus and
 * avatars, inside the details popover. The fixture's `<Calendar>` passes no
 * contacts, rooms or places, so only typed values are offered, and two
 * made-up conferencing services of one kind, the second answering after a
 * wait. `/read-only` shows the panel without `onEventChange`.
 */

/** Opens Design Review's details */
async function openDesignReview(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/");
  await expect(calendarEvent(page, "Design Review")).toBeVisible();
  await calendarEvent(page, "Design Review").click();
  await expect(eventDetails(page).getByPlaceholder("Title")).toHaveValue(
    "Design Review",
  );
}

/** The details popover */
function eventDetails(page: Page): Locator {
  return page.getByRole("dialog", { name: "Event details" });
}

test("a typed email is invited, with an avatar, and removed from its menu", async ({
  page,
}) => {
  await openDesignReview(page);
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

test("conferencing: Escape closes the menu, and two options of one service switch", async ({
  page,
}) => {
  await openDesignReview(page);
  const details = eventDetails(page);
  const trigger = details.getByRole("button", {
    name: "Conferencing",
    exact: true,
  });

  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Video call",
    "Backup call",
  ]);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(details).toBeVisible();

  await trigger.click();
  await menu.getByRole("menuitem", { name: "Video call" }).click();
  const videoCall = details.getByRole("link", { name: "Join Video call" });
  await expect(videoCall).toHaveAttribute(
    "href",
    "https://example.com/call/abc-defg-hij",
  );

  // Same `provider`, told apart by label; this one answers after a wait
  await videoCall.hover();
  await details.getByRole("button", { name: "Change conferencing" }).click();
  await menu.getByRole("menuitem", { name: "Backup call" }).click();
  const backupCall = details.getByRole("link", { name: "Join Backup call" });
  await expect(backupCall).toHaveAttribute(
    "href",
    "https://example.com/backup/klm-nopq-rst",
  );

  await backupCall.hover();
  await details.getByRole("button", { name: "Change conferencing" }).click();
  await menu.getByRole("menuitem", { name: "No conferencing" }).click();
  await expect(trigger).toBeVisible();
});

test("location: the typed text is kept", async ({ page }) => {
  await openDesignReview(page);
  const details = eventDetails(page);
  const field = details.getByRole("combobox", { name: "Location" });

  await field.fill("Room 12");
  await expect(page.getByRole("option", { name: "Room 12" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(details.getByRole("link", { name: "Room 12" })).toBeVisible();
  await expect(details).toBeVisible();
});

test("read-only: the guests, call and place show, and nothing edits", async ({
  page,
}) => {
  await page.goto("/read-only");
  const panel = page.locator('[data-group="who"]');
  await expect(panel.locator("[data-participant]")).toHaveCount(2);
  await expect(panel.locator('[data-room="room@example.com"]')).toBeVisible();

  // No field, so no contact list, and no row menus or remove buttons
  await expect(panel.getByRole("combobox")).toHaveCount(0);
  await panel.locator('[data-participant="guest@example.com"]').hover();
  await expect(
    panel.getByRole("button", { name: /^More actions/ }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Copy guest@example.com" }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Remove Room 1" }),
  ).toHaveCount(0);

  // The call joins, but can't be changed; the place opens, but can't be edited
  const join = panel.getByRole("link", { name: "Join Video call" });
  await join.hover();
  await expect(panel.getByRole("button", { name: "Copy link" })).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Change conferencing" }),
  ).toHaveCount(0);
  await panel.getByRole("link", { name: "Central Park" }).hover();
  await expect(
    panel.getByRole("button", { name: "Edit location" }),
  ).toHaveCount(0);
});
