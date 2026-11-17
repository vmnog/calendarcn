import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  boxOf,
  calendarEvent,
  columnDistance,
  dragBy,
  expectHeader,
  monthCell,
  openCalendar,
} from "./helpers";

/**
 * The view dropdown's three settings, Weekends, Declined events and Week
 * numbers, in every view, and the commands that toggle them. The demo
 * starts with weekends and declined events shown and week numbers on.
 *
 * "Vendor Demo" (Wednesday June 3, 1 to 2 PM) is the sample event the
 * viewer declined.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** A day column of the time grid, by its full date ("Friday, June 5") */
function dayColumn(page: Page, date: string): Locator {
  return page.getByRole("main").getByRole("group", { name: date, exact: true });
}

/** Opens the view dropdown's "View settings" submenu */
async function openViewSettings(page: Page, viewLabel: string) {
  await page.getByRole("button", { name: viewLabel, exact: true }).click();
  await page.getByRole("menuitem", { name: "View settings" }).click();
}

/** A setting of the open "View settings" submenu */
function setting(page: Page, name: string): Locator {
  return page.getByRole("menuitemcheckbox", { name: new RegExp(`^${name}`) });
}

/** Opens the command menu and runs the command named `name` */
async function runCommand(page: Page, query: string, name: string) {
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  await menu.getByPlaceholder("Type a command...").fill(query);
  await menu.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  await expect(menu).toHaveCount(0);
}

/** The names the command menu shows for a query, read and closed again */
async function commandNames(page: Page, query: string): Promise<string[]> {
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  await menu.getByPlaceholder("Type a command...").fill(query);
  const names = await menu.getByRole("option").allInnerTexts();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  return names.map((name) => name.replace(/\s+/g, " ").trim());
}

test.describe("weekends", () => {
  test("week view drops Saturday and Sunday, and steps a week at a time", async ({
    page,
  }) => {
    await expect(dayColumn(page, "Saturday, June 6")).toBeInViewport();

    await openViewSettings(page, "Week");
    await setting(page, "Weekends").click();
    await page.keyboard.press("Escape");

    // Five columns, none of them a weekend, not even off screen
    await expect(dayColumn(page, "Monday, June 1")).toBeInViewport();
    await expect(dayColumn(page, "Friday, June 5")).toBeInViewport();
    await expect(dayColumn(page, "Saturday, June 6")).toHaveCount(0);
    await expect(dayColumn(page, "Sunday, May 31")).toHaveCount(0);
    await expectHeader(page, CURRENT_WEEK_LABEL);

    await page.getByRole("button", { name: "Next week" }).click();
    await expect(dayColumn(page, "Monday, June 8")).toBeInViewport();
    await expect(dayColumn(page, "Friday, June 12")).toBeInViewport();
    await expectHeader(page, "June 2026 Week 24");

    // Shift+Cmd+E brings them back
    await page.keyboard.press("ControlOrMeta+Shift+E");
    await expect(dayColumn(page, "Saturday, June 13")).toBeInViewport();
    await expect(dayColumn(page, "Sunday, June 7")).toBeInViewport();
  });

  test("a few days step over the weekend, one weekday at a time", async ({
    page,
  }) => {
    // Three days from today, Thursday
    await page.keyboard.press("3");
    await page.keyboard.press("t");
    await runCommand(page, "weekends", "Hide weekends");

    await expect(dayColumn(page, "Thursday, June 4")).toBeInViewport();
    await expect(dayColumn(page, "Friday, June 5")).toBeInViewport();
    await expect(dayColumn(page, "Monday, June 8")).toBeInViewport();

    await page.keyboard.press("k");
    await expect(dayColumn(page, "Tuesday, June 9")).toBeInViewport();
    await expect(dayColumn(page, "Thursday, June 11")).toBeInViewport();

    await page.keyboard.press("j");
    await expect(dayColumn(page, "Thursday, June 4")).toBeInViewport();
    await expect(dayColumn(page, "Monday, June 8")).toBeInViewport();
  });

  test("a drag from Friday to the next column lands on Monday", async ({
    page,
  }) => {
    // Thursday, Friday and Monday
    await page.keyboard.press("3");
    await page.keyboard.press("t");
    await page.keyboard.press("ControlOrMeta+Shift+E");
    await expect(dayColumn(page, "Monday, June 8")).toBeInViewport();

    const wrapUp = dayColumn(page, "Friday, June 5").getByRole("button", {
      name: /^Friday Wrap-up/,
    });
    await dragBy(page, wrapUp, {
      dx: await columnDistance(page, 5, 8),
      dy: 0,
    });

    await expect(
      dayColumn(page, "Monday, June 8").getByRole("button", {
        name: /^Friday Wrap-up, 4:00 PM to 5:00 PM, Monday, June 8/,
      }),
    ).toBeVisible();
    await expect(
      dayColumn(page, "Friday, June 5").getByRole("button", {
        name: /^Friday Wrap-up/,
      }),
    ).toHaveCount(0);
  });

  test("day view goes from Friday to Monday, and a Saturday opens Monday", async ({
    page,
  }) => {
    await page.keyboard.press("d");
    await page.keyboard.press("ControlOrMeta+Shift+E");
    await expectHeader(page, "June 2026 Thursday, Jun 4 Week 23");

    await page.keyboard.press("k");
    await expectHeader(page, "June 2026 Friday, Jun 5 Week 23");
    await page.keyboard.press("k");
    await expectHeader(page, "June 2026 Monday, Jun 8 Week 24");
    await page.keyboard.press("j");
    await expectHeader(page, "June 2026 Friday, Jun 5 Week 23");

    // The mini calendar still shows weekends: a Saturday opens the Monday after
    await page
      .getByRole("button", { name: /^Saturday, June 6th, 2026/ })
      .click();
    await expectHeader(page, "June 2026 Monday, Jun 8 Week 24");
  });

  test("year view drops the weekend columns of every month", async ({
    page,
  }) => {
    await page.keyboard.press("y");
    const january = page.getByRole("main").getByRole("grid").first();
    // DayPicker hides the header row from screen readers: count its cells
    const headers = january.locator("thead th");
    await expect(headers).toHaveCount(8);

    await page.keyboard.press("ControlOrMeta+Shift+E");

    // The week number column and Monday to Friday
    await expect(headers).toHaveCount(6);
    await expect(
      january.getByRole("button", { name: /^Saturday, January 3(,|$)/ }),
    ).toHaveCount(0);
    await expect(
      january.getByRole("button", { name: /^Friday, January 2(,|$)/ }),
    ).toBeVisible();
  });
});

test.describe("week numbers", () => {
  test("the header names the week in week and day view while they're on", async ({
    page,
  }) => {
    await expectHeader(page, CURRENT_WEEK_LABEL);

    await openViewSettings(page, "Week");
    await expect(setting(page, "Week numbers")).toBeChecked();
    await setting(page, "Week numbers").click();
    await page.keyboard.press("Escape");
    await expectHeader(page, "June 2026");

    await page.keyboard.press("d");
    await expectHeader(page, "June 2026 Thursday, Jun 4");

    await runCommand(page, "week numbers", "Show week numbers");
    await expectHeader(page, "June 2026 Thursday, Jun 4 Week 23");
    await page.keyboard.press("w");
    await expectHeader(page, CURRENT_WEEK_LABEL);
  });

  test("the agenda marks where each week starts", async ({ page }) => {
    await page.keyboard.press("a");
    const main = page.getByRole("main");
    // June 4 opens week 23; June 7 (Sunday) starts week 24
    await expect(main.getByText("Week 23", { exact: true })).toBeVisible();
    await expect(main.getByText("Week 24", { exact: true })).toBeVisible();

    await runCommand(page, "week numbers", "Hide week numbers");
    await expect(main.getByText(/^Week \d+$/)).toHaveCount(0);
  });

  test("the command's name says what it will do", async ({ page }) => {
    expect(await commandNames(page, "week numbers")).toContain(
      "Hide week numbers",
    );
    await page.keyboard.press("ControlOrMeta+Shift+E");
    expect(await commandNames(page, "weekends")).toContain(
      "Show weekends shift ⌘ E",
    );
    await runCommand(page, "declined", "Hide declined events");
    expect(await commandNames(page, "declined")).toContain(
      "Show declined events",
    );
  });
});

test.describe("declined events", () => {
  test("drawn struck through on a dashed outline, and hidden with the setting", async ({
    page,
  }) => {
    const declined = dayColumn(page, "Wednesday, June 3").getByRole("button", {
      name: /^Vendor Demo, 1:00 PM to 2:00 PM, Wednesday, June 3, declined$/,
    });
    await expect(declined).toBeVisible();
    await expect(declined.getByText("Vendor Demo")).toHaveCSS(
      "text-decoration-line",
      "line-through",
    );
    await expect(declined).toHaveCSS("border-top-style", "dashed");

    await openViewSettings(page, "Week");
    await expect(setting(page, "Declined events")).toBeChecked();
    await setting(page, "Declined events").click();
    await page.keyboard.press("Escape");
    await expect(calendarEvent(page, "Vendor Demo")).toHaveCount(0);

    await runCommand(page, "declined", "Show declined events");
    await expect(declined).toBeVisible();
  });

  test("month view and the agenda hide them too", async ({ page }) => {
    await page.keyboard.press("m");
    const wednesday = monthCell(page, "2026-06-03");
    const monthItem = wednesday.getByRole("button", { name: /^Vendor Demo/ });
    await expect(monthItem).toBeVisible();
    await expect(monthItem.getByText("Vendor Demo")).toHaveCSS(
      "text-decoration-line",
      "line-through",
    );

    await runCommand(page, "declined", "Hide declined events");
    await expect(monthItem).toHaveCount(0);

    await page.keyboard.press("a");
    await page.keyboard.press("j");
    await expect(calendarEvent(page, "Vendor Demo")).toHaveCount(0);
    await runCommand(page, "declined", "Show declined events");
    const agendaItem = calendarEvent(page, "Vendor Demo");
    await expect(agendaItem).toBeVisible();
    await expect(agendaItem.getByText("Vendor Demo")).toHaveCSS(
      "text-decoration-line",
      "line-through",
    );
  });

  test("hiding the selected declined event closes its details", async ({
    page,
  }) => {
    await calendarEvent(page, "Vendor Demo").click();
    await expect(page.getByPlaceholder("Title")).toHaveValue("Vendor Demo");

    await runCommand(page, "declined", "Hide declined events");
    await expect(page.getByPlaceholder("Title")).toHaveCount(0);
  });
});

test("the year view's day counts leave hidden declined events out", async ({
  page,
}) => {
  await page.keyboard.press("y");
  const wednesday = page
    .getByRole("main")
    .getByRole("button", { name: /^Wednesday, June 3, \d+ events?$/ });
  const before = await wednesday.getAttribute("aria-label");
  const count = Number(before?.match(/(\d+) events?$/)?.[1]);

  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  await menu.getByPlaceholder("Type a command...").fill("declined");
  await menu.getByRole("option", { name: /^Hide declined events/ }).click();

  await expect(wednesday).toHaveAccessibleName(
    count - 1 === 1
      ? "Wednesday, June 3, 1 event"
      : `Wednesday, June 3, ${count - 1} events`,
  );
  // Not the box of a hidden column: still where it was
  expect((await boxOf(wednesday)).width).toBeGreaterThan(0);
});
