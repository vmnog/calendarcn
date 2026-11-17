import { expect, test } from "@playwright/test";

/**
 * The docs as an AI assistant reads them: `/llms.txt`, `/llms-full.txt`, every
 * page as Markdown at its URL plus `.md`, the "Copy Markdown" and "Open"
 * buttons on each page, the Prompt tab of the Installation tabs,
 * `/sitemap.xml` and `/robots.txt`.
 */

/** Origin the absolute URLs in these files start with */
const SITE_URL = "https://calendarcn.xyz";

/** A docs page whose Markdown the tests read closely */
const WEEK_VIEW_PATH = "/docs/components/week-view";

/** MDX components that must reach the Markdown in a Markdown form, never as a tag */
const MDX_COMPONENT_TAGS = [
  "<ComponentPreview",
  "<InstallTabs",
  "<PropsTable",
  "<Kbd",
  "<Card",
];

/** Pages with one live example, and the file its Code tab shows */
const EXAMPLE_PAGES = [
  { path: WEEK_VIEW_PATH, file: "src/examples/week-view-demo.tsx" },
  { path: "/docs/loading-events", file: "src/examples/range-loading-demo.tsx" },
  { path: "/docs/import-export", file: "src/examples/ics-demo.tsx" },
];

/** Pages with Installation tabs, and the registry item their Prompt tab installs */
const INSTALL_PAGES = [
  { path: WEEK_VIEW_PATH, item: "week-view", title: "Week View" },
  // A guide, whose item has no page of its own
  { path: "/docs/import-export", item: "ics", title: "ICS Import and Export" },
];

/** Paths of the docs pages `/sitemap.xml` lists */
function getSitemapDocsPaths(sitemap: string): string[] {
  return Array.from(sitemap.matchAll(/<loc>([^<]+)<\/loc>/g), ([, url]) =>
    url.slice(SITE_URL.length),
  ).filter((path) => path.startsWith("/docs"));
}

/** Markdown without its code blocks and inline code, where a `<Tag>` is only source */
function stripCode(markdown: string): string {
  return markdown
    .replace(/^[ \t]*(`{3,})[^\n]*\n[\s\S]*?\n[ \t]*\1[ \t]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

/** The code block of a Markdown page that is titled with a file's path */
function getTitledCodeBlock(markdown: string, title: string): string {
  const fence = `\`\`\`tsx title="${title}"\n`;
  const start = markdown.indexOf(fence) + fence.length;
  return markdown.slice(start, markdown.indexOf("\n```", start));
}

test("llms.txt lists every docs page with its Markdown URL", async ({
  request,
}) => {
  const response = await request.get("/llms.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const index = await response.text();

  expect(index).toContain("# CalendarCN");
  expect(index).toContain("npx shadcn add @calendarcn/calendar");
  expect(index).toContain(`${SITE_URL}/r/registry.json`);
  expect(index).toContain(`${SITE_URL}/llms-full.txt`);
  // The sidebar's groups
  for (const group of ["Getting Started", "Guides", "Components"]) {
    expect(index).toContain(`## ${group}`);
  }

  const sitemap = await (await request.get("/sitemap.xml")).text();
  const paths = getSitemapDocsPaths(sitemap);
  expect(paths.length).toBeGreaterThan(20);
  for (const path of paths) {
    expect(index).toContain(`](${SITE_URL}${path}.md)`);
  }
  // No link to a page the docs don't have
  expect(index.match(/^- \[/gm)).toHaveLength(paths.length);
});

test("a docs page is served as Markdown at its URL plus .md", async ({
  request,
}) => {
  const response = await request.get(`${WEEK_VIEW_PATH}.md`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe(
    "text/markdown; charset=utf-8",
  );
  const markdown = await response.text();

  // The title and the description open the file
  expect(markdown).toMatch(
    /^# Week View\n\nA week, or any number of days, on the time grid\.\n/,
  );
  // InstallTabs: the CLI command and the Manual tab's steps
  expect(markdown).toContain("npx shadcn add @calendarcn/week-view");
  expect(markdown).toContain("`@calendarcn/time-grid`");
  expect(markdown).toContain(
    "[`components/week-view.tsx`](https://github.com/vmnog/calendarcn/blob/main/src/components/week-view.tsx)",
  );
  // ComponentPreview: where the example runs, then its source
  expect(markdown).toContain(`${SITE_URL}${WEEK_VIEW_PATH}`);
  expect(markdown).toContain("export function WeekViewDemo");
  // PropsTable: a table with a row per prop
  expect(markdown).toContain("| Prop | Type | Default | Description |");
  expect(markdown).toMatch(/^\| `scrollToHour` \| `number` \| – \| Hour /m);
});

test("the introduction is served at /docs.md, and .mdx answers like .md", async ({
  request,
}) => {
  const introduction = await request.get("/docs.md");
  expect(introduction.status()).toBe(200);
  expect(await introduction.text()).toMatch(/^# Introduction\n/);

  const markdown = await (await request.get(`${WEEK_VIEW_PATH}.md`)).text();
  const mdx = await request.get(`${WEEK_VIEW_PATH}.mdx`);
  expect(mdx.status()).toBe(200);
  expect(await mdx.text()).toBe(markdown);

  expect((await request.get("/docs/not-a-page.md")).status()).toBe(404);
});

test("a docs URL answers with Markdown when the request asks for it", async ({
  request,
}) => {
  const markdown = await (await request.get(`${WEEK_VIEW_PATH}.md`)).text();

  const asked = await request.get(WEEK_VIEW_PATH, {
    headers: { Accept: "text/markdown, text/html;q=0.9" },
  });
  expect(asked.headers()["content-type"]).toBe("text/markdown; charset=utf-8");
  expect(await asked.text()).toBe(markdown);

  // A browser's request still gets the page
  const browser = await request.get(WEEK_VIEW_PATH, {
    headers: { Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
  });
  expect(browser.headers()["content-type"]).toContain("text/html");
});

test("llms-full.txt holds every page, with no MDX component left as a tag", async ({
  request,
}) => {
  const response = await request.get("/llms-full.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const full = await response.text();

  for (const tag of MDX_COMPONENT_TAGS) {
    expect(full).not.toContain(tag);
  }
  // Nor any other component: one without a Markdown form is printed as JSX
  expect(stripCode(full).match(/<[A-Z][A-Za-z]*/g)).toBeNull();

  // Sidebar order: the introduction first, then the pages as the sidebar lists them
  expect(full).toMatch(/^# Introduction\n/);
  const order = ["# Installation", "# Changelog", "# Calendar", "# Week View"];
  const positions = order.map((heading) => full.indexOf(`\n${heading}\n`));
  expect(positions.every((position) => position > 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));

  // A page's part of the file is its own Markdown
  const markdown = await (await request.get(`${WEEK_VIEW_PATH}.md`)).text();
  expect(full).toContain(markdown);
});

for (const { path, file } of EXAMPLE_PAGES) {
  test(`${path}.md holds the code of the page's Code tab`, async ({
    page,
    request,
  }) => {
    const markdown = await (await request.get(`${path}.md`)).text();
    expect(markdown).toContain(`\`\`\`tsx title="${file}"\n`);

    await page.goto(path);
    await page.getByRole("tab", { name: "Code", exact: true }).click();
    const code = page
      .locator("figure", {
        has: page.locator("figcaption", { hasText: file }),
      })
      .locator("pre");
    await expect(code).toBeVisible();

    expect(getTitledCodeBlock(markdown, file)).toBe(await code.textContent());
  });
}

test("a docs page has Copy Markdown and an Open menu linking its Markdown", async ({
  page,
  context,
  request,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(WEEK_VIEW_PATH);

  await page.getByRole("button", { name: "Copy Markdown" }).click();
  await expect(
    page.getByRole("button", { name: "Copied Markdown" }),
  ).toBeVisible();
  const markdown = await (await request.get(`${WEEK_VIEW_PATH}.md`)).text();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    markdown,
  );

  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View as Markdown" }),
  ).toHaveAttribute("href", `${WEEK_VIEW_PATH}.md`);
  await expect(
    page.getByRole("link", { name: "Open in GitHub" }),
  ).toHaveAttribute(
    "href",
    "https://github.com/vmnog/calendarcn/blob/main/content/docs/components/week-view.mdx",
  );
  // Assistants are sent to the Markdown on the live site
  const prompt = encodeURIComponent(`${SITE_URL}${WEEK_VIEW_PATH}.md`);
  for (const name of ["ChatGPT", "Claude", "Cursor", "Scira AI"]) {
    await expect(
      page.getByRole("link", { name: `Open in ${name}` }),
    ).toHaveAttribute("href", new RegExp(prompt));
  }
});

for (const { path, item, title } of INSTALL_PAGES) {
  test(`the Installation tabs on ${path} have a Prompt to paste into an assistant`, async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(path);

    // The Installation tabs: CLI, Manual, Prompt. Examples have tabs of their own
    const tabs = page.getByRole("tablist").filter({ hasText: "Manual" });
    const tab = tabs.getByRole("tab", { name: "Prompt", exact: true });
    await tab.click();
    const panel = page.locator(
      `[id="${await tab.getAttribute("aria-controls")}"]`,
    );

    const prompt =
      `Run \`npx shadcn add @calendarcn/${item}\` in this project to install CalendarCN's ${title}. ` +
      `If the command fails, read ${SITE_URL}/docs/installation.md and set up what's missing first. ` +
      `Then read ${SITE_URL}${path}.md in full and follow it to add ${title} to the app.`;
    await expect(panel.locator("pre")).toHaveText(prompt);

    // One click copies all of it
    await panel.getByRole("button", { name: "Copy Text" }).click();
    await expect(
      panel.getByRole("button", { name: "Copied Text" }),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      prompt,
    );
  });
}

test("the sitemap lists the home page and the docs, and robots.txt names it", async ({
  request,
}) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain(`<loc>${SITE_URL}</loc>`);
  expect(xml).toContain(`<loc>${SITE_URL}/docs</loc>`);
  expect(xml).toContain(`<loc>${SITE_URL}/docs/installation</loc>`);

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const rules = await robots.text();
  expect(rules).toContain("Allow: /");
  expect(rules).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});
