import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  columnDistance,
  detailFields,
  detailTitle,
  dragBy,
  expectHeader,
  monthCell,
  openCalendar,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("dragging an all-day event moves it to other days", async ({ page }) => {
  // Weekend in Hudson Valley: all-day, Friday Jun 5 - Sunday Jun 7
  const event = calendarEvent(page, "Weekend in Hudson Valley");
  const friday = await boxOf(
    page.getByRole("main").getByText("5", { exact: true }),
  );
  const before = await boxOf(event);
  expect(before.x).toBeLessThan(friday.x);

  // Grab inside Friday (the bar runs on into next week's hidden Sunday) and
  // drop two columns left, on Wednesday
  await dragBy(page, event, {
    dx: await columnDistance(page, 5, 3),
    dy: 0,
    offsetX: 30,
  });

  // Same three-day span, now Wednesday - Friday
  const wednesday = await boxOf(
    page.getByRole("main").getByText("3", { exact: true }),
  );
  await expect
    .poll(async () => (await boxOf(event)).x)
    .toBeLessThan(wednesday.x);
  const after = await boxOf(event);
  expect(after.x + after.width).toBeGreaterThan(friday.x);
  expect(after.width).toBeCloseTo(before.width, 0);

  // It stays selected, and the detail panel shows the new start date
  await expect(detailTitle(page)).toHaveValue("Weekend in Hudson Valley");
  await expect(detailFields(page).startDate).toHaveValue("Wed Jun 3");
});

test("dragging an event in month view moves it to another day", async ({
  page,
}) => {
  await page.keyboard.press("m");
  await expectHeader(page, "June 2026");

  const from = monthCell(page, "2026-06-01");
  const to = monthCell(page, "2026-06-03");
  const event = from.getByRole("button", { name: /Sprint Planning/ });
  const fromBox = await boxOf(from);
  const toBox = await boxOf(to);

  await dragBy(page, event, { dx: toBox.x - fromBox.x, dy: 0 });

  await expect(
    to.getByRole("button", { name: /Sprint Planning/ }),
  ).toBeVisible();
  await expect(
    from.getByRole("button", { name: /Sprint Planning/ }),
  ).toHaveCount(0);
  await expect(detailFields(page).startDate).toHaveValue("Wed Jun 3");
  await expect(detailFields(page).startTime).toHaveValue("10 AM");
});

test("'+N more' in month view opens that week and highlights the day", async ({
  page,
}) => {
  await page.keyboard.press("m");
  // The mock data stacks 10+ events on Monday Mar 23, ten weeks back
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Previous month", exact: true })
      .click();
  }
  await expectHeader(page, "March 2026");

  await monthCell(page, "2026-03-23")
    .getByRole("button", { name: /^Show \d+ more events? on / })
    .click();

  await expectHeader(page, "March 2026 Week 13");
  await expect(
    page.getByRole("button", { name: "Week", exact: true }),
  ).toBeVisible();
  // The day's header briefly highlights (fades out after 2s)
  await expect(
    page.getByRole("main").locator(".column-highlight").first(),
  ).toHaveText(/Mon\s*23/);
});

test("scrolling a month cell into view keeps the rows in place", async ({
  page,
}) => {
  await page.keyboard.press("m");
  await expectHeader(page, "June 2026");

  // Centering a cell in the last visible row must not scroll the grid's
  // buffer wrapper and pull the next month's buffer rows into view
  const firstCell = monthCell(page, "2026-05-31");
  const before = await boxOf(firstCell);
  await monthCell(page, "2026-07-11").evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "center" }),
  );

  expect(await boxOf(firstCell)).toEqual(before);
});

/**
 * Makes Monday's "Sprint Planning" (10 AM - 12 PM) end at 1 AM on Tuesday,
 * from month view. Returns Monday's cell.
 */
async function makeSprintPlanningOvernight(page: Page): Promise<Locator> {
  await page.keyboard.press("m");
  await expectHeader(page, "June 2026");

  const cell = monthCell(page, "2026-06-01");
  await cell.getByRole("button", { name: /Sprint Planning/ }).click();
  await expect(detailTitle(page)).toHaveValue("Sprint Planning");

  const { endTime } = detailFields(page);
  await endTime.click();
  await endTime.fill("1a");
  await endTime.press("Enter");
  await expect(endTime).toHaveValue("1 AM");
  await expect(page.getByTestId("event-end-date")).toHaveValue("Tue Jun 2");

  // Leave the field, so the next key press is not typed into it
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );

  return cell;
}

test("nudging an all-day bar in day view keeps its days", async ({ page }) => {
  // Friday in day view: Weekend in Hudson Valley (Fri Jun 5 - Sun Jun 7) runs
  // past the three days the grid renders
  await page.keyboard.press("d");
  await page.keyboard.press("k");
  await expectHeader(page, "June 2026 Friday, Jun 5");

  const event = calendarEvent(page, "Weekend in Hudson Valley");
  await expect(event).toBeInViewport();

  // Past the 4px drag threshold, short of the next column
  await dragBy(page, event, { dx: 6, dy: 0, offsetX: 30 });

  await expect(detailTitle(page)).toHaveValue("Weekend in Hudson Valley");
  await expect(detailFields(page).startDate).toHaveValue("Fri Jun 5");
  await expect(page.getByTestId("event-end-date")).toHaveValue("Sun Jun 7");
});

test("resizing an all-day event to two days keeps it all-day", async ({
  page,
}) => {
  // Left edge of Weekend in Hudson Valley, from Friday to Saturday
  const event = calendarEvent(page, "Weekend in Hudson Valley");
  await dragBy(page, event, {
    dx: await columnDistance(page, 5, 6),
    dy: 0,
    offsetX: 2,
  });

  await expect(detailTitle(page)).toHaveValue("Weekend in Hudson Valley");
  await expect(detailFields(page).startDate).toHaveValue("Sat Jun 6");
  await expect(page.getByTestId("event-end-date")).toHaveValue("Sun Jun 7");
  await expect(page.getByRole("switch", { name: "All-day" })).toBeChecked();
});

test("a month resize cannot end an overnight event before it starts", async ({
  page,
}) => {
  const cell = await makeSprintPlanningOvernight(page);

  // Right edge of the bar, from Tuesday back to Monday: the end would be
  // Monday 1 AM, before the 10 AM start
  const bar = cell.getByRole("button", { name: /Sprint Planning/ });
  const box = await boxOf(bar);
  const cellBox = await boxOf(cell);
  const nextBox = await boxOf(monthCell(page, "2026-06-02"));
  await dragBy(page, bar, {
    dx: cellBox.x - nextBox.x,
    dy: 0,
    offsetX: box.width - 2,
  });

  await expect(page.getByTestId("event-end-date")).toHaveValue("Tue Jun 2");
  await expect(detailFields(page).endTime).toHaveValue("1 AM");
  await expect(detailFields(page).startTime).toHaveValue("10 AM");
});

test("an all-day row resize cannot end an overnight event before it starts", async ({
  page,
}) => {
  await makeSprintPlanningOvernight(page);
  await page.keyboard.press("w");
  await expectHeader(page, "June 2026 Week 23");

  // The overnight event now sits in the all-day row, Monday to Tuesday.
  // Right edge back to Monday.
  const bar = page.locator('[data-event-id="may21"]').first();
  const box = await boxOf(bar);
  await dragBy(page, bar, {
    dx: await columnDistance(page, 2, 1),
    dy: 0,
    offsetX: box.width - 2,
  });

  await expect(detailTitle(page)).toHaveValue("Sprint Planning");
  await expect(page.getByTestId("event-end-date")).toHaveValue("Tue Jun 2");
  await expect(detailFields(page).endTime).toHaveValue("1 AM");
});

test("a month bar dragged by its second day moves by the cells crossed", async ({
  page,
}) => {
  await page.keyboard.press("m");
  await expectHeader(page, "June 2026");

  // React Conf 2026: Tuesday Jun 9 - Thursday Jun 11, one bar over three cells
  const cell = monthCell(page, "2026-06-09");
  const bar = cell.getByRole("button", { name: /React Conf 2026/ });
  const cellBox = await boxOf(cell);
  const nextBox = await boxOf(monthCell(page, "2026-06-10"));
  const column = nextBox.x - cellBox.x;

  // Pressed on Wednesday, dropped on Tuesday: one day earlier
  await dragBy(page, bar, { dx: -column, dy: 0, offsetX: column * 1.5 });

  await expect(detailTitle(page)).toHaveValue("React Conf 2026");
  await expect(detailFields(page).startDate).toHaveValue("Mon Jun 8");
  await expect(page.getByTestId("event-end-date")).toHaveValue("Wed Jun 10");
});
