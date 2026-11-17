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
 * Scheduling in the demo: marking open times on the week grid (Notion
 * Calendar's one-off link times) and copying them as text. The tests run on
 * Thursday June 4 2026 in America/New_York (EDT), so Friday June 5 is
 * "tomorrow". The demo passes no `onCreateSchedulingLink`, so the scheduling
 * link commands aren't offered (e2e/base-ui/scheduling.spec.ts covers them).
 */

/** The scheduling panel in the context panel */
function schedulingPanel(page: Page): Locator {
  return page.getByTestId("availability-panel");
}

/** The snippet text the panel shows and Copy copies */
function snippet(page: Page): Locator {
  return page.getByTestId("availability-snippet");
}

/** The layer for marking times on one day, e.g. "Friday, June 5" */
function markingDay(page: Page, fullDate: string): Locator {
  return page.getByRole("group", {
    name: `Mark available times on ${fullDate}`,
  });
}

/** A marked time on the grid, by its day and times */
function markedTime(page: Page, fullDate: string, times: string): Locator {
  return page.getByRole("group", { name: `Available ${fullDate}, ${times}` });
}

/** The toast inside the toaster */
function toast(page: Page): Locator {
  return page
    .getByRole("region", { name: "Notifications" })
    .locator('[data-slot="calendar-toast"]');
}

/** Viewport Y of a time of day (in hours) on a day's marking layer */
async function yAt(page: Page, day: Locator, hour: number): Promise<number> {
  const box = await boxOf(day);
  return box.y + hour * (await hourHeight(page));
}

/** Drags with the mouse on a day from one time to another (in hours) */
async function markWithMouse(
  page: Page,
  day: Locator,
  fromHour: number,
  toHour: number,
): Promise<void> {
  const box = await boxOf(day);
  const x = box.x + box.width / 2;
  await page.mouse.move(x, await yAt(page, day, fromHour));
  await page.mouse.down();
  await page.mouse.move(x, await yAt(page, day, toHour), { steps: 8 });
  await page.mouse.up();
}

/** Clicks a day at a time (in hours) */
async function clickAt(page: Page, day: Locator, hour: number): Promise<void> {
  const box = await boxOf(day);
  await page.mouse.click(box.x + box.width / 2, await yAt(page, day, hour));
}

test.describe("marking open times", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openCalendar(page);
  });

  test("S starts it, and Escape leaves the grid as it was", async ({
    page,
  }) => {
    await page.keyboard.press("s");

    await expect(
      schedulingPanel(page).getByRole("heading", {
        name: "Share availability",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Mark available times on your calendar"),
    ).toBeVisible();
    await expect(snippet(page)).toHaveText("No times marked");
    await expect(page.getByTestId("availability-layer")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Scheduling" }),
    ).toHaveAttribute("aria-pressed", "true");

    const friday = markingDay(page, "Friday, June 5");
    await markWithMouse(page, friday, 10.1, 10.9);
    await expect(markedTime(page, "Friday, June 5", "10-11 AM")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(schedulingPanel(page)).toHaveCount(0);
    await expect(page.getByTestId("availability-layer")).toHaveCount(0);
    await expect(
      page.getByText("Mark available times on your calendar"),
    ).toHaveCount(0);
    await expect(page.getByText("Useful shortcuts")).toBeVisible();

    // Clicking an empty slot creates an event again, and events open again
    await calendarEvent(page, "Architecture Review").click();
    await expect(detailTitle(page)).toHaveValue("Architecture Review");
  });

  test("two days of times, one removed and undone, copy as Notion's text", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Scheduling" }).click();
    await expect(schedulingPanel(page)).toBeVisible();

    const friday = markingDay(page, "Friday, June 5");
    const saturday = markingDay(page, "Saturday, June 6");
    // A drag marks the slots it crosses; a click marks one meeting length
    await markWithMouse(page, friday, 10.1, 11.85);
    await clickAt(page, friday, 14.1);
    await markWithMouse(page, saturday, 9.1, 9.85);

    await expect(snippet(page)).toHaveText(
      [
        "Would 30 min during any of these times (all in EDT) work for you?",
        "- Tomorrow Fri Jun 5, 10 AM - 12 PM or 2-2:30 PM",
        "- Sat Jun 6, 9-10 AM",
      ].join("\n"),
    );
    await expect(page.getByTestId("availability-range-card")).toHaveCount(3);

    // Removing a time shows Notion's toast, and Undo puts it back
    await markedTime(page, "Saturday, June 6", "9-10 AM")
      .getByRole("button", { name: "Remove 9-10 AM" })
      .click();
    await expect(toast(page)).toContainText("Time range deleted");
    await expect(page.getByTestId("availability-range-card")).toHaveCount(2);
    await toast(page).getByRole("button", { name: "Undo" }).click();
    await expect(markedTime(page, "Saturday, June 6", "9-10 AM")).toBeVisible();

    // The panel's × removes it too
    await schedulingPanel(page)
      .getByRole("button", { name: "Remove 9 AM to 10 AM" })
      .click();
    await expect(markedTime(page, "Saturday, June 6", "9-10 AM")).toHaveCount(
      0,
    );

    const text = [
      "Would 30 min during any of these times (all in EDT) tomorrow Fri Jun 5 work for you?",
      "- 10 AM - 12 PM",
      "- 2-2:30 PM",
    ].join("\n");
    await expect(snippet(page)).toHaveText(text);

    await schedulingPanel(page)
      .getByRole("button", { name: "Copy", exact: true })
      .click();
    await expect(toast(page)).toContainText("Availability copied to clipboard");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      text,
    );
    // Copy finishes: the grid and the panel are back
    await expect(schedulingPanel(page)).toHaveCount(0);
    await expect(page.getByTestId("availability-layer")).toHaveCount(0);
  });

  test("the snippet's copy button copies and keeps marking", async ({
    page,
  }) => {
    await page.keyboard.press("s");
    await markWithMouse(page, markingDay(page, "Saturday, June 6"), 9.1, 9.85);
    await expect(snippet(page)).toHaveText(
      "Would 30 min anytime Sat Jun 6, 9-10 AM (EDT) work for you?",
    );

    await page.getByRole("button", { name: "Copy snippet" }).click();
    await expect(toast(page)).toContainText("Availability copied to clipboard");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Would 30 min anytime Sat Jun 6, 9-10 AM (EDT) work for you?",
    );
    await expect(schedulingPanel(page)).toBeVisible();
  });

  test("a marked time resizes, moves, and merges with one it touches", async ({
    page,
  }) => {
    await page.keyboard.press("s");
    const friday = markingDay(page, "Friday, June 5");
    await markWithMouse(page, friday, 10.1, 10.85);
    const block = markedTime(page, "Friday, June 5", "10-11 AM");
    await expect(block).toBeVisible();

    // Its bottom edge, dragged an hour down
    const box = await boxOf(block);
    const hour = await hourHeight(page);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height - 2 + hour,
      {
        steps: 6,
      },
    );
    await page.mouse.up();
    const resized = markedTime(page, "Friday, June 5", "10 AM - 12 PM");
    await expect(resized).toBeVisible();

    // Its middle, dragged an hour down
    const resizedBox = await boxOf(resized);
    await page.mouse.move(
      resizedBox.x + 40,
      resizedBox.y + resizedBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      resizedBox.x + 40,
      resizedBox.y + resizedBox.height / 2 + hour,
      {
        steps: 6,
      },
    );
    await page.mouse.up();
    await expect(
      markedTime(page, "Friday, June 5", "11 AM - 1 PM"),
    ).toBeVisible();

    // A time that starts where it ends joins it
    await markWithMouse(page, friday, 13.1, 13.85);
    await expect(
      markedTime(page, "Friday, June 5", "11 AM - 2 PM"),
    ).toBeVisible();
    await expect(page.getByTestId("availability-range-card")).toHaveCount(1);

    // A click selects it, and Delete removes it
    await markedTime(page, "Friday, June 5", "11 AM - 2 PM").click({
      position: { x: 40, y: 60 },
    });
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("availability-range-card")).toHaveCount(0);
    await expect(snippet(page)).toHaveText("No times marked");
  });

  test("events can't be opened or created while marking", async ({ page }) => {
    await page.keyboard.press("s");
    const event = calendarEvent(page, "Architecture Review");
    const eventBox = await boxOf(event);
    await page.mouse.click(eventBox.x + 20, eventBox.y + 10);

    await expect(detailTitle(page)).toHaveCount(0);
    await expect(page.getByTestId("availability-range-card")).toHaveCount(1);
    await expect(event).toBeVisible();
  });

  test("the duration sets the meeting the text asks for, and a click's length", async ({
    page,
  }) => {
    await page.keyboard.press("s");
    await page.getByRole("button", { name: "Duration: 30 min" }).click();
    await page.getByRole("menuitem", { name: "1 hour", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Duration: 1 hour" }),
    ).toBeVisible();

    await clickAt(page, markingDay(page, "Friday, June 5"), 15.1);
    await expect(snippet(page)).toHaveText(
      "Would 1 hour anytime tomorrow Fri Jun 5, 3-4 PM (EDT) work for you?",
    );
  });

  test("starting from month view marks on the week grid", async ({ page }) => {
    await page.keyboard.press("m");
    await expect(
      page.getByRole("button", { name: "Month", exact: true }),
    ).toBeVisible();

    await page.keyboard.press("s");
    await expect(
      page.getByRole("button", { name: "Week", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("availability-layer")).toBeVisible();
  });

  test("the command menu shares availability, without link commands", async ({
    page,
  }) => {
    await page.keyboard.press("ControlOrMeta+k");
    const menu = page.getByRole("dialog", { name: "Command Menu" });
    await expect(
      menu.getByRole("option", { name: /Share availability/ }),
    ).toBeVisible();
    await expect(
      menu.getByRole("option", { name: /scheduling link/ }),
    ).toHaveCount(0);

    await menu.getByRole("option", { name: /Share availability/ }).click();
    await expect(menu).toHaveCount(0);
    await expect(schedulingPanel(page)).toBeVisible();
  });
});

test.describe("phones", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openCalendar(page);
  });

  test("the sidebar starts it, a long press marks a time, and the hint copies", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Toggle Calendar Sidebar" }).click();
    const sheet = page.getByRole("dialog", { name: "Calendar sidebar" });
    await sheet.getByRole("button", { name: "Scheduling" }).click();
    await expect(sheet).toHaveCount(0);

    const hint = page.getByTestId("availability-hint");
    await expect(hint).toContainText("Mark available times on your calendar");
    await expect(hint.getByRole("button", { name: "Copy" })).toBeDisabled();

    // A finger resting on Thursday at 4 PM: a long press marks one meeting length
    const thursday = markingDay(page, "Thursday, June 4");
    const box = await boxOf(thursday);
    const x = box.x + box.width / 2;
    const y = await yAt(page, thursday, 16.1);
    await thursday.dispatchEvent("pointerdown", {
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      button: 0,
      clientX: x,
      clientY: y,
    });
    await page.waitForTimeout(500);
    await page.evaluate(
      ({ clientX, clientY }) => {
        window.dispatchEvent(
          new PointerEvent("pointerup", {
            pointerType: "touch",
            pointerId: 7,
            isPrimary: true,
            clientX,
            clientY,
          }),
        );
      },
      { clientX: x, clientY: y },
    );

    await expect(hint).toContainText("1 time marked");
    // The click a touch gesture is followed by is swallowed for 400ms; a
    // finger takes longer than that to tap again
    await page.waitForTimeout(500);
    await hint.getByRole("button", { name: "Copy" }).click();
    await expect(toast(page)).toContainText("Availability copied to clipboard");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      "Would 30 min anytime today Thu Jun 4, 4-4:30 PM (EDT) work for you?",
    );
    await expect(hint).toHaveCount(0);
  });
});
