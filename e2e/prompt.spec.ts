import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

/**
 * The Prompt tab beside Preview and Code on every docs example, and the
 * "Use with AI" page. What each example's prompt says is tested for every
 * example in `unit/prompt.spec.ts`; this spec checks the tab on the built
 * site.
 */

/** A component page with one example */
const WEEK_VIEW_PATH = "/docs/components/week-view";

/** A component page with several examples */
const CALENDAR_CORE_PATH = "/docs/components/calendar-core";

/** A guide, whose example belongs to the `ics` item */
const IMPORT_EXPORT_PATH = "/docs/import-export";

/** The "Use with AI" page */
const AI_PATH = "/docs/ai";

/** A tab of an example. Only the examples have Code and Prompt tabs */
function exampleTab(page: Page, name: string): Locator {
  return page.getByRole("tab", { name, exact: true });
}

/** The code of an example's Code or Prompt tab, once that tab is open */
function panelCode(page: Page, name: string): Locator {
  return page.getByRole("tabpanel", { name, exact: true }).locator("pre");
}

/** Opens an example's Prompt tab and returns the prompt's text */
async function openPrompt(page: Page): Promise<string> {
  await exampleTab(page, "Prompt").click();
  const prompt = panelCode(page, "Prompt");
  await expect(prompt).toBeVisible();
  return (await prompt.textContent()) ?? "";
}

test("an example has Preview, Code and Prompt tabs, in that order", async ({
  page,
}) => {
  await page.goto(WEEK_VIEW_PATH);

  const tabs = page
    .getByRole("tablist")
    .filter({ has: exampleTab(page, "Prompt") });
  await expect(tabs.getByRole("tab")).toHaveText(["Preview", "Code", "Prompt"]);
  // The preview stays the tab an example opens on
  await expect(exampleTab(page, "Preview")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator('[data-example="week-view-demo"]')).toBeVisible();
});

test("the prompt leads with the install command and holds the example's code and the rules", async ({
  page,
}) => {
  await page.goto(WEEK_VIEW_PATH);

  await exampleTab(page, "Code").click();
  const code = (await panelCode(page, "Code").textContent()) ?? "";
  expect(code).toContain("export function WeekViewDemo()");

  const prompt = await openPrompt(page);
  expect(prompt).toContain(code);
  expect(
    prompt.startsWith("Run `npx shadcn@latest add @calendarcn/week-view"),
  ).toBe(true);
  expect(prompt).toContain("## Rules");
  expect(prompt).toContain("Give its parent a height.");
  expect(prompt).toContain(
    "https://calendarcn.xyz/docs/components/week-view.md",
  );
});

test("the copy button puts the whole prompt on the clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(WEEK_VIEW_PATH);
  const prompt = await openPrompt(page);

  const panel = page.getByRole("tabpanel", { name: "Prompt", exact: true });
  await panel.getByRole("button", { name: "Copy Text" }).click();

  await expect(
    panel.getByRole("button", { name: "Copied Text" }),
  ).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe(prompt);
  expect(copied.startsWith("Run `npx shadcn@latest add @calendarcn/")).toBe(
    true,
  );
  expect(copied.endsWith("ask me which events to show.")).toBe(true);
});

test("long lines of the prompt wrap instead of scrolling sideways", async ({
  page,
}) => {
  await page.goto(WEEK_VIEW_PATH);
  await openPrompt(page);

  const overflow = await panelCode(page, "Prompt").evaluate((pre) => {
    const viewport = pre.parentElement;
    return viewport ? viewport.scrollWidth - viewport.clientWidth : -1;
  });
  expect(overflow).toBe(0);
  // Blank lines between the paragraphs keep their height
  const blankLine = panelCode(page, "Prompt").locator(".line").nth(1);
  await expect(blankLine).toHaveText("");
  expect((await blankLine.boundingBox())?.height).toBeGreaterThan(10);
});

test("every example on a page has its own prompt", async ({ page }) => {
  await page.goto(CALENDAR_CORE_PATH);

  const examples = await page.locator("[data-example]").count();
  expect(examples).toBeGreaterThan(1);
  await expect(exampleTab(page, "Prompt")).toHaveCount(examples);

  // The second example's prompt carries the second example's file
  await exampleTab(page, "Prompt").nth(1).click();
  await expect(panelCode(page, "Prompt")).toContainText(
    "src/examples/config-demo.tsx",
  );
});

test("a guide's prompt installs the guide's item and links the guide", async ({
  page,
}) => {
  await page.goto(IMPORT_EXPORT_PATH);
  const prompt = await openPrompt(page);

  expect(prompt).toContain("npx shadcn@latest add @calendarcn/ics");
  expect(prompt).toContain('from the "Import and Export" page of the docs');
  expect(prompt).toContain("https://calendarcn.xyz/docs/import-export.md");
});

test("Use with AI lists the MCP command for each client, the skill and the update prompt", async ({
  page,
}) => {
  await page.goto(AI_PATH);

  await expect(
    page.getByRole("heading", { level: 1, name: "Use with AI" }),
  ).toBeVisible();
  const article = page.locator("article");
  await expect(article).toContainText(
    "npx shadcn@latest mcp init --client claude",
  );

  for (const [client, command] of [
    ["Cursor", "npx shadcn@latest mcp init --client cursor"],
    ["VS Code", "npx shadcn@latest mcp init --client vscode"],
    ["OpenCode", "npx shadcn@latest mcp init --client opencode"],
    ["Codex", "[mcp_servers.shadcn]"],
  ]) {
    await page.getByRole("tab", { name: client, exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: client, exact: true }),
    ).toContainText(command);
  }

  // The Installation tabs' own prompt is named beside the examples' one
  await expect(article).toContainText(
    "The Installation section of each page has a Prompt tab too",
  );
  await expect(article).toContainText("npx skills add vmnog/calendarcn");
  await expect(article).toContainText(
    "Show me the components in the calendarcn registry",
  );
  await expect(article).toContainText(
    "npx shadcn@latest add @calendarcn/<item> --dry-run",
  );
});

test("the sidebar lists Use with AI right after Installation", async ({
  page,
}) => {
  await page.goto(AI_PATH);

  const links = page.locator("#nd-sidebar a");
  const titles = await links.allTextContents();
  const installation = titles.indexOf("Installation");
  expect(installation).toBeGreaterThan(-1);
  expect(titles[installation + 1]).toBe("Use with AI");
  await expect(links.nth(installation + 1)).toHaveAttribute("href", AI_PATH);
});
