import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import { calendarEvent, detailTitle, openCalendar } from "./helpers";

/** The links and attachments section of the context panel */
function linksSection(page: Page): Locator {
  return page.locator('[data-section="links"]');
}

/** The description section of the context panel */
function descriptionSection(page: Page): Locator {
  return page.locator('[data-section="description"]');
}

/** The add-link input ("Paste link...") */
function linkInput(page: Page): Locator {
  return page.getByRole("combobox", { name: "Paste link" });
}

/** The menu beside the add-link input */
function linkMenu(page: Page): Locator {
  return page.getByRole("listbox", { name: "Add links and attachments" });
}

test.beforeEach(async ({ page }) => {
  await openCalendar(page);
});

test("a typed link is added, text that isn't a link is dropped, and a link is removed", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  const links = linksSection(page);
  await expect(links).toHaveText("Add links and attachments");

  // The row turns into an input, with the menu beside the panel
  await links
    .getByRole("button", { name: "Add links and attachments" })
    .click();
  await expect(linkInput(page)).toBeFocused();
  await expect(linkMenu(page).getByRole("option")).toHaveText([
    "Attach fileUpload from your computer",
  ]);
  const panelLeft = (await links.boundingBox())?.x ?? 0;
  const menuBox = await linkMenu(page).boundingBox();
  expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(
    panelLeft,
  );

  // A link is offered as soon as it's typed, and Enter adds it
  await page.keyboard.type("https://example.com");
  await expect(
    linkMenu(page).getByRole("option", { name: "https://example.com" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  const link = links.getByRole("link", { name: "https://example.com" });
  await expect(link).toHaveAttribute("href", "https://example.com");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(
    links.getByRole("button", { name: "Paste link..." }),
  ).toBeVisible();

  // Text that isn't a link: no menu, and Enter drops it
  await links.getByRole("button", { name: "Paste link..." }).click();
  await page.keyboard.type("Project brief");
  await expect(linkMenu(page)).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(linkInput(page)).toHaveCount(0);
  await expect(links.getByRole("link")).toHaveCount(1);
  await expect(
    links.getByRole("button", { name: "Add links and attachments" }),
  ).toBeVisible();

  // Hovering a link shows its address; its remove button takes it out
  await link.hover();
  await expect(page.getByRole("tooltip")).toHaveText("https://example.com");
  await links
    .getByRole("button", { name: "Remove https://example.com" })
    .click();
  await expect(links).toHaveText("Add links and attachments");
});

test("Escape closes the link menu, then leaves the input, and the event stays selected", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  const links = linksSection(page);
  await links
    .getByRole("button", { name: "Add links and attachments" })
    .click();
  await page.keyboard.type("https://example.com");

  await page.keyboard.press("Escape");
  await expect(linkMenu(page)).toHaveCount(0);
  await expect(linkInput(page)).toBeFocused();

  // The typed link is dropped, not added
  await page.keyboard.press("Escape");
  await expect(linkInput(page)).toHaveCount(0);
  await expect(links).toHaveText("Add links and attachments");
  await expect(detailTitle(page)).toHaveValue("Quick Sync");
});

test("a file is attached from the link menu, with its size, and removed", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  const links = linksSection(page);
  await links
    .getByRole("button", { name: "Add links and attachments" })
    .click();

  const fileChooser = page.waitForEvent("filechooser");
  await linkMenu(page)
    .getByRole("option", { name: /^Attach file/ })
    .click();
  await (
    await fileChooser
  ).setFiles({
    name: "agenda.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(2400),
  });

  await expect(links.getByRole("link", { name: "agenda.pdf" })).toBeVisible();
  await expect(links).toContainText("2.4 KB");
  await links.getByRole("link", { name: "agenda.pdf" }).hover();
  await links.getByRole("button", { name: "Remove agenda.pdf" }).click();
  await expect(links).toHaveText("Add links and attachments");
});

test("the description edits in place: its links join the list, Escape puts it back, blur keeps it", async ({
  page,
}) => {
  const original =
    "Walk through the launch checklist, then sign off on the release notes.";
  await calendarEvent(page, "Launch Review").click();
  const description = descriptionSection(page);
  const links = linksSection(page);
  await expect(description).toHaveText(original);

  // Clicking opens an editor three lines tall at least
  await description.getByRole("textbox", { name: "Description" }).click();
  const editor = description.locator("textarea");
  await expect(editor).toBeFocused();
  const editorHeight = (await editor.boundingBox())?.height ?? 0;
  expect(editorHeight).toBeGreaterThanOrEqual(72);

  // An address typed in the description shows with the links, marked
  await page.keyboard.press("Enter");
  await page.keyboard.type("Notes: https://example.com/notes.");
  await expect(
    links.getByRole("link", { name: "https://example.com/notes" }),
  ).toBeVisible();
  await expect(
    links.getByRole("img", { name: "Linked in event description" }),
  ).toBeAttached();

  // The editor grows with its text
  for (let line = 0; line < 4; line++) {
    await page.keyboard.press("Enter");
    await page.keyboard.type("More notes");
  }
  expect((await editor.boundingBox())?.height ?? 0).toBeGreaterThan(
    editorHeight,
  );

  // Escape puts the description back and keeps the event selected
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(description).toHaveText(original);
  await expect(links.getByRole("link", { name: /notes$/ })).toHaveCount(0);
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  // Blur keeps the edit, and its address reads as a link
  await description.getByRole("textbox", { name: "Description" }).click();
  await page.keyboard.type(" See https://example.com/brief");
  await detailTitle(page).click();
  await expect(description).toHaveText(
    `${original} See https://example.com/brief`,
  );
  await expect(
    description.getByRole("link", { name: "https://example.com/brief" }),
  ).toHaveAttribute("href", "https://example.com/brief");
});

test("an empty description shows Notion's placeholder and grows to three lines when edited", async ({
  page,
}) => {
  await calendarEvent(page, "Quick Sync").click();
  const description = descriptionSection(page);
  await expect(description).toHaveText("Description");
  const restHeight = (await description.boundingBox())?.height ?? 0;
  // One 32px box in a 35px row, as Notion's
  expect(restHeight).toBe(35);

  await description.getByRole("textbox", { name: "Description" }).click();
  const editor = description.locator("textarea");
  await expect(editor).toHaveAttribute("placeholder", "Description");
  expect((await editor.boundingBox())?.height ?? 0).toBe(72);

  // Leaving it empty keeps the placeholder
  await page.keyboard.press("Escape");
  await expect(description).toHaveText("Description");
});
