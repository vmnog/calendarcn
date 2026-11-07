import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { calendarEvent, detailTitle, openCalendar } from "./helpers";

/**
 * The details' "who and where" sections: participants and rooms,
 * conferencing, AI meeting notes and location. "Quick Sync" (Saturday,
 * June 6) has none of them set; "Launch Review" (the same Saturday) has all
 * of them. The demo passes made-up contacts, rooms, conferencing services
 * (creating example.com calls after a short wait) and places to
 * CalendarProvider. Most demo events, unlike Quick Sync, are on the demo's
 * own account, which joins as the organizer.
 */

/** The demo's account, Coffee with Recruiter's `calendarEmail` */
const OWN_EMAIL = "me@vmnog.com";

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
  // Five recent contacts, then "View rooms and resources"
  await expect(list.getByRole("option")).toHaveCount(6);
  await expect(list.getByRole("option").first()).toContainText("Priya Shah");
  await expect(list.getByRole("option").last()).toHaveText(
    "View rooms and resources",
  );

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

test("participants: the arrow keys reach the rooms list", async ({ page }) => {
  const who = await selectEvent(page, "Quick Sync");
  const field = who.getByRole("combobox", { name: "Participants and Rooms" });

  await field.click();
  const roomsToggle = page.getByRole("option", {
    name: "View rooms and resources",
  });
  await page.keyboard.press("ArrowUp");
  await expect(roomsToggle).toHaveAttribute("aria-selected", "true");
  await expect(field).toHaveAttribute(
    "aria-activedescendant",
    (await roomsToggle.getAttribute("id")) ?? "",
  );
  await page.keyboard.press("Enter");

  const rooms = page.getByRole("listbox", { name: "Rooms and resources" });
  await expect(rooms.getByRole("option").first()).toContainText("Room 4B");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(who.locator('[data-room="room-4b@example.com"]')).toBeVisible();
});

test("participants: invited, invalid and room addresses aren't offered as guests", async ({
  page,
}) => {
  const who = await selectEvent(page, "Launch Review");
  const field = who.getByRole("combobox", { name: "Add participant or room" });

  for (const text of ["priya@example.com", "a@b.c,d", "guest?@example.com"]) {
    await field.fill(text);
    await expect(page.getByRole("listbox")).toHaveCount(0);
  }

  // A room's address finds the room, not a person
  await field.fill("atlas@example.com");
  const options = page.getByRole("option");
  await expect(options).toHaveCount(1);
  await expect(options).toContainText("Atlas");
});

test("participants: your own address is the organizer, who stays while anyone is invited", async ({
  page,
}) => {
  const who = await selectEvent(page, "Coffee with Recruiter");

  await who
    .getByRole("combobox", { name: "Participants and Rooms" })
    .fill(OWN_EMAIL);
  await page.getByRole("option", { name: OWN_EMAIL }).click();
  const owner = who.locator(`[data-participant="${OWN_EMAIL}"]`);
  await expect(owner).toContainText("Organizer");
  await expect(who.locator("[data-participant]")).toHaveCount(1);

  // With a guest, the organizer can't be removed
  await who
    .getByRole("combobox", { name: "Add participant or room" })
    .fill("tay");
  await page.keyboard.press("Enter");
  await expect(who.locator("[data-participant]")).toHaveCount(2);
  await owner.hover();
  await owner
    .getByRole("button", { name: `More actions for ${OWN_EMAIL}` })
    .click();
  const menu = page.getByRole("menu");
  await expect(
    menu.getByRole("menuitem", { name: "Send email" }),
  ).toHaveAttribute("href", "mailto:me@vmnog.com");
  await expect(menu.getByRole("menuitem", { name: "Remove" })).toHaveCount(0);

  // Escape closes the menu and keeps the event selected
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(detailTitle(page)).toHaveValue("Coffee with Recruiter");

  // Alone again, the organizer can be removed, which empties the list
  const guest = who.locator('[data-participant="taylor@example.com"]');
  await guest.hover();
  await guest
    .getByRole("button", { name: "More actions for Taylor Kim" })
    .click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(who.locator("[data-participant]")).toHaveCount(0);
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

test("conferencing: an async call, switching service, then no call", async ({
  page,
}) => {
  const who = await selectEvent(page, "Quick Sync");
  const trigger = who.getByRole("button", {
    name: "Conferencing",
    exact: true,
  });

  await trigger.click();
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

  // The demo's services answer after a wait, shown as pending
  await trigger.click();
  await menu.getByRole("menuitem", { name: "Google Meet" }).click();
  await expect(
    who.getByRole("button", { name: "Creating Google Meet call" }),
  ).toHaveAttribute("aria-busy", "true");

  const join = who.getByRole("link", { name: "Join Google Meet" });
  await expect(join).toHaveAttribute(
    "href",
    /^https:\/\/example\.com\/meet\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/,
  );
  // Focus moves to the new call
  await expect(join).toBeFocused();
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
  await menu.getByRole("menuitem", { name: "Zoom" }).click();
  await expect(who.getByRole("link", { name: "Join Zoom" })).toHaveAttribute(
    "href",
    /^https:\/\/example\.com\/zoom\/j\/\d{10}$/,
  );

  await who.getByRole("link", { name: "Join Zoom" }).hover();
  await who.getByRole("button", { name: "Change conferencing" }).click();
  await menu.getByRole("menuitem", { name: "No conferencing" }).click();
  await expect(who.getByRole("link", { name: /^Join/ })).toHaveCount(0);
  await expect(trigger).toBeVisible();
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

test("location: the edit button edits it from the keyboard", async ({
  page,
}) => {
  const who = await selectEvent(page, "Launch Review");
  const link = who.getByRole("link", { name: "Room 4B, 5th floor" });

  await link.focus();
  await page.keyboard.press("Tab");
  const edit = who.getByRole("button", { name: "Edit location" });
  await expect(edit).toBeFocused();
  await page.keyboard.press("Enter");

  const field = who.getByRole("combobox", { name: "Location" });
  await expect(field).toBeFocused();
  await expect(field).toHaveValue("Room 4B, 5th floor");
  await field.fill("Room 4C");
  // Escape restores the location and returns focus to it
  await page.keyboard.press("Escape");
  await expect(link).toBeFocused();
  await expect(detailTitle(page)).toHaveValue("Launch Review");
});
