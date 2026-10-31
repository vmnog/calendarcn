import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * Frozen "now" for every test: Thursday, June 4 2026, 8:00 AM in the
 * America/New_York zone set in playwright.config.ts.
 *
 * The mock data is generated relative to today (today is day 4 of the
 * Sunday-started week), so this pins the demo to the week of May 31 - Jun 6:
 * the week, the month view and the mini calendar all show June, and every
 * event below lands on a fixed date.
 */
export const FROZEN_NOW = new Date("2026-06-04T08:00:00-04:00");

/** Header label of the week containing FROZEN_NOW */
export const CURRENT_WEEK_LABEL = "June 2026 Week 23";

/**
 * Loads the demo with the clock frozen at FROZEN_NOW and waits until the
 * client-only calendar has rendered.
 */
export async function openCalendar(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/");
  await expect(calendarHeader(page)).toBeVisible();
}

/** Month / year / week label at the top of the calendar */
export function calendarHeader(page: Page): Locator {
  return page.getByRole("main").getByRole("heading", { level: 1 });
}

/**
 * Asserts the header's accessible name, which leaves out the parts hidden
 * at the current width (e.g. the short month name on narrow headers).
 */
export async function expectHeader(page: Page, label: string): Promise<void> {
  await expect(calendarHeader(page)).toHaveAccessibleName(label);
}

/**
 * An event block in the calendar, matched by title. Week view renders a week
 * of buffer days on each side, so pick titles that occur once in that range
 * (or check `toBeInViewport` for the visible one).
 */
export function calendarEvent(page: Page, title: string): Locator {
  return page
    .getByRole("main")
    .getByRole("button", { name: new RegExp(`^${escapeRegExp(title)}`) });
}

/** A month-view day cell, by its `data-date` (yyyy-MM-dd) */
export function monthCell(page: Page, isoDate: string): Locator {
  return page.locator(`[data-date="${isoDate}"]`);
}

/** Title input of the event detail panel (popover, context panel or sheet) */
export function detailTitle(page: Page): Locator {
  return page.getByPlaceholder("Title");
}

/** Start time, end time and start date inputs of the event detail panel */
export function detailFields(page: Page) {
  return {
    startTime: page.getByTestId("event-start-time"),
    endTime: page.getByTestId("event-end-time"),
    startDate: page.getByTestId("event-start-date"),
  };
}

/** Bounding box of a locator, failing the test when it isn't rendered */
export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${locator} is not rendered`);
  return box;
}

/**
 * Pixel height of one hour in the week grid, measured between two time axis
 * labels so it follows the grid's dynamic hour height.
 */
export async function hourHeight(page: Page): Promise<number> {
  const main = page.getByRole("main");
  const ten = await boxOf(main.getByText("10 AM", { exact: true }));
  const eleven = await boxOf(main.getByText("11 AM", { exact: true }));
  return eleven.y - ten.y;
}

/**
 * Horizontal distance between two day columns in week view, measured between
 * their header day numbers (unique within the rendered three weeks).
 */
export async function columnDistance(
  page: Page,
  fromDayNumber: number,
  toDayNumber: number,
): Promise<number> {
  const main = page.getByRole("main");
  const from = await boxOf(
    main.getByText(String(fromDayNumber), { exact: true }),
  );
  const to = await boxOf(main.getByText(String(toDayNumber), { exact: true }));
  return to.x - from.x;
}

/**
 * Presses at a point inside `locator`, moves by (dx, dy) in small steps and
 * releases, like a user dragging with the mouse. `offsetX` / `offsetY` place
 * the press from the element's top-left corner (default: its center).
 */
export async function dragBy(
  page: Page,
  locator: Locator,
  delta: { dx: number; dy: number; offsetX?: number; offsetY?: number },
): Promise<void> {
  const box = await boxOf(locator);
  const startX = box.x + (delta.offsetX ?? box.width / 2);
  const startY = box.y + (delta.offsetY ?? box.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + delta.dx, startY + delta.dy, { steps: 12 });
  await page.mouse.up();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
