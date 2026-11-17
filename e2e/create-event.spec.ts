import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  boxOf,
  calendarEvent,
  columnDistance,
  detailFields,
  detailTitle,
  draftTint,
  expectHeader,
  hourHeight,
  monthCell,
  openCalendar,
  slotPoint,
} from "./helpers";

/**
 * Creating events the way Notion Calendar does. In the frozen week
 * (May 31 - Jun 6) Sunday has no events, Friday Jun 5 is free until 4 PM,
 * and the all-day row is empty from Sunday to Thursday.
 */

/** A viewport position */
interface Point {
  x: number;
  y: number;
}

/** Events of the week grid without a title, named by the stand-in "Untitled event" */
function untitledEvent(page: Page): Locator {
  return calendarEvent(page, "Untitled event");
}

/** End date input of the event detail panel, shown for events that span days */
function detailEndDate(page: Page): Locator {
  return page.getByTestId("event-end-date");
}

/** A point in the all-day row, in the column of the header day `dayNumber` */
async function allDayPoint(page: Page, dayNumber: number): Promise<Point> {
  const main = page.getByRole("main");
  const day = await boxOf(main.getByText(String(dayNumber), { exact: true }));
  const label = await boxOf(main.getByText("All-day", { exact: true }));
  return { x: day.x + day.width / 2, y: label.y + label.height / 2 };
}

/** The empty middle of a month cell, under its day number and events */
async function monthCellPoint(page: Page, isoDate: string): Promise<Point> {
  const cell = await boxOf(monthCell(page, isoDate));
  return { x: cell.x + cell.width / 2, y: cell.y + cell.height - 12 };
}

/** Waits until an element has stopped moving, e.g. after a view switch slides the grid */
async function waitUntilStill(locator: Locator): Promise<void> {
  let previous = "";
  await expect
    .poll(async () => {
      const box = await boxOf(locator);
      const current = `${box.x},${box.width}`;
      const isStill = current === previous;
      previous = current;
      return isStill;
    })
    .toBe(true);
}

/** Presses at `from` and moves to `to` in small steps, without releasing */
async function pressAndMove(page: Page, from: Point, to: Point): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test.describe("the time grid", () => {
  test("a single click on an empty slot creates nothing and clears the selection", async ({
    page,
  }) => {
    await calendarEvent(page, "Architecture Review").click();
    await expect(detailTitle(page)).toHaveValue("Architecture Review");

    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.click(slot.x, slot.y);

    await expect(detailTitle(page)).toHaveCount(0);
    await expect(draftTint(page)).toHaveCount(0);
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("a double-click starts an untitled 30-minute draft with its title focused", async ({
    page,
  }) => {
    // 2:10 PM snaps to the nearest quarter hour, 2:15
    const slot = await slotPoint(page, 5, "2 PM", 10);
    await page.mouse.dblclick(slot.x, slot.y);

    // Drawn as a tinted range, not as an event
    await expect(draftTint(page)).toHaveCount(1);
    await expect(untitledEvent(page)).toHaveCount(0);

    // Selected: the details show it, untitled, with the title focused
    const title = detailTitle(page);
    await expect(title).toHaveValue("");
    await expect(title).toBeFocused();
    const fields = detailFields(page);
    await expect(fields.startTime).toHaveValue("2:15 PM");
    await expect(fields.endTime).toHaveValue("2:45 PM");
    await expect(fields.startDate).toHaveValue("Fri Jun 5");
    // Nothing is stored yet: there is nothing to cut, copy or delete
    await expect(
      page.getByRole("button", { name: "More actions" }),
    ).toHaveCount(0);
  });

  test("a double-click with an event selected starts a draft too", async ({
    page,
  }) => {
    await calendarEvent(page, "Architecture Review").click();
    await expect(detailTitle(page)).toHaveValue("Architecture Review");

    const slot = await slotPoint(page, 5, "1 PM");
    await page.mouse.dblclick(slot.x, slot.y);

    await expect(draftTint(page)).toHaveCount(1);
    await expect(detailTitle(page)).toHaveValue("");
    await expect(detailFields(page).startTime).toHaveValue("1 PM");
  });

  test("typing a title turns the draft into an event, and Enter saves it", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await expect(detailTitle(page)).toBeFocused();

    // The first keystroke swaps the tint for a selected event block that
    // shows the title as it is typed; focus stays in the title
    await page.keyboard.type("Quarterly review");
    await expect(draftTint(page)).toHaveCount(0);
    const created = calendarEvent(page, "Quarterly review");
    await expect(created).toHaveAccessibleName(
      "Quarterly review, 2:00 PM to 2:30 PM, Friday, June 5",
    );
    await expect(created).toHaveAttribute("aria-pressed", "true");
    await expect(detailTitle(page)).toBeFocused();

    // Enter saves it: the title loses focus, the event stays selected, and
    // now there is something to cut, copy or delete
    await page.keyboard.press("Enter");
    await expect(detailTitle(page)).not.toBeFocused();
    await expect(detailTitle(page)).toHaveValue("Quarterly review");
    await expect(
      page.getByRole("button", { name: "More actions" }),
    ).toBeVisible();

    // It is a stored event: still there once the selection is cleared
    await page.keyboard.press("Escape");
    await expect(detailTitle(page)).toHaveCount(0);
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("aria-pressed", "false");
  });

  test("Escape leaves the title first, then throws the draft away", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await expect(detailTitle(page)).toBeFocused();

    // First Escape: out of the title, the draft stays
    await page.keyboard.press("Escape");
    await expect(detailTitle(page)).not.toBeFocused();
    await expect(draftTint(page)).toHaveCount(1);
    await expect(detailFields(page).startTime).toHaveValue("2 PM");

    // Second Escape: gone, and nothing was created
    await page.keyboard.press("Escape");
    await expect(draftTint(page)).toHaveCount(0);
    await expect(detailTitle(page)).toHaveCount(0);
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("Escape takes a typed title back without saving the draft", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await page.keyboard.type("Never mind");
    await expect(calendarEvent(page, "Never mind")).toBeVisible();

    // Escape never commits: the title is taken back, the draft is a tinted
    // range again
    await page.keyboard.press("Escape");
    await expect(detailTitle(page)).toHaveValue("");
    await expect(calendarEvent(page, "Never mind")).toHaveCount(0);
    await expect(draftTint(page)).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(draftTint(page)).toHaveCount(0);
    await expect(calendarEvent(page, "Never mind")).toHaveCount(0);
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("Enter on an untitled draft only leaves the title", async ({ page }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await expect(detailTitle(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(detailTitle(page)).not.toBeFocused();
    await expect(draftTint(page)).toHaveCount(1);
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("a click elsewhere throws an untouched draft away", async ({ page }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await expect(draftTint(page)).toHaveCount(1);

    const elsewhere = await slotPoint(page, 31, "11 AM");
    await page.mouse.click(elsewhere.x, elsewhere.y);

    await expect(draftTint(page)).toHaveCount(0);
    await expect(detailTitle(page)).toHaveCount(0);
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("a click elsewhere saves a draft that was named", async ({ page }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await page.keyboard.type("Vet appointment");

    const elsewhere = await slotPoint(page, 31, "11 AM");
    await page.mouse.click(elsewhere.x, elsewhere.y);

    // Saved and no longer selected
    await expect(detailTitle(page)).toHaveCount(0);
    const created = calendarEvent(page, "Vet appointment");
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("aria-pressed", "false");
  });

  test("selecting another event throws an untouched draft away", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await expect(draftTint(page)).toHaveCount(1);

    await calendarEvent(page, "Architecture Review").click();

    await expect(draftTint(page)).toHaveCount(0);
    await expect(detailTitle(page)).toHaveValue("Architecture Review");
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("the first edit of another field saves the draft, untitled", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await expect(draftTint(page)).toHaveCount(1);

    // Move it to another calendar: that stores it
    await page.locator('[data-section="calendar"]').getByRole("button").click();
    await page
      .getByRole("menu", { name: "Calendar" })
      .getByRole("menuitemradio", { name: "Work", exact: true })
      .click();

    await expect(draftTint(page)).toHaveCount(0);
    const created = untitledEvent(page);
    await expect(created).toHaveAccessibleName(
      "Untitled event, 2:00 PM to 2:30 PM, Friday, June 5",
    );
    await expect(
      page.getByRole("button", { name: "More actions" }),
    ).toBeVisible();

    // Still there after the selection is cleared
    await page.keyboard.press("Escape");
    await expect(created).toBeVisible();
  });

  test("dragging down draws a draft that follows the pointer", async ({
    page,
  }) => {
    const from = await slotPoint(page, 5, "1 PM");
    const to = await slotPoint(page, 5, "2 PM", 40);
    await pressAndMove(page, from, to);

    // While the button is down: the range is tinted and the details follow
    // it, snapped to the nearest quarter hour, without taking focus yet
    await expect(draftTint(page)).toHaveCount(1);
    const fields = detailFields(page);
    await expect(fields.startTime).toHaveValue("1 PM");
    await expect(fields.endTime).toHaveValue("2:45 PM");
    await expect(detailTitle(page)).not.toBeFocused();
    const hour = await hourHeight(page);
    expect((await boxOf(draftTint(page))).height).toBeCloseTo(hour * 1.75, 0);

    // On release it stays a draft, with the title focused
    await page.mouse.up();
    await expect(draftTint(page)).toHaveCount(1);
    await expect(detailTitle(page)).toBeFocused();
    await expect(fields.startTime).toHaveValue("1 PM");
    await expect(fields.endTime).toHaveValue("2:45 PM");
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("dragging up moves the start and keeps the pressed time as the end", async ({
    page,
  }) => {
    const from = await slotPoint(page, 5, "2 PM", 30);
    const to = await slotPoint(page, 5, "1 PM", 10);
    await pressAndMove(page, from, to);
    await page.mouse.up();

    const fields = detailFields(page);
    await expect(fields.startTime).toHaveValue("1:15 PM");
    await expect(fields.endTime).toHaveValue("2:30 PM");
    await expect(fields.startDate).toHaveValue("Fri Jun 5");
    await expect(detailTitle(page)).toBeFocused();
  });

  test("dragging onto another day draws one draft across the days between", async ({
    page,
  }) => {
    // Sunday 11 AM to Tuesday 12 PM
    const from = await slotPoint(page, 31, "11 AM");
    const to = await slotPoint(page, 2, "12 PM");
    await pressAndMove(page, from, to);

    // Sunday from 11 AM, all of Monday, Tuesday until noon
    await expect(draftTint(page)).toHaveCount(3);
    await page.mouse.up();

    const fields = detailFields(page);
    await expect(fields.startTime).toHaveValue("11 AM");
    await expect(fields.endTime).toHaveValue("12 PM");
    await expect(fields.startDate).toHaveValue("Sun May 31");
    await expect(detailEndDate(page)).toHaveValue("Tue Jun 2");
    await expect(detailTitle(page)).toBeFocused();
  });

  test("a drag keeps at least one snap step", async ({ page }) => {
    // Six pixels is a drag, but less than half a quarter hour
    const from = await slotPoint(page, 5, "1 PM");
    await pressAndMove(page, from, { x: from.x, y: from.y + 6 });
    await page.mouse.up();

    const fields = detailFields(page);
    await expect(fields.startTime).toHaveValue("1 PM");
    await expect(fields.endTime).toHaveValue("1:15 PM");
  });

  test("Escape in the middle of a drag drops the draft", async ({ page }) => {
    const from = await slotPoint(page, 5, "1 PM");
    const to = await slotPoint(page, 5, "3 PM");
    await pressAndMove(page, from, to);
    await expect(draftTint(page)).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(draftTint(page)).toHaveCount(0);
    await expect(detailTitle(page)).toHaveCount(0);

    // Moving on and releasing brings nothing back
    await page.mouse.move(to.x, to.y + 30, { steps: 4 });
    await page.mouse.up();
    await expect(draftTint(page)).toHaveCount(0);
    await expect(detailTitle(page)).toHaveCount(0);
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("the draft survives moving to another week and back", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    // Out of the title, so the keys below go to the calendar
    await page.keyboard.press("Escape");
    await expect(draftTint(page)).toHaveCount(1);

    await page.keyboard.press("k");
    await expectHeader(page, "June 2026 Week 24");
    await expect(detailFields(page).startDate).toHaveValue("Fri Jun 5");

    await page.keyboard.press("j");
    await expectHeader(page, "June 2026 Week 23");
    await expect(draftTint(page)).toHaveCount(1);
    await expect(draftTint(page)).toBeInViewport();
  });

  test("Cmd+Z takes a saved draft back, and Shift+Cmd+Z brings it back", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    await page.keyboard.type("Budget sync");
    await page.keyboard.press("Enter");
    const created = calendarEvent(page, "Budget sync");
    await expect(created).toBeVisible();

    // One step, with the title it was saved with
    await page.keyboard.press("ControlOrMeta+z");
    await expect(created).toHaveCount(0);
    await expect(draftTint(page)).toHaveCount(0);

    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(created).toHaveAccessibleName(
      "Budget sync, 2:00 PM to 2:30 PM, Friday, June 5",
    );
  });

  test("a long press with a finger starts a draft", async ({ page }) => {
    const slot = await slotPoint(page, 31, "11 AM", 20);
    // Sunday's column is a group named by its date
    const column = page
      .getByRole("main")
      .getByRole("group", { name: "Sunday, May 31" });
    const touch = {
      pointerType: "touch",
      pointerId: 7,
      isPrimary: true,
      button: 0,
      clientX: slot.x,
      clientY: slot.y,
    };

    // A tap creates nothing
    await column.dispatchEvent("pointerdown", touch);
    await page.evaluate((init) => {
      window.dispatchEvent(new PointerEvent("pointerup", init));
    }, touch);
    await expect(draftTint(page)).toHaveCount(0);

    // Resting the finger does: a 30-minute draft at the pressed slot
    await column.dispatchEvent("pointerdown", touch);
    await expect(draftTint(page)).toHaveCount(1);
    await expect(detailFields(page).startTime).toHaveValue("11:15 AM");
    await expect(detailFields(page).endTime).toHaveValue("11:45 AM");

    await page.evaluate((init) => {
      window.dispatchEvent(new PointerEvent("pointerup", init));
    }, touch);
    await expect(draftTint(page)).toHaveCount(1);
    await expect(detailTitle(page)).toBeFocused();
  });
});

test.describe("the all-day row", () => {
  test("a single click creates nothing", async ({ page }) => {
    const day = await allDayPoint(page, 2);
    await page.mouse.click(day.x, day.y);

    await expect(draftTint(page)).toHaveCount(0);
    await expect(detailTitle(page)).toHaveCount(0);
  });

  test("a double-click starts an all-day draft on that day", async ({
    page,
  }) => {
    const day = await allDayPoint(page, 2);
    await page.mouse.dblclick(day.x, day.y);

    await expect(draftTint(page)).toHaveCount(1);
    await expect(detailTitle(page)).toBeFocused();
    await expect(page.getByRole("switch", { name: "All-day" })).toBeChecked();
    await expect(detailFields(page).startDate).toHaveValue("Tue Jun 2");
    await expect(detailEndDate(page)).toHaveValue("Tue Jun 2");

    // Naming it saves an all-day event
    await page.keyboard.type("Offsite");
    await page.keyboard.press("Enter");
    await expect(calendarEvent(page, "Offsite")).toHaveAccessibleName(
      "Offsite, all day, Tuesday, June 2",
    );
  });

  test("dragging across days draws an all-day draft over them", async ({
    page,
  }) => {
    const from = await allDayPoint(page, 1);
    const to = await allDayPoint(page, 3);
    await pressAndMove(page, from, to);

    await expect(draftTint(page)).toHaveCount(1);
    await expect(detailFields(page).startDate).toHaveValue("Mon Jun 1");
    await expect(detailEndDate(page)).toHaveValue("Wed Jun 3");
    // Three day columns wide
    const tint = await boxOf(draftTint(page));
    const column = await columnDistance(page, 1, 2);
    expect(tint.width).toBeGreaterThan(column * 2.9);
    expect(tint.width).toBeLessThan(column * 3.1);

    await page.mouse.up();
    await expect(detailTitle(page)).toBeFocused();
    await expect(page.getByRole("switch", { name: "All-day" })).toBeChecked();
  });

  test("dragging backwards draws the same days", async ({ page }) => {
    const from = await allDayPoint(page, 3);
    const to = await allDayPoint(page, 1);
    await pressAndMove(page, from, to);
    await page.mouse.up();

    await expect(detailFields(page).startDate).toHaveValue("Mon Jun 1");
    await expect(detailEndDate(page)).toHaveValue("Wed Jun 3");
  });
});

test.describe("month view", () => {
  test.beforeEach(async ({ page }) => {
    await page.keyboard.press("m");
    await expectHeader(page, "June 2026");
  });

  test("a single click on a day creates nothing", async ({ page }) => {
    const day = await monthCellPoint(page, "2026-06-10");
    await page.mouse.click(day.x, day.y);

    await expect(draftTint(page)).toHaveCount(0);
    await expect(detailTitle(page)).toHaveCount(0);
  });

  test("a double-click on a day starts an all-day draft that tints its cell", async ({
    page,
  }) => {
    const day = await monthCellPoint(page, "2026-06-10");
    await page.mouse.dblclick(day.x, day.y);

    await expect(draftTint(page)).toHaveCount(1);
    await expect(
      monthCell(page, "2026-06-10").locator('[data-slot="event-draft"]'),
    ).toBeVisible();
    await expect(detailTitle(page)).toBeFocused();
    await expect(page.getByRole("switch", { name: "All-day" })).toBeChecked();
    await expect(detailFields(page).startDate).toHaveValue("Wed Jun 10");

    // Naming it saves an all-day event on that day
    await page.keyboard.type("Launch day");
    await expect(draftTint(page)).toHaveCount(0);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Escape");
    await expect(
      monthCell(page, "2026-06-10").getByRole("button", { name: /Launch day/ }),
    ).toBeVisible();
  });

  test("dragging across days draws an all-day draft over them, into the next week", async ({
    page,
  }) => {
    // Thursday Jun 11 to Tuesday Jun 16
    const from = await monthCellPoint(page, "2026-06-11");
    const to = await monthCellPoint(page, "2026-06-16");
    await pressAndMove(page, from, to);

    await expect(draftTint(page)).toHaveCount(6);
    await expect(detailFields(page).startDate).toHaveValue("Thu Jun 11");
    await expect(detailEndDate(page)).toHaveValue("Tue Jun 16");

    await page.mouse.up();
    await expect(detailTitle(page)).toBeFocused();

    // Escape, twice: out of the title, then the draft is gone
    await page.keyboard.press("Escape");
    await expect(draftTint(page)).toHaveCount(6);
    await page.keyboard.press("Escape");
    await expect(draftTint(page)).toHaveCount(0);
  });
});

test.describe("with the context panel closed", () => {
  test.beforeEach(async ({ page }) => {
    await page.keyboard.press("/");
    // The header's toggle only shows while the panel is closed
    await expect(
      page.getByRole("button", { name: "Toggle Navigation Sidebar" }),
    ).toBeVisible();
  });

  test("the draft's details open in a popover that stays open while it is named and saved", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);

    const popover = page.getByRole("dialog", { name: "Event details" });
    await expect(popover).toBeVisible();
    const title = popover.getByPlaceholder("Title");
    await expect(title).toBeFocused();

    // Typing never loses focus: not when the tint becomes an event, nor
    // when a description is typed, which saves the draft
    await page.keyboard.type("Planning");
    await expect(title).toBeFocused();
    await expect(calendarEvent(page, "Planning")).toBeVisible();

    await page.keyboard.press("Enter");
    await expect(popover).toBeVisible();
    await expect(title).toHaveValue("Planning");

    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(calendarEvent(page, "Planning")).toBeVisible();
  });

  test("Escape leaves the title first, then closes the popover and throws the draft away", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    const popover = page.getByRole("dialog", { name: "Event details" });
    await expect(popover.getByPlaceholder("Title")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(popover).toBeVisible();
    await expect(popover.getByPlaceholder("Title")).not.toBeFocused();
    await expect(draftTint(page)).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(draftTint(page)).toHaveCount(0);
    await expect(untitledEvent(page)).toHaveCount(0);
  });

  test("a press outside the popover saves a draft that was named", async ({
    page,
  }) => {
    const slot = await slotPoint(page, 5, "2 PM");
    await page.mouse.dblclick(slot.x, slot.y);
    const popover = page.getByRole("dialog", { name: "Event details" });
    await expect(popover.getByPlaceholder("Title")).toBeFocused();
    await page.keyboard.type("Standup notes");

    const elsewhere = await slotPoint(page, 31, "11 AM");
    await page.mouse.click(elsewhere.x, elsewhere.y);

    await expect(popover).toHaveCount(0);
    const created = calendarEvent(page, "Standup notes");
    await expect(created).toBeVisible();
    await expect(created).toHaveAttribute("aria-pressed", "false");
  });

  test("in month view the popover opens beside the day and stays through the save", async ({
    page,
  }) => {
    await page.keyboard.press("m");
    await expectHeader(page, "June 2026");
    const day = await monthCellPoint(page, "2026-06-10");
    await page.mouse.dblclick(day.x, day.y);

    const popover = page.getByRole("dialog", { name: "Event details" });
    const title = popover.getByPlaceholder("Title");
    await expect(title).toBeFocused();
    await expect(
      popover.getByRole("switch", { name: "All-day" }),
    ).toBeChecked();

    await page.keyboard.type("Release");
    await expect(title).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(popover).toBeVisible();
    await expect(
      monthCell(page, "2026-06-10").getByRole("button", { name: /Release/ }),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
  });

  test("in day view the popover opens at the grid's edge", async ({ page }) => {
    await page.keyboard.press("d");
    await expectHeader(page, "June 2026 Thursday, Jun 4");
    // The grid slides to its one day: wait until that column has stopped
    await waitUntilStill(
      page.getByRole("main").getByRole("group", { name: "Thursday, June 4" }),
    );
    const slot = await slotPoint(page, 4, "3 PM");
    await page.mouse.dblclick(slot.x, slot.y);

    const popover = page.getByRole("dialog", { name: "Event details" });
    await expect(popover.getByPlaceholder("Title")).toBeFocused();
    await expect(popover.getByTestId("event-start-time")).toHaveValue("3 PM");
    await expect(draftTint(page)).toHaveCount(1);
    await expect(popover).toBeInViewport();
  });

  test("the popover waits for a drag to end", async ({ page }) => {
    const from = await slotPoint(page, 5, "1 PM");
    const to = await slotPoint(page, 5, "2 PM");
    await pressAndMove(page, from, to);

    const popover = page.getByRole("dialog", { name: "Event details" });
    await expect(draftTint(page)).toHaveCount(1);
    await expect(popover).toHaveCount(0);

    await page.mouse.up();
    await expect(popover).toBeVisible();
    await expect(popover.getByPlaceholder("Title")).toBeFocused();
  });
});
