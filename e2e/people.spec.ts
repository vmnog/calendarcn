import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  detailTitle,
  hourHeight,
  openCalendar,
} from "./helpers";

/**
 * Meeting with people and showing a teammate's calendar, as in Notion
 * Calendar: the sidebar's "Meet with..." field, F and P, and their commands.
 * The demo's sample teammates (`generateContactEvents`) have weeks of their
 * own; in the frozen week (May 31 - Jun 6), with Priya, you're both free on
 * Thursday June 4 from 1:30 to 3 PM.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** The sidebar's "Meet with..." field */
function meetWithField(page: Page): Locator {
  return page.getByRole("combobox", { name: "Meet with" });
}

/** A day column of the time grid, by its full date ("Thursday, June 4") */
function dayColumn(page: Page, label: string): Locator {
  return page
    .getByRole("main")
    .getByRole("group", { name: label, exact: true });
}

/** Someone else's event in the grid, by "<name>: <title>" */
function personEvent(page: Page, nameAndTitle: string): Locator {
  return page.locator(`[data-person-event][title^="${nameAndTitle},"]`);
}

/** A row of the sidebar's "Meeting participants" or "Team calendars" */
function personRow(page: Page, email: string): Locator {
  return page.locator(`[data-person-row="${email}"]`);
}

/** Meets with someone through the sidebar field */
async function meetWith(page: Page, typed: string): Promise<void> {
  await meetWithField(page).click();
  await page.keyboard.type(typed);
  await page.keyboard.press("Enter");
}

test("focusing Meet with lists the recent people, typing filters them", async ({
  page,
}) => {
  await meetWithField(page).click();
  const list = page.getByRole("listbox", { name: "People" });
  await expect(list).toBeVisible();
  // Recent people first, as Notion lists them before typing
  await expect(list.getByRole("option").first()).toContainText("Priya Shah");
  await expect(
    list.getByRole("option", { name: /Alex Rivera/ }).getByLabel("Recent"),
  ).toBeVisible();

  await page.keyboard.type("tay");
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(list.getByRole("option").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(list.getByRole("option").first()).toContainText("Taylor Kim");

  // A typed address no contact has is offered as it is
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("new.person@example.com");
  await expect(list.getByRole("option")).toHaveText(["new.person@example.com"]);

  // Escape closes the list and clears the text
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(meetWithField(page)).toHaveValue("");
});

test("meeting with someone draws their events and the times you're both free", async ({
  page,
}) => {
  await meetWith(page, "pri");

  await expect(meetWithField(page)).toHaveValue("");
  await expect(page.getByText("Meeting participants")).toBeVisible();
  await expect(personRow(page, "priya@example.com")).toContainText(
    "Priya Shah",
  );

  // Her events, behind yours: read-only, so they aren't buttons
  const thursday = dayColumn(page, "Thursday, June 4");
  await expect(
    thursday.locator('[data-person-event][title^="Priya Shah: Lunch,"]'),
  ).toHaveCount(1);
  await expect(
    personEvent(page, "Priya Shah: Design review with Alex").first(),
  ).toBeVisible();
  await expect(
    thursday.getByRole("button", { name: /Design review/ }),
  ).toHaveCount(0);

  // The free times you share, inside 9 to 5 on weekdays
  await expect(
    thursday.getByRole("note", { name: "Everyone free, 1:30–3 PM" }),
  ).toBeVisible();
  await expect(thursday.getByRole("note")).toHaveCount(4);
  await expect(
    dayColumn(page, "Saturday, June 6").getByRole("note"),
  ).toHaveCount(0);

  // Adding Alex too narrows them down to the times all three are free
  await meetWith(page, "alex");
  await expect(personRow(page, "alex@example.com")).toBeVisible();
  await expect(
    dayColumn(page, "Wednesday, June 3").getByRole("note"),
  ).toHaveText(["Free", "Free"]);
  await expect(
    dayColumn(page, "Wednesday, June 3").getByRole("note").first(),
  ).toHaveAccessibleName("Everyone free, 9–9:30 AM");
});

test("travelling to a time zone moves their events and the free time with yours", async ({
  page,
}) => {
  await meetWith(page, "pri");
  const saturday = dayColumn(page, "Saturday, June 6");
  await expect(saturday.locator("[data-person-event]")).toHaveCount(0);

  // Escape leaves the empty field, then Z travels to Tokyo
  await page.keyboard.press("Escape");
  await page.keyboard.press("z");
  await page.keyboard.type("Tokyo");
  await page
    .getByRole("option", { name: "(GMT+09:00) Japan Standard Time – Tokyo" })
    .click();

  // Her lunch at noon in New York is 1 AM the next day in Tokyo: Friday's
  // falls on Saturday, as yours do
  await expect(
    saturday.locator('[data-person-event][title^="Priya Shah: Lunch,"]'),
  ).toHaveAttribute("title", "Priya Shah: Lunch, 1–2 AM");
  // 9 to 5 in Tokyo is the night in New York: Thursday is free all day
  await expect(
    dayColumn(page, "Thursday, June 4").getByRole("note"),
  ).toHaveAccessibleName("Everyone free, 9 AM–5 PM");
});

test("people are removed one by one, or all at once with Clear", async ({
  page,
}) => {
  await meetWith(page, "pri");
  await meetWith(page, "sam");
  await expect(personRow(page, "sam@example.com")).toBeVisible();

  await personRow(page, "priya@example.com").hover();
  await page
    .getByRole("button", { name: "Stop meeting with Priya Shah" })
    .click();
  await expect(personRow(page, "priya@example.com")).toHaveCount(0);
  await expect(personEvent(page, "Priya Shah: Lunch")).toHaveCount(0);
  await expect(personEvent(page, "Sam Lee: Inbox zero").first()).toBeVisible();

  // The field offers Priya again, and no longer Sam
  await meetWithField(page).click();
  const list = page.getByRole("listbox", { name: "People" });
  await expect(list.getByRole("option", { name: /Priya Shah/ })).toBeVisible();
  await expect(list.getByRole("option", { name: /Sam Lee/ })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByText("Meeting participants")).toHaveCount(0);
  await expect(page.locator("[data-person-event]")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("note")).toHaveCount(0);
});

test("an event created while meeting invites the people met with", async ({
  page,
}) => {
  await meetWith(page, "pri");

  // Thursday June 4 at 2 PM, inside the free time you share
  const main = page.getByRole("main");
  const thursday = await boxOf(main.getByText("4", { exact: true }));
  const twoPm = await boxOf(main.getByText("2 PM", { exact: true }));
  await page.mouse.click(
    thursday.x + thursday.width / 2,
    twoPm.y + twoPm.height / 2 + (await hourHeight(page)) / 6,
  );

  await expect(calendarEvent(page, "New event")).toHaveAccessibleName(
    "New event, 2:00 PM to 3:00 PM, Thursday, June 4",
  );
  await expect(detailTitle(page)).toHaveValue("New event");
  // The demo's new events are on you@example.com, which organizes
  const who = page.locator('[data-group="who"]');
  await expect(
    who.locator('[data-participant="priya@example.com"]'),
  ).toContainText("Priya Shah");
  await expect(
    who.locator('[data-participant="you@example.com"]'),
  ).toContainText("Organizer");
});

test("F and the command menu's Meet with... open the people picker", async ({
  page,
}) => {
  await page.keyboard.press("f");
  const picker = page.getByRole("dialog", { name: "Meet with..." });
  await expect(picker).toBeVisible();
  await expect(picker.getByPlaceholder("Meet with...")).toBeFocused();
  await page.keyboard.type("morgan");
  await page.keyboard.press("Enter");
  await expect(picker).toBeHidden();
  await expect(personRow(page, "morgan.diaz@example.com")).toBeVisible();
  await expect(
    personEvent(page, "Morgan Diaz: Conference talk").first(),
  ).toBeVisible();

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("option", { name: /^Meet with\.\.\./ }).click();
  await expect(picker).toBeVisible();
  // Morgan is met with already, so only the others are offered
  await expect(picker.getByRole("option", { name: /Morgan Diaz/ })).toHaveCount(
    0,
  );
  await picker.getByRole("option", { name: /Alex Rivera/ }).click();
  await expect(personRow(page, "alex@example.com")).toBeVisible();
});

test("P shows a teammate's calendar, without a meeting", async ({ page }) => {
  await page.keyboard.press("p");
  const picker = page.getByRole("dialog", {
    name: "Show teammate calendar...",
  });
  await expect(picker).toBeVisible();
  await page.keyboard.type("alex");
  await page.keyboard.press("Enter");

  await expect(page.getByText("Team calendars")).toBeVisible();
  await expect(personRow(page, "alex@example.com")).toContainText(
    "Alex Rivera",
  );
  await expect(page.getByText("Meeting participants")).toHaveCount(0);
  await expect(
    personEvent(page, "Alex Rivera: Architecture sync").first(),
  ).toBeVisible();
  // Only a meeting highlights free time
  await expect(page.getByRole("main").getByRole("note")).toHaveCount(0);

  await personRow(page, "alex@example.com").hover();
  await page
    .getByRole("button", { name: "Remove Alex Rivera from team calendars" })
    .click();
  await expect(page.getByText("Team calendars")).toHaveCount(0);
  await expect(page.locator("[data-person-event]")).toHaveCount(0);

  // The command menu's "Show teammate calendar..." opens the same picker
  await page.keyboard.press("ControlOrMeta+k");
  const command = page.getByRole("option", {
    name: /^Show teammate calendar\.\.\./,
  });
  await expect(command).toContainText("P");
  await command.click();
  await expect(picker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();
});

test("typing f and p in a field types them", async ({ page }) => {
  await meetWithField(page).click();
  await page.keyboard.type("pf");
  await expect(meetWithField(page)).toHaveValue("pf");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Escape in the field leaves the selected event selected", async ({
  page,
}) => {
  await calendarEvent(page, "Architecture Review").first().click();
  await expect(detailTitle(page)).toHaveValue("Architecture Review");

  await meetWithField(page).click();
  await page.keyboard.press("Escape");
  await expect(detailTitle(page)).toHaveValue("Architecture Review");
});

test("month view leaves other people's events out", async ({ page }) => {
  await meetWith(page, "pri");
  await expect(personEvent(page, "Priya Shah: Lunch").first()).toBeVisible();

  // The field keeps the focus after a pick; Escape on the empty field leaves it
  await page.keyboard.press("Escape");
  await expect(meetWithField(page)).not.toBeFocused();
  await page.keyboard.press("m");
  await expect(
    page.getByRole("button", { name: "Month", exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-person-event]")).toHaveCount(0);
  // The meeting goes on: back in week view, her events are there again
  await page.keyboard.press("w");
  await expect(personEvent(page, "Priya Shah: Lunch").first()).toBeVisible();
});
