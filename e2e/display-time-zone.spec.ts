import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { boxOf, dragBy } from "./helpers";

/**
 * The "Time zone" example on the Calendar Core docs page: a Calendar drawn
 * in Asia/Tokyo with India's hours beside it, and "Your clock", the app's
 * events on the browser's own clock. The browser runs in America/New_York
 * (playwright.config.ts).
 */
const DOCS_PATH = "/docs/components/calendar-core";

/** Saturday June 6 2026, 8 PM in New York: already Sunday June 7, 9 AM in Tokyo */
const SUNDAY_MORNING_IN_TOKYO = new Date("2026-06-06T20:00:00-04:00");

/** The live example inside the docs page */
function demo(page: Page): Locator {
  return page.locator('[data-example="time-zone-demo"]');
}

/** Exact text inside the example: an hour label, a zone label or a badge */
function text(page: Page, value: string): Locator {
  return demo(page).getByText(value, { exact: true });
}

/** An event in the example, by its title */
function exampleEvent(page: Page, title: string): Locator {
  return demo(page).getByRole("button", { name: new RegExp(`^${title},`) });
}

/** The app's copy of an event, as "Your clock" lists it */
function stored(page: Page, title: string): Locator {
  return demo(page)
    .getByRole("list", { name: "Your clock" })
    .getByRole("listitem")
    .filter({ hasText: title });
}

/** Vertical center of a box */
function centerY(box: { y: number; height: number }): number {
  return box.y + box.height / 2;
}

/** Pixel height of one hour row, between two of Tokyo's hour labels */
async function hourHeight(page: Page): Promise<number> {
  const ten = await boxOf(text(page, "10 AM"));
  const eleven = await boxOf(text(page, "11 AM"));
  return eleven.y - ten.y;
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(SUNDAY_MORNING_IN_TOKYO);
  await page.goto(DOCS_PATH);
  await demo(page).scrollIntoViewIfNeeded();
  await expect(exampleEvent(page, "Team standup")).toBeVisible();
});

test("the week, today and the current time follow the calendar's zone", async ({
  page,
}) => {
  // Tokyo is on Sunday June 7, the first day of week 24 (New York is still
  // in week 23)
  await expect(demo(page).getByRole("heading", { level: 2 })).toHaveText(
    /^June 2026\s*Week 24$/,
  );
  await expect(exampleEvent(page, "Team standup")).toHaveAccessibleName(
    "Team standup, 10:00 AM to 10:30 AM, Sunday, June 7",
  );
  await expect(exampleEvent(page, "Call with Bangalore")).toHaveAccessibleName(
    "Call with Bangalore, 2:00 PM to 3:00 PM, Sunday, June 7",
  );
  // The time axis is labeled with the calendar's zone, and the now line
  // reads its clock
  await expect(text(page, "GMT+9")).toBeVisible();
  await expect(text(page, "9:00AM")).toBeVisible();
});

test("the agenda starts on the calendar's today", async ({ page }) => {
  await demo(page).getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Agenda/ }).click();

  const firstDay = demo(page)
    .getByRole("group", { name: /^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day, / })
    .first();
  await expect(firstDay).toHaveAccessibleName("Sunday, June 7, today");
  await expect(firstDay.getByRole("button").first()).toHaveAccessibleName(
    /^Team standup, 10:00 AM to 10:30 AM/,
  );
});

test("a double-click creates the event at that row's time in the calendar's zone", async ({
  page,
}) => {
  // Monday June 8 is free at 3 PM in Tokyo; double-click just past the line
  await text(page, "3 PM").scrollIntoViewIfNeeded();
  const monday = await boxOf(text(page, "8"));
  const threePm = await boxOf(text(page, "3 PM"));
  await page.mouse.dblclick(monday.x + monday.width / 2, centerY(threePm) + 3);

  // A draft on the calendar's clock, not stored yet. Naming it saves it
  const title = page
    .getByRole("dialog", { name: "Event details" })
    .getByPlaceholder("Title");
  await expect(title).toBeFocused();
  await expect(stored(page, "Review")).toHaveCount(0);
  await page.keyboard.type("Review");
  await page.keyboard.press("Enter");

  await expect(exampleEvent(page, "Review")).toHaveAccessibleName(
    "Review, 3:00 PM to 3:30 PM, Monday, June 8",
  );
  // The app stores the instant: 3 PM in Tokyo is 2 AM in New York
  await expect(stored(page, "Review")).toHaveText("Review, Mon 2:00 AM");
});

test("a dragged event moves the instant the app stores", async ({ page }) => {
  const standup = exampleEvent(page, "Team standup");
  await expect(stored(page, "Team standup")).toHaveText(
    "Team standup, Sat 9:00 PM",
  );

  await standup.scrollIntoViewIfNeeded();
  await dragBy(page, standup, { dx: 0, dy: await hourHeight(page) });

  await expect(standup).toHaveAccessibleName(
    "Team standup, 11:00 AM to 11:30 AM, Sunday, June 7",
  );
  await expect(stored(page, "Team standup")).toHaveText(
    "Team standup, Sat 10:00 PM",
  );
});

test("dragging one of several selected events moves them all by the calendar's clock", async ({
  page,
}) => {
  const standup = exampleEvent(page, "Team standup");
  await standup.click();
  await exampleEvent(page, "Call with Bangalore").click({
    modifiers: ["Shift"],
  });
  await exampleEvent(page, "Offsite").click({ modifiers: ["Shift"] });
  await expect(
    demo(page).locator('[data-event-id][aria-pressed="true"]'),
  ).toHaveCount(3);

  // Three hours later in Tokyo is past midnight in New York: the timed
  // events move three hours, and the all-day offsite keeps its day
  await standup.scrollIntoViewIfNeeded();
  await dragBy(page, standup, { dx: 0, dy: 3 * (await hourHeight(page)) });

  await expect(standup).toHaveAccessibleName(
    "Team standup, 1:00 PM to 1:30 PM, Sunday, June 7",
  );
  await expect(exampleEvent(page, "Call with Bangalore")).toHaveAccessibleName(
    "Call with Bangalore, 5:00 PM to 6:00 PM, Sunday, June 7",
  );
  await expect(stored(page, "Team standup")).toHaveText(
    "Team standup, Sun 12:00 AM",
  );
  await expect(stored(page, "Call with Bangalore")).toHaveText(
    "Call with Bangalore, Sun 4:00 AM",
  );
  await expect(stored(page, "Offsite")).toHaveText("Offsite, Tue, all day");
});

test("the details show the calendar's clock and the event's zone", async ({
  page,
}) => {
  await exampleEvent(page, "Call with Bangalore").click();
  const details = page.getByRole("dialog", { name: "Event details" });

  await expect(details.getByTestId("event-start-time")).toHaveValue("2 PM");
  await expect(details.getByTestId("event-end-time")).toHaveValue("3 PM");
  await expect(details.getByTestId("event-start-date")).toHaveValue(
    "Sun Jun 7",
  );
  await expect(details.locator('[data-section="timezone"]')).toHaveText(
    "GMT+9Tokyo",
  );
});

test("India's column reads its clock beside the calendar's hours", async ({
  page,
}) => {
  // 10 AM in Tokyo is 6:30 AM in Kolkata
  const tokyo = await boxOf(text(page, "10 AM"));
  const kolkata = await boxOf(text(page, "6:30 AM"));
  expect(Math.abs(centerY(tokyo) - centerY(kolkata))).toBeLessThan(1);
  await expect(text(page, "GMT+5:30")).toBeVisible();
  // One now badge, in the calendar's column
  await expect(demo(page).getByText(/^\d{1,2}:\d{2}[AP]M$/)).toHaveCount(1);
});
