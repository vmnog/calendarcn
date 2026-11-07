import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { FROZEN_NOW, calendarEvent } from "../helpers";

/**
 * Links and description in the event details popover of the registry
 * installed in a shadcn/ui project set up with Base UI. Their menu and
 * tooltips are the details' own layers, so the popover must take presses in
 * them as inside.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FROZEN_NOW);
  await page.goto("/");
  await expect(calendarEvent(page, "Design Review")).toBeVisible();
});

/** The event details popover */
function eventDetails(page: Page): Locator {
  return page.getByRole("dialog", { name: "Event details" });
}

test("a link is added from its menu, and the details stay open", async ({
  page,
}) => {
  await calendarEvent(page, "Design Review").click();
  const details = eventDetails(page);
  const links = details.locator('[data-section="links"]');

  await links
    .getByRole("button", { name: "Add links and attachments" })
    .click();
  await page.keyboard.type("https://example.com/brief");
  const menu = page.getByRole("listbox", { name: "Add links and attachments" });
  await menu.getByRole("option", { name: "https://example.com/brief" }).click();

  await expect(details).toBeVisible();
  await expect(
    links.getByRole("link", { name: "https://example.com/brief" }),
  ).toHaveAttribute("href", "https://example.com/brief");

  // Escape closes the menu first, then the details
  await links.getByRole("button", { name: "Paste link..." }).click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(details).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
});

test("the description is edited in place and kept on blur", async ({
  page,
}) => {
  await calendarEvent(page, "Design Review").click();
  const details = eventDetails(page);
  const description = details.locator('[data-section="description"]');

  await description.getByRole("textbox", { name: "Description" }).click();
  await page.keyboard.type("Agenda: https://example.com/agenda");
  await details.getByPlaceholder("Title").click();

  await expect(description).toHaveText("Agenda: https://example.com/agenda");
  await expect(
    details
      .locator('[data-section="links"]')
      .getByRole("link", { name: "https://example.com/agenda" }),
  ).toBeVisible();
});

test("links and files that come with the event open only web pages", async ({
  page,
}) => {
  await calendarEvent(page, "Link Check").click();
  const links = eventDetails(page).locator('[data-section="links"]');

  // React 19 blocks javascript: hrefs, but not data:, and React 18 neither
  for (const label of ["Script link", "Data link", "payload.html"]) {
    const row = links.getByText(label, { exact: true });
    await expect(row).toBeVisible();
    await expect(row).not.toHaveAttribute("href");
  }
  await expect(links.getByRole("link")).toHaveText(["Brief"]);
  await expect(links.getByRole("link", { name: "Brief" })).toHaveAttribute(
    "href",
    "https://example.com/brief",
  );
});
