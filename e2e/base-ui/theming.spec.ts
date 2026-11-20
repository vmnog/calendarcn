import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, calendarEvent, detailTitle } from "../helpers";

/**
 * The calendar's colors in a stock shadcn/ui project (e2e/base-ui/fixture),
 * which doesn't add the Notion Calendar theme: every calendar token points
 * at the project's own shadcn/ui tokens, so the details, the menus, the
 * toasts and the sidebars wear its theme. `/calendar-app` renders the live
 * demo's block with its sample data.
 */

/** Opens `/calendar-app` on the frozen test date, in light or dark mode */
async function openCalendarApp(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/calendar-app");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
}

/** What a CSS color expression computes to on the page, e.g. `var(--popover)` */
async function resolveColor(page: Page, expression: string): Promise<string> {
  return page.evaluate((value) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = value;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, expression);
}

/** The right-click menu, found from one of its actions */
function contextMenu(page: Page): Locator {
  return page.getByRole("button", { name: /^Duplicate/ }).locator("xpath=..");
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme, viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
      await openCalendarApp(page);
    });

    test("the project's CSS got the calendar's tokens, pointing at its own", async ({
      page,
    }) => {
      const tokens = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return {
          menu: style.getPropertyValue("--calendar-menu").trim(),
          popover: style.getPropertyValue("--popover").trim(),
          sidebar: style.getPropertyValue("--calendar-sidebar").trim(),
          appSidebar: style.getPropertyValue("--sidebar").trim(),
        };
      });
      // A custom property that points at another computes to its value
      expect(tokens.menu).toBe(tokens.popover);
      expect(tokens.sidebar).toBe(tokens.appSidebar);
    });

    test("menus and toasts sit on the project's popover color", async ({
      page,
    }) => {
      const popover = await resolveColor(page, "var(--popover)");
      const foreground = await resolveColor(page, "var(--popover-foreground)");

      await calendarEvent(page, "Quick Sync").click({ button: "right" });
      await expect(contextMenu(page)).toHaveCSS("background-color", popover);
      await expect(page.getByRole("button", { name: /^Duplicate/ })).toHaveCSS(
        "color",
        foreground,
      );

      await page.getByRole("button", { name: "Copy", exact: true }).click();
      await expect(page.locator('[data-slot="calendar-toast"]')).toHaveCSS(
        "background-color",
        popover,
      );
    });

    test("the details wear the project's foreground, accent and popover", async ({
      page,
    }) => {
      await calendarEvent(page, "Launch Review").click();
      const title = detailTitle(page);
      await expect(title).toHaveCSS(
        "color",
        await resolveColor(page, "var(--foreground)"),
      );
      await title.focus();
      await expect(title).toHaveCSS(
        "background-color",
        await resolveColor(page, "var(--accent)"),
      );

      await page
        .getByRole("button", { name: "More actions", exact: true })
        .click();
      await expect(page.getByRole("menu")).toHaveCSS(
        "background-color",
        await resolveColor(page, "var(--popover)"),
      );
    });

    test("the sidebars wear the project's sidebar and background colors", async ({
      page,
    }) => {
      // The calendar sidebar's own element, and the details sidebar's
      const sidebar = page
        .locator('[data-slot="mini-calendar"]')
        .locator(
          "xpath=ancestor::*[contains(concat(' ', normalize-space(@class), ' '), ' bg-sidebar ')][1]",
        );
      await expect(sidebar).toHaveCSS(
        "background-color",
        await resolveColor(page, "var(--sidebar)"),
      );
      const panel = page
        .locator('[data-slot="sidebar-inner"]')
        .filter({ hasText: "Useful shortcuts" });
      await expect(panel).toHaveCSS(
        "background-color",
        await resolveColor(page, "var(--background)"),
      );
    });

    test("an event keeps its own color, whatever the theme", async ({
      page,
    }) => {
      const event = calendarEvent(page, "Quick Sync");
      await expect(event.locator("div.bg-event-bg")).toHaveCSS(
        "background-color",
        await resolveColor(page, "var(--event-blue-bg)"),
      );
    });
  });
}
