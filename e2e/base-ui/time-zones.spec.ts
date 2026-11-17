import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW } from "../helpers";

/**
 * The time zone controls of `@calendarcn/calendar-app` installed in the
 * Base UI project: the "+" and label menus (popovers with a command list),
 * the command menu's zone lists, the travel x and its tooltip. The browser
 * runs in New York; the clock is frozen at Thursday June 4 2026, 8:00 AM.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/calendar-app");
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
});

/** The label above a time zone column, by its short label */
function zoneLabel(page: Page, label: string): Locator {
  return page.getByRole("main").getByRole("button", {
    name: new RegExp(`^${label.replace("+", "\\+")} .* time zone$`),
  });
}

test("the + adds a zone, and its label's menu makes it primary or removes it", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add time zone" }).click();
  await page.getByRole("textbox", { name: "Time zone" }).fill("Tokyo");
  await page.getByRole("option", { name: /Tokyo/ }).first().click();
  await expect(zoneLabel(page, "GMT+9")).toBeVisible();

  await zoneLabel(page, "GMT+9").click();
  await page.getByRole("option", { name: "Make time zone primary" }).click();
  // Lunch at 12:30 PM in New York is 1:30 AM on Friday in Tokyo
  await expect(
    page.getByRole("button", { name: /^Lunch with Sarah,/ }),
  ).toHaveAccessibleName(
    "Lunch with Sarah, 1:30 AM to 2:30 AM, Friday, June 5",
  );

  await zoneLabel(page, "EDT").click();
  await page
    .getByRole("option", { name: "Remove time zone from list" })
    .click();
  await expect(zoneLabel(page, "EDT")).toHaveCount(0);
  await expect(zoneLabel(page, "GMT+9")).toBeVisible();
});

test("Z travels from the command menu, and the x travels back", async ({
  page,
}) => {
  await page.keyboard.press("z");
  await expect(page.getByRole("dialog").getByRole("combobox")).toHaveAttribute(
    "placeholder",
    "Travel to time zone...",
  );
  await page.keyboard.type("Tokyo");
  await page.getByRole("option", { name: /Tokyo/ }).first().click();
  await expect(zoneLabel(page, "GMT+9")).toBeVisible();

  const back = page.getByRole("button", { name: "Travel back home" });
  await back.hover();
  // Base UI's tooltip popup has no tooltip role. It ends with the Esc key
  await expect(page.getByText(/^Travel back home/)).toBeVisible();
  await back.click();
  await expect(zoneLabel(page, "GMT+9")).toHaveCount(0);
});
