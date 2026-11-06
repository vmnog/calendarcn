import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { calendarEvent, detailTitle, openCalendar } from "./helpers";

/**
 * The details' "who and where" sections: participants and rooms,
 * conferencing, AI meeting notes and location. "Quick Sync" (Saturday,
 * June 6) has none of them set; "Launch Review" (the same Saturday) has all
 * of them. The demo passes made-up contacts, rooms and places to
 * CalendarProvider.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** The "who and where" group of the context panel */
function whoGroup(page: Page): Locator {
  return page.locator('[data-group="who"]');
}

/** Selects an event so the context panel shows it */
async function selectEvent(page: Page, title: string): Promise<Locator> {
  await calendarEvent(page, title).click();
  await expect(detailTitle(page)).toHaveValue(title);
  return whoGroup(page);
}

test("participants: recent contacts on focus, a match on Enter, removing it", async ({
  page,
}) => {
  const who = await selectEvent(page, "Quick Sync");
  const field = who.getByRole("combobox", { name: "Participants and Rooms" });

  await field.click();
  const list = page.getByRole("listbox", { name: "Suggested participants" });
  await expect(list.getByRole("option")).toHaveCount(5);
  await expect(list.getByRole("option").first()).toContainText("Priya Shah");

  // Typing activates the first match
  await field.fill("tay");
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(
    list.getByRole("option", { name: /Taylor Kim/ }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");

  const row = who.locator('[data-participant="taylor@example.com"]');
  await expect(row).toContainText("Taylor Kim");
  await expect(
    who.getByRole("combobox", { name: "Add participant or room" }),
  ).toBeVisible();

  await row.hover();
  await row
    .getByRole("button", { name: "More actions for Taylor Kim" })
    .click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
  await expect(
    who.getByRole("combobox", { name: "Participants and Rooms" }),
  ).toBeVisible();
});

test("participants: Escape closes the list without adding anyone", async ({
  page,
}) => {
  const who = await selectEvent(page, "Quick Sync");
  const field = who.getByRole("combobox", { name: "Participants and Rooms" });

  await field.fill("pri");
  await expect(page.getByRole("option", { name: /Priya Shah/ })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(who.locator("[data-participant]")).toHaveCount(0);
  // The event stays selected
  await expect(detailTitle(page)).toHaveValue("Quick Sync");
});

test("participants: a typed email is invited, and rooms come from their list", async ({
  page,
}) => {
  const who = await selectEvent(page, "Quick Sync");
  const field = who.getByRole("combobox", { name: "Participants and Rooms" });

  await field.fill("new.person@example.com");
  await page.getByRole("option", { name: "new.person@example.com" }).click();
  await expect(
    who.locator('[data-participant="new.person@example.com"]'),
  ).toBeVisible();

  const addField = who.getByRole("combobox", {
    name: "Add participant or room",
  });
  await addField.click();
  await page.getByRole("option", { name: "View rooms and resources" }).click();
  await page
    .getByRole("listbox", { name: "Rooms and resources" })
    .getByRole("option", { name: /Atlas/ })
    .click();
  await expect(who.locator('[data-room="atlas@example.com"]')).toContainText(
    "3rd floor · 12 seats",
  );
});

test("participants: names, roles and answers of every guest", async ({
  page,
}) => {
  const who = await selectEvent(page, "Launch Review");

  const organizer = who.locator('[data-participant="alex@example.com"]');
  await expect(organizer).toContainText("Alex Rivera");
  await expect(organizer).toContainText("Organizer");
  await expect(organizer.getByRole("img", { name: "Accepted" })).toBeVisible();

  const optional = who.locator('[data-participant="sam@example.com"]');
  await expect(optional).toContainText("Optional");
  await expect(optional.getByRole("img")).toHaveCount(0);

  await expect(
    who
      .locator('[data-participant="priya@example.com"]')
      .getByRole("img", { name: "Maybe" }),
  ).toBeVisible();
  await expect(
    who
      .locator('[data-participant="jordan@example.com"]')
      .getByRole("img", { name: "Declined" }),
  ).toBeVisible();

  // Marking a guest optional shows it under their name
  const priya = who.locator('[data-participant="priya@example.com"]');
  await priya.hover();
  await priya
    .getByRole("button", { name: "More actions for Priya Shah" })
    .click();
  await page.getByRole("menuitem", { name: "Mark optional" }).click();
  await expect(priya).toContainText("Optional");
});

test("conferencing: add a call, then switch it off from its menu", async ({
  page,
}) => {
  const who = await selectEvent(page, "Quick Sync");

  await who.getByRole("button", { name: "Conferencing", exact: true }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Google Meet",
    "Zoom",
    "Microsoft Teams",
  ]);

  // Escape closes the menu and keeps the event selected
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(detailTitle(page)).toHaveValue("Quick Sync");

  await who.getByRole("button", { name: "Conferencing", exact: true }).click();
  await menu.getByRole("menuitem", { name: "Google Meet" }).click();

  const join = who.getByRole("link", { name: "Join Google Meet" });
  await expect(join).toHaveAttribute(
    "href",
    /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/,
  );
  // With a call, the meeting-note button shows above it
  await expect(
    who.getByRole("button", { name: "Add meeting note" }),
  ).toBeVisible();

  // The copy and menu buttons show on hover
  await join.hover();
  await who.getByRole("button", { name: "Change conferencing" }).click();
  await expect(
    menu.getByRole("menuitem", { name: "Google Meet" }),
  ).toBeVisible();
  await menu.getByRole("menuitem", { name: "No conferencing" }).click();
  await expect(join).toHaveCount(0);
  await expect(
    who.getByRole("button", { name: "Conferencing", exact: true }),
  ).toBeVisible();
});

test("AI meeting notes turn on and off", async ({ page }) => {
  const who = await selectEvent(page, "Quick Sync");

  await who.getByRole("button", { name: "Add AI meeting notes" }).click();
  await expect(
    who.getByText("AI meeting notes", { exact: true }),
  ).toBeVisible();

  await who.getByRole("button", { name: "Turn off AI meeting notes" }).click();
  await expect(
    who.getByRole("button", { name: "Add AI meeting notes" }),
  ).toBeVisible();
});

test("location: the typed text first, then places; a pick opens in Maps", async ({
  page,
}) => {
  const who = await selectEvent(page, "Quick Sync");
  const field = who.getByRole("combobox", { name: "Location" });

  await field.fill("Central");
  const list = page.getByRole("listbox", { name: "Suggested places" });
  await expect(list.getByRole("option")).toHaveText([
    "Central",
    "Central ParkNew York, NY, USA",
    "Central Park ZooEast 64th Street, New York, NY, USA",
  ]);

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");

  const link = who.getByRole("link", {
    name: "Central Park, New York, NY, USA",
  });
  await expect(link).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=Central%20Park%2C%20New%20York%2C%20NY%2C%20USA",
  );

  // Escape while editing keeps the location; clearing it removes it
  await link.locator("..").click({ position: { x: 4, y: 4 } });
  await expect(field).toHaveValue("Central Park, New York, NY, USA");
  await field.fill("Elsewhere");
  await page.keyboard.press("Escape");
  await expect(link).toBeVisible();

  await link.locator("..").click({ position: { x: 4, y: 4 } });
  await field.fill("");
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("");
  await expect(field).toHaveAttribute("placeholder", "Location");
});
