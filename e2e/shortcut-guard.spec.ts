import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  CURRENT_WEEK_LABEL,
  calendarEvent,
  detailTitle,
  expectHeader,
  openCalendar,
} from "./helpers";

/**
 * Key presses the calendar's shortcuts leave alone: typing in a field that is
 * not an input or a textarea, Alt with an arrow (the browser's back and
 * forward), and the Enter that confirms an IME composition. They come from
 * isTypingTarget and handleShortcut in useCalendarShortcuts, and from
 * useInlineEdit.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** Adds an element to the page, as an app around the calendar would, and focuses it */
async function focusHostElement(page: Page, html: string): Promise<void> {
  await page.evaluate((markup) => {
    const template = document.createElement("template");
    template.innerHTML = markup;
    const element = template.content.firstElementChild;
    if (!(element instanceof HTMLElement)) throw new Error("No element");
    document.body.append(element);
    element.focus();
  }, html);
}

test("typing in a contenteditable element runs no shortcut", async ({
  page,
}) => {
  await focusHostElement(
    page,
    '<div contenteditable="true" data-testid="host-editor"></div>',
  );

  // "m" is the month view and "j" the previous week
  await page.keyboard.type("mj");

  await expectHeader(page, CURRENT_WEEK_LABEL);
  await expect(page.getByTestId("host-editor")).toHaveText("mj");
});

test("a key pressed on a select runs no shortcut", async ({ page }) => {
  await focusHostElement(
    page,
    '<select data-testid="host-select"><option>all</option><option>mine</option></select>',
  );
  await expect(page.getByTestId("host-select")).toBeFocused();

  await page.keyboard.press("m");

  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("Alt with an arrow key is left to the browser", async ({ page }) => {
  // Dispatched by hand: a real Alt+ArrowLeft would take the browser back
  const prevented = await page.evaluate(() =>
    ["ArrowLeft", "ArrowRight"].map((key) => {
      const event = new KeyboardEvent("keydown", {
        key,
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );

  expect(prevented).toEqual([false, false]);
  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("the Enter that confirms an IME composition keeps the title in edit", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  const title = detailTitle(page);
  await title.focus();

  // Chrome and Firefox flag the key with isComposing, Safari with keyCode 229
  const prevented = await title.evaluate((input) =>
    [{ isComposing: true }, { keyCode: 229 }].map((composing) => {
      const event = new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        ...composing,
      });
      input.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );

  expect(prevented).toEqual([false, false]);
  await expect(title).toBeFocused();
});
