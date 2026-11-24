import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, calendarEvent, openCalendar } from "./helpers";

/**
 * Every color is a CSS variable. On the Theming page, the first example sets
 * the calendar's own tokens (`--calendar-*`) and the second adds two event
 * colors (teal and rose). Both draw the docs' sample week around FROZEN_NOW:
 * "Team standup" on Monday June 1, 9 to 9:30 AM, is blue in the sample data
 * and teal in the second example; "Design review" that Monday and "Yoga" on
 * Friday June 5, 6 to 7 PM, are purple in the sample data and rose there. The live demo wears the Notion
 * Calendar theme, whose menus are dark in both modes.
 */

/** Path of the Theming page */
const THEMING_PATH = "/docs/guides/theming";

/** The Notion Calendar theme's menu surface, as a computed color */
const NOTION_MENU = "rgb(37, 37, 37)";

/** The Indigo example's `--calendar-menu` in light mode, as a computed color */
const INDIGO_MENU = "rgb(238, 242, 255)";

/** The Indigo example's `--calendar-detail-focus` in light mode */
const INDIGO_FOCUS = "rgb(238, 242, 255)";

/** The second example's teal in light mode: text, background and bar */
const TEAL = {
  text: "rgb(15, 118, 110)",
  background: "rgb(204, 251, 241)",
  border: "rgb(20, 184, 166)",
  strong: "rgb(19, 78, 74)",
};

/**
 * The second example's rose in light mode. It has no `-strong` and `-muted`
 * variables, so month view draws its title in its text color
 */
const ROSE = {
  text: "rgb(190, 18, 60)",
  background: "rgb(255, 228, 230)",
};

/** Blue's background in light mode, which a color without variables falls back to */
const BLUE_BACKGROUND = "rgb(226, 249, 255)";

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

/** What an element's own `style` sets a CSS variable to, as written */
function inlineVariable(locator: Locator, name: string): Promise<string> {
  return locator.evaluate(
    (element, property) =>
      (element as HTMLElement).style.getPropertyValue(property),
    name,
  );
}

/** Opens the Theming page with the clock frozen and returns one of its examples */
async function openExample(page: Page, name: string): Promise<Locator> {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto(THEMING_PATH);
  const example = page.locator(`[data-example="${name}"]`);
  await example.scrollIntoViewIfNeeded();
  await expect(
    example.getByRole("button", { name: /^Team standup/ }),
  ).toBeVisible();
  return example;
}

/** Switches an example's calendar to another view from its view dropdown */
async function switchView(page: Page, example: Locator, view: string) {
  await example
    .getByRole("button", { name: /^(Day|Week|Month|Year|Agenda)$/ })
    .click();
  await page.getByRole("menuitem", { name: new RegExp(`^${view}`) }).click();
}

test.describe("the calendar's own tokens", () => {
  test("the Theming page lists every token with its default and Notion's value", async ({
    page,
  }) => {
    await page.goto(THEMING_PATH);
    const row = page.getByRole("row").filter({ hasText: "--calendar-menu-" });
    await expect(row.first()).toBeVisible();

    const menu = page
      .getByRole("row")
      .filter({ has: page.getByText("--calendar-menu", { exact: true }) });
    await expect(menu).toContainText("var(--popover)");
    await expect(menu).toContainText("#252525");
    // The details, the menus, the accents, the views and the sidebars
    await expect(page.getByRole("table")).toHaveCount(7);
    await expect(
      page.getByText("--calendar-detail-focus", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("--calendar-sidebar-accent", { exact: true }),
    ).toBeVisible();
  });

  test("tokens set in CSS restyle the menus and the details' fields", async ({
    page,
  }) => {
    const example = await openExample(page, "theming-demo");
    const standup = example.getByRole("button", { name: /^Team standup/ });

    // Before: the docs site wears the Notion Calendar theme
    await standup.click({ button: "right" });
    const duplicate = page.getByRole("button", { name: /^Duplicate/ });
    const menu = duplicate.locator("xpath=..");
    await expect(menu).toHaveCSS("background-color", NOTION_MENU);
    await page.keyboard.press("Escape");

    await example.getByRole("button", { name: "Indigo tokens" }).click();
    expect(await resolveColor(page, "var(--calendar-menu)")).toBe(INDIGO_MENU);

    // The right-click menu, in a portal outside the example
    await standup.click({ button: "right" });
    await expect(menu).toHaveCSS("background-color", INDIGO_MENU);
    await expect(duplicate).toHaveCSS(
      "color",
      await resolveColor(page, "var(--calendar-menu-foreground)"),
    );
    await page.keyboard.press("Escape");

    // A details field's focus fill, and a menu opened from the details
    await standup.click();
    const details = page.getByRole("dialog");
    const title = details.getByPlaceholder("Title");
    await title.focus();
    await expect(title).toHaveCSS("background-color", INDIGO_FOCUS);
    await details.getByRole("button", { name: "More actions" }).click();
    await expect(page.getByRole("menu")).toHaveCSS(
      "background-color",
      INDIGO_MENU,
    );
    await page.keyboard.press("Escape");

    // Back to the page's own theme
    await example.getByRole("button", { name: "Your theme" }).click();
    expect(await resolveColor(page, "var(--calendar-menu)")).toBe(NOTION_MENU);
  });

  test("the live demo's menus and toasts read the menu tokens", async ({
    page,
  }) => {
    await openCalendar(page);
    const event = calendarEvent(page, "Quick Sync");
    await event.click({ button: "right" });
    const menu = page
      .getByRole("button", { name: /^Duplicate/ })
      .locator("xpath=..");
    await expect(menu).toHaveCSS("background-color", NOTION_MENU);

    // An app's CSS decides: one variable moves the menu and the toast
    await page.addStyleTag({ content: ":root { --calendar-menu: #0055aa; }" });
    await expect(menu).toHaveCSS("background-color", "rgb(0, 85, 170)");
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.locator('[data-slot="calendar-toast"]')).toHaveCSS(
      "background-color",
      "rgb(0, 85, 170)",
    );
  });
});

test.describe("event colors of your own", () => {
  test("a color backed by CSS variables draws in week, month and agenda view", async ({
    page,
  }) => {
    const example = await openExample(page, "event-color-demo");
    const standup = example.getByRole("button", { name: /^Team standup/ });

    // Week view: the event's own variables point at teal's
    expect(await inlineVariable(standup, "--event")).toBe(
      "var(--event-teal, var(--event-blue))",
    );
    const fill = standup.locator("div.bg-event-bg");
    await expect(fill).toHaveCSS("background-color", TEAL.background);
    await expect(standup.locator("div.bg-event-border")).toHaveCSS(
      "background-color",
      TEAL.border,
    );
    await expect(standup.getByText("Team standup")).toHaveCSS(
      "color",
      TEAL.text,
    );

    // Month view: the bar, and the title in the color's strong shade
    await switchView(page, example, "Month");
    const monthItem = example
      .getByRole("button", { name: /^Team standup/ })
      .first();
    await expect(monthItem.locator("div.bg-event-border")).toHaveCSS(
      "background-color",
      TEAL.border,
    );
    await expect(monthItem.getByText("Team standup")).toHaveCSS(
      "color",
      TEAL.strong,
    );

    // A color without the two shades: its title is in its text color
    const review = example
      .getByRole("button", { name: /^Design review/ })
      .first();
    await expect(review.getByText("Design review")).toHaveCSS(
      "color",
      ROSE.text,
    );

    // Agenda view lists the coming days: Friday's Yoga is filled with rose
    await switchView(page, example, "Agenda");
    const row = example.getByRole("button", { name: /^Yoga/ }).first();
    await expect(row).toHaveCSS("background-color", ROSE.background);
  });

  test("the pickers offer the provider's eventColors, and picking one recolors the event", async ({
    page,
  }) => {
    const example = await openExample(page, "event-color-demo");
    const planning = example.getByRole("button", { name: /^Sprint planning/ });

    await planning.click({ button: "right" });
    const menu = page
      .getByRole("button", { name: /^Duplicate/ })
      .locator("xpath=..");
    // The seven that ship, then teal and rose
    const swatches = menu.locator("button.bg-event-border");
    await expect(swatches).toHaveCount(9);
    await expect(swatches.nth(7)).toHaveCSS("background-color", TEAL.border);

    await swatches.nth(7).click();
    await expect(planning.locator("div.bg-event-bg")).toHaveCSS(
      "background-color",
      TEAL.background,
    );

    // The details' calendar menu names the colors by their name
    await planning.click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Calendar/ })
      .click();
    await expect(
      page.getByRole("menuitemradio", { name: "Teal" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      page.getByRole("menuitemradio", { name: "Rose" }),
    ).toBeVisible();
  });

  test("a color without variables falls back to blue", async ({ page }) => {
    const example = await openExample(page, "event-color-demo");
    const standup = example.getByRole("button", { name: /^Team standup/ });
    await expect(standup.locator("div.bg-event-bg")).toHaveCSS(
      "background-color",
      TEAL.background,
    );

    // Take the example's variables away: teal and rose mean nothing now
    await example.evaluate((element) => {
      element.querySelector("style")?.remove();
    });
    await expect(standup.locator("div.bg-event-bg")).toHaveCSS(
      "background-color",
      BLUE_BACKGROUND,
    );
  });
});
