import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { CURRENT_WEEK_LABEL, expectHeader, openCalendar } from "./helpers";

/**
 * The demo's own keys and header buttons, on top of the calendar's: the
 * sidebar (Cmd+/), the context panel (/), the theme (Shift+M) and the
 * command menu (Cmd+K). They come from useCalendarShortcuts' app options,
 * CalendarHeader and CommandMenu.
 */

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

/** The mini calendar's month grid, in the calendar sidebar (closing it slides it off-screen) */
function sidebarMiniCalendar(page: Page) {
  return page.getByRole("grid").first();
}

test("Cmd+/ and the header's toggle close and open the sidebar", async ({
  page,
}) => {
  const toggle = page.getByRole("button", { name: "Toggle Calendar Sidebar" });
  await toggle.hover();
  await expect(page.getByRole("tooltip")).toContainText("Close sidebar");

  await page.keyboard.press("Meta+/");
  await expect(sidebarMiniCalendar(page)).not.toBeInViewport();

  await toggle.click();
  await expect(sidebarMiniCalendar(page)).toBeInViewport();
});

test("/ closes the context panel and shows the header's toggle to reopen it", async ({
  page,
}) => {
  const toggle = page.getByRole("button", {
    name: "Toggle Navigation Sidebar",
  });
  // Wide screens open with the context panel, so its toggle is hidden
  await expect(toggle).toHaveCount(0);

  await page.keyboard.press("/");
  await expect(toggle).toBeVisible();

  await toggle.click();
  await expect(toggle).toHaveCount(0);
});

test("Shift+M cycles the theme: light, dark, then system", async ({ page }) => {
  const html = page.locator("html");

  await page.keyboard.press("Shift+M");
  await expect(html).toHaveClass(/\blight\b/);
  await page.keyboard.press("Shift+M");
  await expect(html).toHaveClass(/\bdark\b/);
  await page.keyboard.press("Shift+M");
  // The test browser prefers light
  await expect(html).toHaveClass(/\blight\b/);
  // Shift+M never reaches the calendar's M (month view)
  await expectHeader(page, CURRENT_WEEK_LABEL);
});

test("the command menu runs a command, and keys typed in it stay in it", async ({
  page,
}) => {
  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  const input = menu.getByPlaceholder("Type a command...");
  await expect(input).toBeFocused();

  // "/" and "m" are typed, not the context panel or month view shortcuts
  await input.fill("");
  await page.keyboard.type("/m");
  await expect(input).toHaveValue("/m");
  await expect(
    page.getByRole("button", { name: "Toggle Navigation Sidebar" }),
  ).toHaveCount(0);

  await input.fill("display month");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expectHeader(page, "June 2026");

  // Cmd+K toggles: a second press closes it
  await page.keyboard.press("ControlOrMeta+k");
  await expect(menu).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(menu).toBeHidden();
});
