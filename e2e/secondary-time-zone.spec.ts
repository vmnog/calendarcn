import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, boxOf, dragBy } from "./helpers";

/**
 * The "Second time zone" example on the Calendar Core docs page: a week
 * view with `secondaryTimeZone="Asia/Kolkata"`. The browser runs in New
 * York (GMT−4 in June) and Kolkata is GMT+5:30, 9 hours 30 minutes ahead.
 * The clock is frozen at Thursday June 4 2026, 8:00 AM, so the week is May
 * 31 to June 6.
 */
const DOCS_PATH = "/docs/components/calendar-core";

/** Width of one time axis column: `TIME_AXIS_WIDTH` in time-grid.tsx */
const AXIS_COLUMN_WIDTH = 64;

/** The live example inside the docs page */
function demo(page: Page): Locator {
  return page.locator('[data-example="secondary-time-zone-demo"]');
}

/** Exact text inside the example: a zone label, an hour label or a badge */
function text(page: Page, value: string): Locator {
  return demo(page).getByText(value, { exact: true });
}

/** An event in the example, by the start of its accessible name */
function exampleEvent(page: Page, title: string): Locator {
  return demo(page).getByRole("button", { name: new RegExp(`^${title}`) });
}

/** A day column of the grid, by its full date ("Wednesday, June 3") */
function dayColumn(page: Page, date: string): Locator {
  return demo(page).getByRole("group", { name: date, exact: true });
}

/** The element itself or its closest ancestor hidden from assistive tech */
function hiddenFromScreenReaders(locator: Locator): Locator {
  return locator.locator("xpath=ancestor-or-self::*[@aria-hidden='true']");
}

/** Vertical center of a box */
function centerY(box: { y: number; height: number }): number {
  return box.y + box.height / 2;
}

/**
 * Asserts the second column (64px, then the viewer's) and that Wednesday's
 * timed event and all-day bar both start at Wednesday's grid column
 */
async function expectDaysInLine(page: Page): Promise<void> {
  const frame = await boxOf(demo(page));
  const sunday = await boxOf(dayColumn(page, "Sunday, May 31"));
  const wednesday = await boxOf(dayColumn(page, "Wednesday, June 3"));

  // The day columns start where the two-column axis ends
  expect(Math.abs(sunday.x - (frame.x + 2 * AXIS_COLUMN_WIDTH))).toBeLessThan(
    2,
  );
  // The "All-day" corner is as wide as the axis below it
  const allDay = await boxOf(text(page, "All-day"));
  expect(Math.abs(allDay.width - 2 * AXIS_COLUMN_WIDTH)).toBeLessThan(1);

  const call = await boxOf(exampleEvent(page, "Customer call"));
  const offsite = await boxOf(exampleEvent(page, "Product offsite"));
  expect(Math.abs(call.x - wednesday.x)).toBeLessThan(3);
  expect(Math.abs(offsite.x - wednesday.x)).toBeLessThan(4);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto(DOCS_PATH);
  await demo(page).scrollIntoViewIfNeeded();
  await expect(exampleEvent(page, "Customer call")).toBeVisible();
});

test("the second zone's label and hours sit in a column left of the viewer's", async ({
  page,
}) => {
  const frame = await boxOf(demo(page));

  // One 64px column per zone, Kolkata's first, each labeled at the top
  const kolkata = await boxOf(text(page, "GMT+5:30"));
  const newYork = await boxOf(text(page, "EDT"));
  expect(Math.abs(kolkata.x - frame.x)).toBeLessThan(1.5);
  expect(Math.abs(newYork.x - (frame.x + AXIS_COLUMN_WIDTH))).toBeLessThan(1.5);
  expect(Math.abs(kolkata.y - newYork.y)).toBeLessThan(1);

  // 10 AM in New York is 7:30 PM in Kolkata, and 3 PM is 12:30 AM there
  for (const [own, kolkataTime] of [
    ["10 AM", "7:30 PM"],
    ["3 PM", "12:30 AM"],
  ]) {
    const ownBox = await boxOf(text(page, own));
    const secondBox = await boxOf(text(page, kolkataTime));
    expect(Math.abs(centerY(ownBox) - centerY(secondBox))).toBeLessThan(1);
    expect(secondBox.x + secondBox.width).toBeLessThanOrEqual(
      frame.x + AXIS_COLUMN_WIDTH,
    );
    expect(ownBox.x).toBeGreaterThanOrEqual(frame.x + AXIS_COLUMN_WIDTH);
  }

  // Screen readers read each zone's label once and neither column's hours
  await expect(hiddenFromScreenReaders(text(page, "GMT+5:30"))).toHaveCount(0);
  await expect(hiddenFromScreenReaders(text(page, "EDT"))).toHaveCount(0);
  await expect(
    hiddenFromScreenReaders(text(page, "7:30 PM")).first(),
  ).toBeAttached();
  await expect(
    hiddenFromScreenReaders(text(page, "10 AM")).first(),
  ).toBeAttached();
});

test("the now line shows the current time in both zones", async ({ page }) => {
  const frame = await boxOf(demo(page));
  const own = await boxOf(text(page, "8:00AM"));
  const second = await boxOf(text(page, "5:30PM"));

  expect(Math.abs(centerY(own) - centerY(second))).toBeLessThan(1);
  expect(second.x + second.width).toBeLessThanOrEqual(
    frame.x + AXIS_COLUMN_WIDTH,
  );
  expect(own.x).toBeGreaterThanOrEqual(frame.x + AXIS_COLUMN_WIDTH);
});

test("the header, all-day row and grid stay in line beside the wider axis", async ({
  page,
}) => {
  await expectDaysInLine(page);

  // Wednesday's "3" day header sits over Wednesday's grid column
  const wednesday = await boxOf(dayColumn(page, "Wednesday, June 3"));
  const header = await boxOf(text(page, "3"));
  const headerCenter = header.x + header.width / 2;
  expect(headerCenter).toBeGreaterThan(wednesday.x);
  expect(headerCenter).toBeLessThan(wednesday.x + wednesday.width);
});

test("a dragged event lands on the day under the pointer", async ({ page }) => {
  const call = exampleEvent(page, "Customer call");
  await expect(call).toHaveAccessibleName(
    "Customer call, 2:00 PM to 3:00 PM, Wednesday, June 3",
  );
  const wednesday = await boxOf(dayColumn(page, "Wednesday, June 3"));
  const box = await boxOf(call);

  // Pressed near the event's right edge: a grid edge measured from a
  // one-column axis would read the drop as the day after
  await dragBy(page, call, {
    dx: wednesday.width,
    dy: 0,
    offsetX: box.width - 4,
  });

  await expect(call).toHaveAccessibleName(
    "Customer call, 2:00 PM to 3:00 PM, Thursday, June 4",
  );
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the axis keeps both columns and the days stay in line", async ({
    page,
  }) => {
    await expect(text(page, "GMT+5:30")).toBeVisible();
    await expect(text(page, "EDT")).toBeVisible();
    await expectDaysInLine(page);
  });
});
