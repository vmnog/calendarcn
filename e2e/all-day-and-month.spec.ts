import { expect, test } from "@playwright/test";

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
