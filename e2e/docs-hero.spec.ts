import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW } from "./helpers";

/**
 * The Introduction's playable hero (`PlayableHero`): a week view that drags
 * one event by itself when it comes into view, opens its details, and hands
 * over with a hint. In the sample week (May 31 to June 6), "Customer call"
 * is on Wednesday June 3, 2 to 3 PM; the script moves it to Thursday June 4,
 * 3 to 4 PM.
 */

/** How long the script takes, start delay to hint, with room to spare */
const SCRIPT_MS = 6000;

/** The hero's calendar */
function hero(page: Page): Locator {
  return page.locator("[data-hero]");
}

/** The day column that holds the customer call, named by its date */
function customerCallColumn(page: Page): Locator {
  return hero(page)
    .locator('[role="group"][aria-label]:not([inert])')
    .filter({ has: page.locator('[data-event-id="sample-customer-call"]') });
}

/** The hint under the hero */
function hint(page: Page): Locator {
  return page.locator("[data-hero-hint]");
}

async function openIntroduction(page: Page): Promise<void> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/docs");
  await expect(customerCallColumn(page)).toHaveAccessibleName(
    /Wednesday, June 3/,
  );
}

test("the hero drags an event a day right and opens it, then hands over", async ({
  page,
}) => {
  await openIntroduction(page);

  await expect(customerCallColumn(page)).toHaveAccessibleName(
    /Thursday, June 4/,
    { timeout: SCRIPT_MS },
  );
  await expect(
    hero(page).locator('[data-event-id="sample-customer-call"]'),
  ).toHaveAccessibleName(/3:00 PM to 4:00 PM/);
  // Its details open, then the hint takes over from the cursor
  await expect(
    page
      .getByRole("dialog", { name: "Event details" })
      .locator("input")
      .first(),
  ).toHaveValue("Customer call");
  await expect(hint(page)).toBeVisible({ timeout: SCRIPT_MS });
  await expect(hint(page)).toContainText("Your turn");
  // The details close as the cursor leaves, so nothing covers the hint
  await expect(page.getByRole("dialog", { name: "Event details" })).toHaveCount(
    0,
  );

  // The question map stays below the hero
  const heroBox = await hero(page).boundingBox();
  const mapBox = await page
    .getByRole("navigation", { name: "Map" })
    .boundingBox();
  expect(mapBox!.y).toBeGreaterThan(heroBox!.y + heroBox!.height);
});

test("under reduced motion the hero only shows the hint", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openIntroduction(page);

  await expect(hint(page)).toBeVisible();
  await page.waitForTimeout(SCRIPT_MS / 2);
  await expect(customerCallColumn(page)).toHaveAccessibleName(
    /Wednesday, June 3/,
  );
});

test("pressing in the hero stops the script and gives control", async ({
  page,
}) => {
  await openIntroduction(page);
  const cursor = page.locator("[data-hero-cursor]");

  // Once the cursor is on its way, press the calendar's title
  await expect
    .poll(() => cursor.evaluate((element) => element.getAnimations().length))
    .toBeGreaterThan(0);
  const title = await hero(page).getByRole("heading").boundingBox();
  await page.mouse.move(title!.x + 8, title!.y + title!.height / 2);
  await page.mouse.down();
  await page.mouse.up();

  await page.waitForTimeout(SCRIPT_MS / 2);
  await expect(customerCallColumn(page)).toHaveAccessibleName(
    /Wednesday, June 3/,
  );
  await expect(cursor).toHaveCSS("opacity", "0");
  await expect(hint(page)).toBeHidden();
});
