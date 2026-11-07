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

test("Tab onto a link shows its address, and Tab reaches the copy button", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await calendarEvent(page, "Quick Sync").click();
  const links = linksSection(page);
  await links
    .getByRole("button", { name: "Add links and attachments" })
    .click();
  await page.keyboard.type("https://example.com");
  await page.keyboard.press("Enter");
  // Keep the pointer off the new row, so only focus opens its tooltip
  await page.mouse.move(0, 0);

  const link = links.getByRole("link", { name: "https://example.com" });
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  // Shift+Tab from the remove button after it, so the focus is the keyboard's
  const removeButton = links.getByRole("button", {
    name: "Remove https://example.com",
  });
  await removeButton.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(link).toBeFocused();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toHaveText("https://example.com");

  // The tooltip is portaled, but Tab goes into it and back out after the link
  await page.keyboard.press("Tab");
  await expect(
    tooltip.getByRole("button", { name: "Copy link" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    tooltip.getByRole("button", { name: "Link copied" }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "https://example.com",
  );
  await page.keyboard.press("Shift+Tab");
  await expect(link).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(removeButton).toBeFocused();
  await expect(tooltip).toHaveCount(0);
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

test("the description edits in place: its links join the list on blur, Escape puts it back", async ({
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

  // An address being typed stays out of the links list
  await page.keyboard.press("Enter");
  await page.keyboard.type("Notes: https://example.com/notes.");
  await expect(
    links.locator('[data-link-url^="https://example.com/n"]'),
  ).toHaveCount(0);

  // The editor grows with its text, and again when it gets narrower
  for (let line = 0; line < 4; line++) {
    await page.keyboard.press("Enter");
    await page.keyboard.type("More notes");
  }
  const grownHeight = (await editor.boundingBox())?.height ?? 0;
  expect(grownHeight).toBeGreaterThan(editorHeight);
  await editor.evaluate((textarea) => {
    textarea.style.width = "140px";
  });
  await expect
    .poll(async () => (await editor.boundingBox())?.height ?? 0)
    .toBeGreaterThan(grownHeight);

  // Escape puts the description back and keeps the event selected
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(description).toHaveText(original);
  await expect(links.getByRole("link", { name: /notes$/ })).toHaveCount(0);
  await expect(detailTitle(page)).toHaveValue("Launch Review");

  // Blur keeps the edit: its address reads as a link, and joins the list
  await description.getByRole("textbox", { name: "Description" }).click();
  await page.keyboard.type(" See https://example.com/brief");
  await detailTitle(page).click();
  await expect(description).toHaveText(
    `${original} See https://example.com/brief`,
  );
  const inlineLink = description.getByRole("link", {
    name: "https://example.com/brief",
  });
  await expect(inlineLink).toHaveAttribute("href", "https://example.com/brief");
  await expect(inlineLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(
    links.getByRole("link", { name: "https://example.com/brief" }),
  ).toBeVisible();
  await expect(
    links.getByRole("img", { name: "Linked in event description" }),
  ).toBeAttached();
});

test("a link in the description opens instead of the editor, and Tab still opens it", async ({
  page,
}) => {
  await page
    .context()
    .route("https://example.com/**", (route) =>
      route.fulfill({ contentType: "text/html", body: "<p>Brief</p>" }),
    );
  await calendarEvent(page, "Launch Review").click();
  const description = descriptionSection(page);
  const box = description.getByRole("textbox", { name: "Description" });
  await box.click();
  await page.keyboard.type(" See https://example.com/brief");
  await detailTitle(page).click();

  // Safari focuses the box, not the link, when the link is pressed
  await box.evaluate((element) => {
    element.addEventListener(
      "mousedown",
      (e) => {
        e.preventDefault();
        (element as HTMLElement).focus();
      },
      { capture: true },
    );
  });
  const popup = page.waitForEvent("popup");
  await description
    .getByRole("link", { name: "https://example.com/brief" })
    .click();
  expect((await popup).url()).toBe("https://example.com/brief");
  await expect(description.locator("textarea")).toHaveCount(0);

  // Focus that doesn't come from a press opens the editor
  await detailTitle(page).focus();
  await box.focus();
  await expect(description.locator("textarea")).toBeFocused();
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

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("the link menu opens inside the details sheet and its option can be tapped", async ({
    page,
  }) => {
    await calendarEvent(page, "Architecture Review").tap();
    const sheet = page.getByRole("dialog", { name: "Context panel" });
    const links = sheet.locator('[data-section="links"]');

    await links
      .getByRole("button", { name: "Add links and attachments" })
      .tap();
    await page.keyboard.type("https://example.com/brief");
    // Nothing fits left of a full-width sheet: the menu opens below the input
    const option = sheet
      .getByRole("listbox", { name: "Add links and attachments" })
      .getByRole("option", { name: "https://example.com/brief" });
    await option.tap();

    await expect(sheet).toBeVisible();
    const link = links.getByRole("link", { name: "https://example.com/brief" });
    await expect(link).toBeVisible();
    // Nothing hovers on a phone, so the remove button always shows
    await expect(
      links.getByRole("button", { name: "Remove https://example.com/brief" }),
    ).toHaveCSS("opacity", "1");
  });
});
