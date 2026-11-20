import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { EXAMPLE_ITEMS } from "@/components/docs/example-items";
import { indexDocsPages } from "@/components/docs/prompt";

/**
 * The examples on the component pages (`content/docs/components`) and the
 * guides (`content/docs/guides`): every file in `src/examples` is registered
 * and shown, every component page has an "Examples" section with enough of
 * them, every guide shows one, and the links between them resolve. The examples themselves are opened in `e2e/docs-examples.spec.ts`.
 */

/** The repository root: the tests run from it, as `next build` does */
const ROOT = path.join(__dirname, "..");

/** Folder of the example files, relative to the root */
const EXAMPLES_DIR = "src/examples";

/** The file that maps each example's name to its component */
const EXAMPLES_REGISTRY = "src/components/docs/examples.ts";

/** Folder of the component pages, relative to the root */
const COMPONENT_PAGES_DIR = "content/docs/components";

/** Folder of the guides, relative to the root */
const GUIDE_PAGES_DIR = "content/docs/guides";

/** Previews every guide has at least: a guide shows what it teaches */
const MIN_PREVIEWS_ON_GUIDES = 1;

/** Previews every component page has at least, the one at its top included */
const MIN_PREVIEWS = 2;

/** Previews the pages people start from have at least */
const MIN_PREVIEWS_ON_MAIN_PAGES = 4;

/** The pages that need `MIN_PREVIEWS_ON_MAIN_PAGES` */
const MAIN_PAGES = [
  "calendar",
  "day-week-view",
  "month-view",
  "agenda-view",
  "year-view",
  "event-details",
];

/** An example under an "Examples" heading stays short enough to read at a glance */
const MAX_SECTION_EXAMPLE_LINES = 90;

/** `<ComponentPreview name="…">` in a page's MDX */
const PREVIEW_TAG = /<ComponentPreview\s+name="([^"]+)"/g;

/** A Markdown link to an anchor: `](#here)` or `](/docs/components/page#there)` */
const ANCHOR_LINK =
  /\]\((\/docs\/(?:components|guides)\/[a-z-]+)?#([^)\s]+)\)/g;

function readText(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** A component page or a guide: its name (`day-week-view`), path and MDX */
interface DocsPage {
  name: string;
  url: string;
  text: string;
}

/** The pages in a folder of `content/docs`, served under its path */
function readPages(folder: string): DocsPage[] {
  return readdirSync(path.join(ROOT, folder))
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => {
      const name = file.replace(/\.mdx$/, "");
      return {
        name,
        url: `/${folder.replace(/^content\//, "")}/${name}`,
        text: readText(`${folder}/${file}`),
      };
    });
}

const PAGES = readPages(COMPONENT_PAGES_DIR);

const GUIDES = readPages(GUIDE_PAGES_DIR);

const EXAMPLE_FILES = readdirSync(path.join(ROOT, EXAMPLES_DIR))
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => file.replace(/\.tsx$/, ""));

/** The names of the previews in some MDX, in order */
function getPreviewNames(text: string): string[] {
  return Array.from(text.matchAll(PREVIEW_TAG), (match) => match[1]);
}

/** A page's MDX without its fenced code blocks, whose `#` lines aren't headings */
function withoutCodeBlocks(text: string): string {
  return text.replace(/^```[\s\S]*?^```$/gm, "");
}

/** The page's "Examples" section: from under its heading to the next `##` heading */
function getExamplesSection(text: string): string | null {
  const prose = withoutCodeBlocks(text);
  const start = prose.search(/^## Examples$/m);
  if (start === -1) return null;

  const body = prose.slice(start + "## Examples".length);
  const end = body.search(/^## /m);
  return end === -1 ? body : body.slice(0, end);
}

/**
 * The anchor a heading gets, as github-slugger (which Fumadocs uses) makes
 * it: lowercase, punctuation dropped, each space a hyphen.
 */
function slugify(heading: string): string {
  return heading
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** Every anchor on a page: a repeated heading gets `-1`, `-2` and so on */
function getAnchors(text: string): Set<string> {
  const anchors = new Set<string>();
  const seen = new Map<string, number>();
  for (const [, heading] of withoutCodeBlocks(text).matchAll(
    /^#{2,6} (.+)$/gm,
  )) {
    const slug = slugify(heading);
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
  }
  return anchors;
}

test("every example file is registered, and every registered example has a file", () => {
  const registry = readText(EXAMPLES_REGISTRY);
  const registered = Array.from(
    registry.matchAll(/^ {2}"([a-z0-9-]+)": \w+,$/gm),
    (match) => match[1],
  );

  expect([...registered].sort()).toEqual([...EXAMPLE_FILES].sort());
  expect(Object.keys(EXAMPLE_ITEMS).sort()).toEqual([...EXAMPLE_FILES].sort());
});

test("every example is shown on a docs page", () => {
  const others = readdirSync(path.join(ROOT, "content/docs"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => readText(`content/docs/${file}`));
  const shown = new Set(others.flatMap(getPreviewNames));

  for (const name of EXAMPLE_FILES) {
    expect(shown.has(name), `${name} is on no page`).toBe(true);
  }
});

test("an example file is a client component with one named export and no props", () => {
  for (const name of EXAMPLE_FILES) {
    const source = readText(`${EXAMPLES_DIR}/${name}.tsx`);
    const exported =
      source.match(/^export (?:default )?function \w+\(/gm) ?? [];

    expect(source.startsWith('"use client";\n'), name).toBe(true);
    expect(exported, name).toHaveLength(1);
    expect(exported[0], name).toMatch(/^export function \w+Demo\($/);
    expect(source, name).toMatch(/^export function \w+Demo\(\) \{$/m);
  }
});

test("a page's first example is its top one, which mounts at load", () => {
  const { topExamples } = indexDocsPages(
    [...PAGES, ...GUIDES].map(({ name, url, text }) => ({
      title: name,
      url,
      text,
    })),
  );

  for (const { name, text } of [...PAGES, ...GUIDES]) {
    const [first, ...rest] = getPreviewNames(text);
    expect(topExamples.has(first), `${first} on ${name}`).toBe(true);
    // The rest mount as they near the screen (`PreviewFrame`)
    for (const example of rest) {
      expect(topExamples.has(example), `${example} on ${name}`).toBe(false);
    }
  }
});

for (const { name, text } of PAGES) {
  test(`the ${name} page has an Examples section and enough examples`, () => {
    const section = getExamplesSection(text);
    const minimum = MAIN_PAGES.includes(name)
      ? MIN_PREVIEWS_ON_MAIN_PAGES
      : MIN_PREVIEWS;

    expect(section, `${name} has no "## Examples"`).not.toBeNull();
    expect(getPreviewNames(section ?? "").length).toBeGreaterThan(0);
    expect(getPreviewNames(text).length).toBeGreaterThanOrEqual(minimum);
    // No example twice on a page
    expect(new Set(getPreviewNames(text)).size).toBe(
      getPreviewNames(text).length,
    );
  });

  test(`each example of the ${name} page's Examples section has a heading and a sentence`, () => {
    const section = getExamplesSection(text) ?? "";
    // The parts between `###` headings: the first is the section's own intro
    const [, ...parts] = section.split(/^### /m);

    expect(parts.length).toBeGreaterThan(0);
    for (const part of parts) {
      const [heading, ...rest] = part.split("\n");
      const body = rest.join("\n").trim();
      const previews = getPreviewNames(body);

      expect(previews, `"${heading}" shows one example`).toHaveLength(1);
      // The sentence comes first, then the preview closes the part
      expect(body.startsWith("<ComponentPreview"), heading).toBe(false);
      expect(body, heading).toMatch(/<ComponentPreview [^>]+\/>$/);

      const lines = readText(`${EXAMPLES_DIR}/${previews[0]}.tsx`)
        .trimEnd()
        .split("\n").length;
      expect(lines, `${previews[0]} is ${lines} lines`).toBeLessThanOrEqual(
        MAX_SECTION_EXAMPLE_LINES,
      );
    }
  });
}

for (const { name, text } of GUIDES) {
  test(`the ${name} guide shows an example`, () => {
    expect(getPreviewNames(text).length).toBeGreaterThanOrEqual(
      MIN_PREVIEWS_ON_GUIDES,
    );
  });
}

for (const { name, url, text } of [...PAGES, ...GUIDES]) {
  test(`the ${name} page's links to headings resolve`, () => {
    const anchors = new Map(
      [...PAGES, ...GUIDES].map((page) => [page.url, getAnchors(page.text)]),
    );

    for (const [link, pagePath, anchor] of text.matchAll(ANCHOR_LINK)) {
      const target = anchors.get(pagePath ?? url);
      expect(target, `${link} names a page that isn't there`).toBeDefined();
      expect(target?.has(anchor), `${link} on ${name}`).toBe(true);
    }
  });
}
