import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { FROZEN_NOW } from "../helpers";

/**
 * CalendarHeader, CommandMenu and the app keys of useCalendarShortcuts,
 * installed in the Base UI project. `/header` puts them together like the
 * live demo, with plain asides for the panels and a counter for the theme.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/header");
  await expect(title(page)).toHaveAccessibleName("June 2026 Week 23");
});

function title(page: Page) {
  return page.getByRole("main").getByRole("heading", { level: 1 });
}

test("the header's buttons switch the view and move by its period", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Month/ }).click();
  await expect(title(page)).toHaveAccessibleName("June 2026");

  await page.getByRole("button", { name: "Next month" }).click();
  await expect(title(page)).toHaveAccessibleName("July 2026");
  await page.getByRole("button", { name: "Today" }).click();
  await expect(title(page)).toHaveAccessibleName("June 2026");
});

test("the panel toggles open and close the app's panels", async ({ page }) => {
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const contextPanel = page.getByRole("complementary", {
    name: "Context panel",
  });
  const sidebarToggle = page.getByRole("button", {
    name: "Toggle Calendar Sidebar",
  });
  const contextPanelToggle = page.getByRole("button", {
    name: "Toggle Navigation Sidebar",
  });

  await sidebarToggle.hover();
  // Base UI's tooltip popup has no tooltip role
  await expect(page.getByText("Close sidebar")).toBeVisible();
  await sidebarToggle.click();
  await expect(sidebar).toHaveCount(0);

  await contextPanelToggle.click();
  await expect(contextPanel).toBeVisible();
  // The toggle hides while the panel is open
  await expect(contextPanelToggle).toHaveCount(0);
});

test("the app keys run the panels, the theme and the command menu", async ({
  page,
}) => {
  await page.keyboard.press("Meta+/");
  await expect(
    page.getByRole("complementary", { name: "Sidebar" }),
  ).toHaveCount(0);
  await page.keyboard.press("/");
  await expect(
    page.getByRole("complementary", { name: "Context panel" }),
  ).toBeVisible();
  await page.keyboard.press("Shift+M");
  await expect(page.getByLabel("Theme changes")).toHaveText("1");
  // Shift+M isn't the calendar's M
  await expect(title(page)).toHaveAccessibleName("June 2026 Week 23");

  await page.keyboard.press("ControlOrMeta+k");
  const menu = page.getByRole("dialog", { name: "Command Menu" });
  await expect(menu).toBeVisible();
  // Only the commands the app passed callbacks for, and no "Soon" ones
  await expect(
    menu.getByRole("option", { name: /Toggle sidebar/ }),
  ).toBeVisible();
  await expect(menu.getByRole("option", { name: /Import \.ics/ })).toHaveCount(
    0,
  );
  await expect(menu.getByRole("option", { name: /Create event/ })).toHaveCount(
    0,
  );

  await menu.getByPlaceholder("Type a command...").fill("agenda");
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Agenda", exact: true }),
  ).toBeVisible();
});
