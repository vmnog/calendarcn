import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import { EXAMPLE_ITEMS } from "@/components/docs/example-items";
import {
  SKILL_PATH,
  buildExamplePrompt,
  extractRules,
  indexDocsPages,
  planInstall,
} from "@/components/docs/prompt";
import type { DocsPageText } from "@/components/docs/prompt";

import registry from "../registry.json";

/**
 * The prompts of the docs' Prompt tabs (`src/components/docs/prompt.ts`),
 * built in Node for every example the way `ComponentPreview` builds them:
 * from the example file, `registry.json`, the skill and the docs pages. The
 * tab itself is tested in `e2e/prompt.spec.ts`.
 */

/** The repository root: the tests run from it, as `next build` does */
const ROOT = path.join(__dirname, "..");

/** Folder of the example files, relative to the root */
const EXAMPLES_DIR = "src/examples";

/** Folder of the docs pages, relative to the root */
const DOCS_DIR = "content/docs";

/** Namespace the registry's items reference each other by */
const REGISTRY_NAMESPACE = "@calendarcn/";

/** The skill may not grow past this many lines */
const MAX_SKILL_LINES = 150;

/** The parts of a `registry.json` item the tests read */
interface RegistryItem {
  name: string;
  registryDependencies?: string[];
  files: { path: string }[];
}

const REGISTRY_ITEMS = new Map<string, RegistryItem>(
  (registry.items as RegistryItem[]).map((entry) => [entry.name, entry]),
);

const EXAMPLE_NAMES = Object.keys(
  EXAMPLE_ITEMS,
) as (keyof typeof EXAMPLE_ITEMS)[];

function readText(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** An example's source, trimmed as `readExampleSource()` trims it */
function readExample(name: string): string {
  return readText(`${EXAMPLES_DIR}/${name}.tsx`).trimEnd();
}

/** Every `.mdx` file under a folder, as paths relative to it */
function listMdxFiles(folder: string, prefix = ""): string[] {
  return readdirSync(path.join(ROOT, folder, prefix), {
    withFileTypes: true,
  }).flatMap((entry) => {
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) return listMdxFiles(folder, relativePath);
    return entry.name.endsWith(".mdx") ? [relativePath] : [];
  });
}

/** The docs pages with the URL Fumadocs gives them: `index.mdx` is its folder */
const DOCS_PAGES: DocsPageText[] = listMdxFiles(DOCS_DIR).map((file) => {
  const text = readText(`${DOCS_DIR}/${file}`);
  const slug = file.replace(/\.mdx$/, "").replace(/(^|\/)index$/, "");
  return {
    title: /^title: (.+)$/m.exec(text)?.[1] ?? "",
    url: slug ? `/docs/${slug}` : "/docs",
    text,
  };
});

const PAGE_INDEX = indexDocsPages(DOCS_PAGES);

const RULES = extractRules(readText(SKILL_PATH));

/** An example's prompt, built as `ComponentPreview` builds it */
function buildPrompt(name: keyof typeof EXAMPLE_ITEMS): string {
  const item = EXAMPLE_ITEMS[name];
  const page = PAGE_INDEX.examplePages.get(name);
  const installPage = PAGE_INDEX.installPages.get(item);
  if (!page || !installPage) {
    throw new Error(`No docs page for the "${name}" example or its item`);
  }

  return buildExamplePrompt({
    item,
    examplePath: `${EXAMPLES_DIR}/${name}.tsx`,
    source: readExample(name),
    rules: RULES,
    page,
    installPage,
  });
}

/** The named items and every `@calendarcn` item they build on */
function collectItems(names: string[]): RegistryItem[] {
  const collected = new Map<string, RegistryItem>();
  const visit = (name: string) => {
    const entry = REGISTRY_ITEMS.get(name);
    if (!entry || collected.has(name)) return;
    collected.set(name, entry);
    for (const dependency of entry.registryDependencies ?? []) {
      if (dependency.startsWith(REGISTRY_NAMESPACE)) {
        visit(dependency.slice(REGISTRY_NAMESPACE.length));
      }
    }
  };
  names.forEach(visit);
  return Array.from(collected.values());
}

test("every example file has an item, and every entry has a file", () => {
  const files = readdirSync(path.join(ROOT, EXAMPLES_DIR))
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => file.replace(/\.tsx$/, ""));

  expect([...EXAMPLE_NAMES].sort()).toEqual(files.sort());
});

test("every example is on a docs page, and its item has install tabs", () => {
  for (const name of EXAMPLE_NAMES) {
    expect(PAGE_INDEX.examplePages.get(name), name).toBeDefined();
    expect(
      PAGE_INDEX.installPages.get(EXAMPLE_ITEMS[name]),
      EXAMPLE_ITEMS[name],
    ).toBeDefined();
  }
  expect(PAGE_INDEX.examplePages.get("week-view-demo")).toEqual({
    title: "Week View",
    url: "/docs/components/week-view",
  });
  // A guide's example links the guide, and its item's tabs are found there
  expect(PAGE_INDEX.examplePages.get("ics-demo")?.url).toBe(
    "/docs/import-export",
  );
  expect(PAGE_INDEX.installPages.get("ics")?.url).toBe("/docs/import-export");
});

for (const name of EXAMPLE_NAMES) {
  const item = EXAMPLE_ITEMS[name];

  test(`the ${name} prompt installs ${item} and carries the example`, () => {
    const source = readExample(name);
    const prompt = buildPrompt(name);

    expect(REGISTRY_ITEMS.has(item)).toBe(true);
    expect(prompt).toContain(`npx shadcn@latest add @calendarcn/${item}`);
    // The source, character for character
    expect(prompt).toContain(source);
    expect(prompt).toContain(`${EXAMPLES_DIR}/${name}.tsx`);

    // The wording around the source and the rules has no blank left in it.
    // `{name}.json` is the registry's own URL template, not a placeholder
    const wording = prompt.replace(source, "").replace(RULES, "");
    expect(wording).not.toMatch(/\bundefined\b|\bnull\b|\bNaN\b/);
    expect(wording).not.toMatch(/\$\{|\{(?!name\}\.json)\w+\}/);
    expect(wording).not.toMatch(/\[object /);
  });

  test(`the ${name} prompt's command installs everything it imports`, () => {
    const source = readExample(name);
    const plan = planInstall(item, source);
    const command = plan.commandItems;
    const installed = collectItems(
      command
        .filter((entry) => entry.startsWith(REGISTRY_NAMESPACE))
        .map((entry) => entry.slice(REGISTRY_NAMESPACE.length)),
    );
    const files = new Set(
      installed.flatMap((entry) => entry.files.map((file) => file.path)),
    );
    const shadcnItems = new Set([
      ...installed.flatMap((entry) => entry.registryDependencies ?? []),
      ...command,
    ]);

    const imports = Array.from(
      source.matchAll(/\b(?:from|import)\s+"(@\/[^"]+)"/g),
      (match) => match[1],
    );
    expect(imports.length, "an example imports the item it shows").not.toBe(0);

    for (const specifier of imports) {
      if (specifier === "@/lib/utils") continue;

      if (specifier.startsWith("@/components/ui/")) {
        const component = specifier.slice("@/components/ui/".length);
        expect(shadcnItems.has(component), specifier).toBe(true);
        continue;
      }

      const base = specifier.replace(/^@\//, "src/");
      expect(
        files.has(`${base}.tsx`) || files.has(`${base}.ts`),
        `${specifier} is in no item the command installs`,
      ).toBe(true);
    }

    // The example's own item comes first
    expect(command[0]).toBe(`${REGISTRY_NAMESPACE}${item}`);
    expect(buildPrompt(name)).toContain(
      `\`npx shadcn@latest add ${command.join(" ")}\` in this project`,
    );
  });
}

test("the Week View prompt leads with the install command", () => {
  const prompt = buildPrompt("week-view-demo");

  // The example imports the sample events, which the view doesn't bring
  expect(
    prompt.startsWith(
      "Run `npx shadcn@latest add @calendarcn/week-view @calendarcn/sample-data` in this project to install CalendarCN's Week View",
    ),
  ).toBe(true);
  expect(prompt).toContain(
    "Week View: A week, or any number of days, on the time grid.",
  );
  expect(prompt).toContain(
    "- Besides Week View, the command names what the example itself imports: `@calendarcn/sample-data`.",
  );
  expect(prompt).toContain(
    "the Manual tab on https://calendarcn.xyz/docs/components/week-view lists the files",
  );
  expect(prompt).toContain(
    "Create this as `week-view-demo.tsx` in the project's components folder",
  );
  expect(prompt).toContain(
    "- This page as Markdown: https://calendarcn.xyz/docs/components/week-view.md",
  );
  expect(prompt).toContain(
    "https://calendarcn.xyz/docs/components/calendar-core.md",
  );
  expect(prompt).toContain(
    "- Every docs page: https://calendarcn.xyz/llms.txt",
  );
  expect(prompt.endsWith("When it renders, ask me which events to show.")).toBe(
    true,
  );
});

test("a prompt says nothing of what the install brings: the CLI decides that", () => {
  for (const name of EXAMPLE_NAMES) {
    const wording = buildPrompt(name).replace(readExample(name), "");

    // A file count, a package list and a component list were each wrong once
    expect(wording, name).not.toMatch(/\d+ (CalendarCN )?(source )?files?\b/);
    expect(wording, name).not.toMatch(/npm packages:|shadcn\/ui components:/);
    expect(wording, name).not.toMatch(/@\^?\d/);
  }
});

test("the note on new Date() shows only on an example that calls it", () => {
  const note = "- It calls `new Date()`. That is fine unless the project sets";

  expect(readExample("week-view-demo")).toContain("new Date()");
  expect(buildPrompt("week-view-demo")).toContain(note);
  expect(readExample("theme-toggle-demo")).not.toContain("new Date()");
  expect(buildPrompt("theme-toggle-demo")).not.toContain(note);
  // The rule the note points to says when it applies
  expect(RULES).toContain("`cacheComponents: true`");
  expect(RULES).toContain("Without `cacheComponents`, leave it as it is.");
});

test("a prompt on the Calendar Core page links that page once", () => {
  const prompt = buildPrompt("config-demo");
  const links = prompt.match(/calendar-core\.md/g) ?? [];

  expect(links).toHaveLength(1);
});

test("an example without events asks where it goes instead", () => {
  const prompt = buildPrompt("theme-toggle-demo");

  expect(prompt).toContain(
    "Run `npx shadcn@latest add @calendarcn/theme-toggle` in this project",
  );
  expect(prompt).not.toContain("the command names what the example itself");
  expect(
    prompt.endsWith("When it renders, ask me where it goes in the app."),
  ).toBe(true);
});

test("the example's fence is longer than any run of backticks in it", () => {
  const source = "const fence = '```';";
  const prompt = buildExamplePrompt({
    item: "week-view",
    examplePath: "src/examples/fence-demo.tsx",
    source,
    rules: RULES,
    page: { title: "Week View", url: "/docs/components/week-view" },
    installPage: { title: "Week View", url: "/docs/components/week-view" },
  });

  expect(prompt).toContain(`\`\`\`\`tsx\n${source}\n\`\`\`\`\n`);
});

test("the prompt's rules are the skill's Rules section", () => {
  const skill = readText(SKILL_PATH).split("\n");
  const start = skill.indexOf("## Rules");
  const end = skill.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );
  const section = skill
    .slice(start + 1, end)
    .join("\n")
    .trim();

  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  expect(section.length).toBeGreaterThan(0);
  expect(RULES).toBe(section);
  expect(buildPrompt("week-view-demo")).toContain(`\n## Rules\n\n${section}\n`);
});

test("the skill has the frontmatter `npx skills add` reads, and stays short", () => {
  const skill = readText(SKILL_PATH);
  const frontmatter = /^---\n([\s\S]+?)\n---\n/.exec(skill)?.[1] ?? "";

  expect(frontmatter).toMatch(/^name: calendarcn$/m);
  expect(frontmatter).toMatch(/^description: \S/m);
  expect(skill.trimEnd().split("\n").length).toBeLessThan(MAX_SKILL_LINES);
});

test("an unknown item or a skill without rules fails loudly", () => {
  expect(() => planInstall("no-such-item", "")).toThrow(/registry\.json/);
  expect(() => extractRules("# A skill\n\n## Install\n")).toThrow(/## Rules/);
});
