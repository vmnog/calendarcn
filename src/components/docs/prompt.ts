import { readFile } from "node:fs/promises";
import path from "node:path";

import registry from "../../../registry.json";

/** Registry namespace configured in `components.json` (see the Installation page). */
const REGISTRY_NAMESPACE = "@calendarcn";

/** shadcn/ui items every project already has after `shadcn init` */
const PRESET_REGISTRY_ITEMS = new Set(["utils"]);

/** Origin the docs and the registry are served from, without a trailing slash */
export const SITE_URL = registry.homepage;

/**
 * The skill for coding agents, relative to the project root. Every prompt
 * carries its "Rules" section, so the rules are written once.
 */
export const SKILL_PATH = "skills/calendarcn/SKILL.md";

/** Heading of the skill's section the prompts carry */
const RULES_HEADING = "## Rules";

/** Docs path of Calendar Core, which documents the provider, `useCalendar()` and the event type */
const CALENDAR_CORE_PATH = "/docs/components/calendar-core";

/** Import prefix of the project's own files in the examples (`@/components/week-view` is `src/components/week-view.tsx`) */
const LOCAL_IMPORT_PREFIX = "@/";

/** Import prefix of the shadcn/ui components in the examples */
const UI_IMPORT_PREFIX = "@/components/ui/";

/** The examples' import of `cn()`, which `shadcn init` adds to every project */
const UTILS_IMPORT = "@/lib/utils";

/** Packages every React project has, never listed as something to add */
const BUILT_IN_PACKAGES = new Set(["react", "react-dom"]);

/** `<ComponentPreview name="…">` in a page's MDX */
const PREVIEW_TAG = /<ComponentPreview\s+name="([^"]+)"/g;

/** `<InstallTabs item="…">` in a page's MDX */
const INSTALL_TAG = /<InstallTabs\s+item="([^"]+)"/g;

/** The module of every `import … from "…"` and `import "…"` in a file */
const IMPORT_SPECIFIER = /\b(?:from|import)\s+["']([^"']+)["']/g;

/** The parts of a `registry.json` item a prompt reads */
interface RegistryItem {
  name: string;
  title: string;
  description: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: { path: string }[];
}

/** Every item in the registry, by name */
const REGISTRY_ITEMS = new Map<string, RegistryItem>(
  (registry.items as RegistryItem[]).map((entry) => [entry.name, entry]),
);

/**
 * The items that ship each file, by the path the examples import it from:
 * `src/components/week-view.tsx` is under `@/components/week-view`.
 */
const FILE_OWNERS = new Map<string, string[]>();
for (const entry of REGISTRY_ITEMS.values()) {
  for (const file of entry.files) {
    const specifier = toImportSpecifier(file.path);
    FILE_OWNERS.set(specifier, [
      ...(FILE_OWNERS.get(specifier) ?? []),
      entry.name,
    ]);
  }
}

/** A docs page, as a prompt links it */
export interface DocsPageRef {
  /** The page's title, e.g. `Week View` */
  title: string;
  /** The page's path on the site, e.g. `/docs/components/week-view` */
  url: string;
}

/** A docs page with its MDX source */
export interface DocsPageText extends DocsPageRef {
  /** The page's MDX, as it is on disk */
  text: string;
}

/** Where the docs render each example and each item's install tabs */
export interface DocsPageIndex {
  /** The page each example is on, by example name. The first one when several render it */
  examplePages: Map<string, DocsPageRef>;
  /** The page with each item's CLI and Manual tabs, by item name */
  installPages: Map<string, DocsPageRef>;
}

/** What `shadcn add` needs to install for an example to run */
export interface InstallPlan {
  /** What the `add` command names: the example's item, then what its imports need on top */
  commandItems: string[];
  /** Packages the example imports that no item lists */
  extraPackages: string[];
}

export interface ExamplePromptOptions {
  /** Registry item the example belongs to, e.g. `week-view` */
  item: string;
  /** Repository path of the example file, e.g. `src/examples/week-view-demo.tsx` */
  examplePath: string;
  /** The example file's source, as the Code tab shows it */
  source: string;
  /** The skill's rules, from `extractRules()` */
  rules: string;
  /** The docs page the example is on */
  page: DocsPageRef;
  /** The docs page with the item's Manual tab, for when the CLI can't run */
  installPage: DocsPageRef;
}

/** `src/components/week-view.tsx` as the examples import it: `@/components/week-view` */
function toImportSpecifier(filePath: string): string {
  return `${LOCAL_IMPORT_PREFIX}${filePath
    .replace(/^src\//, "")
    .replace(/\.tsx?$/, "")}`;
}

/** `date-fns` for `date-fns/locale`, `@scope/name` for `@scope/name/sub` and `name@^9` */
function toPackageName(specifier: string): string {
  const parts = specifier.split("/");
  const name = specifier.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0];
  const versionAt = name.indexOf("@", 1);
  return versionAt === -1 ? name : name.slice(0, versionAt);
}

/** The modules a file imports, in the order it imports them */
function getImports(source: string): string[] {
  return Array.from(source.matchAll(IMPORT_SPECIFIER), (match) => match[1]);
}

/** A list without its repeats, in its own order */
function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** The item with this name. A name the registry doesn't have is a bug in `example-items.ts` */
function getRegistryItem(name: string): RegistryItem {
  const entry = REGISTRY_ITEMS.get(name);
  if (!entry) {
    throw new Error(`prompt: "${name}" is not an item in registry.json`);
  }
  return entry;
}

/** The named items and every `@calendarcn` item they build on, the named ones first */
function collectItems(names: string[]): RegistryItem[] {
  const collected = new Map<string, RegistryItem>();
  const queue = [...names];

  // The queue grows while it's walked: each item adds the ones it builds on
  for (const name of queue) {
    if (collected.has(name)) continue;

    const entry = getRegistryItem(name);
    collected.set(name, entry);
    for (const dependency of entry.registryDependencies ?? []) {
      if (!dependency.startsWith(`${REGISTRY_NAMESPACE}/`)) continue;
      queue.push(dependency.slice(REGISTRY_NAMESPACE.length + 1));
    }
  }

  return Array.from(collected.values());
}

/** The shadcn/ui components the items list, without the ones every project has */
function getShadcnItems(items: RegistryItem[]): string[] {
  return unique(
    items
      .flatMap((entry) => entry.registryDependencies ?? [])
      .filter(
        (dependency) =>
          !dependency.startsWith(`${REGISTRY_NAMESPACE}/`) &&
          !PRESET_REGISTRY_ITEMS.has(dependency),
      ),
  );
}

/**
 * What to install for an example: its item, plus whatever else its imports
 * need. Most examples import the sample events, which no view brings, so
 * installing the item alone would leave the example with a missing module.
 */
export function planInstall(itemName: string, source: string): InstallPlan {
  const calendarNames = [getRegistryItem(itemName).name];
  const uiNames: string[] = [];
  const importedPackages: string[] = [];

  for (const specifier of getImports(source)) {
    if (specifier === UTILS_IMPORT) continue;

    const installed = collectItems(calendarNames);

    if (specifier.startsWith(UI_IMPORT_PREFIX)) {
      const component = specifier.slice(UI_IMPORT_PREFIX.length);
      if (!getShadcnItems(installed).includes(component)) {
        uiNames.push(component);
      }
      continue;
    }

    if (specifier.startsWith(LOCAL_IMPORT_PREFIX)) {
      // A file no item ships can't be installed: unit/prompt.spec.ts fails on it
      const owners = FILE_OWNERS.get(specifier) ?? [];
      const isInstalled = installed.some((entry) =>
        owners.includes(entry.name),
      );
      if (!isInstalled && owners.length > 0) {
        calendarNames.push(owners[0]);
      }
      continue;
    }

    importedPackages.push(toPackageName(specifier));
  }

  const packageNames = new Set(
    collectItems(calendarNames)
      .flatMap((entry) => entry.dependencies ?? [])
      .map(toPackageName),
  );

  return {
    commandItems: [
      ...calendarNames.map((name) => `${REGISTRY_NAMESPACE}/${name}`),
      ...unique(uiNames),
    ],
    extraPackages: unique(importedPackages).filter(
      (name) => !BUILT_IN_PACKAGES.has(name) && !packageNames.has(name),
    ),
  };
}

/**
 * The body of the skill's "Rules" section: from under its heading to the
 * next `##` heading.
 */
export function extractRules(skill: string): string {
  const start = skill.indexOf(`\n${RULES_HEADING}\n`);
  if (start === -1) {
    throw new Error(`prompt: no "${RULES_HEADING}" section in ${SKILL_PATH}`);
  }

  const body = skill.slice(start + RULES_HEADING.length + 2);
  const end = body.search(/^## /m);
  return (end === -1 ? body : body.slice(0, end)).trim();
}

/**
 * Reads the rules from the skill on disk. Docs pages are prerendered, so
 * this runs at build time (and on every request in dev), like
 * `readExampleSource()`.
 */
export async function readSkillRules(): Promise<string> {
  const skill = await readFile(path.join(process.cwd(), SKILL_PATH), "utf8");
  return extractRules(skill);
}

/**
 * Finds the page each example and each item's install tabs are on, from the
 * pages' MDX. A prompt links both, and an MDX component isn't told which
 * page renders it.
 */
export function indexDocsPages(pages: DocsPageText[]): DocsPageIndex {
  const examplePages = new Map<string, DocsPageRef>();
  const installPages = new Map<string, DocsPageRef>();

  for (const { title, url, text } of pages) {
    for (const [, name] of text.matchAll(PREVIEW_TAG)) {
      if (!examplePages.has(name)) examplePages.set(name, { title, url });
    }
    for (const [, item] of text.matchAll(INSTALL_TAG)) {
      if (!installPages.has(item)) installPages.set(item, { title, url });
    }
  }

  return { examplePages, installPages };
}

/** A code fence longer than any run of backticks in the code it wraps */
function getFence(code: string): string {
  const runs = code.match(/`+/g) ?? [];
  const longest = Math.max(0, ...runs.map((run) => run.length));
  return "`".repeat(Math.max(3, longest + 1));
}

/** The names as inline code, joined by commas */
function codeList(names: string[]): string {
  return names.map((name) => `\`${name}\``).join(", ");
}

/**
 * The prompt of an example's Prompt tab, as Markdown that works pasted as is
 * into a coding agent. It leads with the install command, then holds the
 * example's source, the skill's rules and the checks.
 *
 * Every part comes from one place: the item from `registry.json`, the source
 * from the example file, the rules from the skill, the links from the docs
 * source. This function only holds the wording around them. It says nothing
 * of what the install brings (files, shadcn/ui components, npm packages):
 * the CLI decides that, and reports it.
 */
export function buildExamplePrompt({
  item,
  examplePath,
  source,
  rules,
  page,
  installPage,
}: ExamplePromptOptions): string {
  const { title, description } = getRegistryItem(item);
  const plan = planInstall(item, source);
  const fence = getFence(source);
  const pageUrl = `${SITE_URL}${page.url}`;
  const coreUrl = `${SITE_URL}${CALENDAR_CORE_PATH}`;
  const extraItems = plan.commandItems.slice(1);
  const fileName = examplePath.slice(examplePath.lastIndexOf("/") + 1);
  // The examples that draw events name them: `defaultEvents`, `createSampleEvents`
  const showsEvents = /events/i.test(source);
  // The current time, which Next.js Cache Components won't prerender
  const readsNow = source.includes("new Date()");

  const lines = [
    `Run \`npx shadcn@latest add ${plan.commandItems.join(" ")}\` in this project to install CalendarCN's ${title}, then add the example below to the app. The example is from the "${page.title}" page of the docs: ${pageUrl}`,
    "",
    `${title}: ${description}`,
    "",
    "- Before you run it, check that `components.json` exists at the project root and that the project uses Tailwind CSS 4. If either is missing, stop and tell me.",
    "- Swap `npx` for `pnpm dlx`, `yarn dlx` or `bun x` to match the project's package manager.",
    ...(extraItems.length > 0
      ? [
          `- Besides ${title}, the command names what the example itself imports: ${codeList(extraItems)}.`,
        ]
      : []),
    ...(plan.extraPackages.length > 0
      ? [
          `- The example also imports ${codeList(plan.extraPackages)}. Add it if the project doesn't have it after the install.`,
        ]
      : []),
    `- If the CLI says it doesn't know \`${REGISTRY_NAMESPACE}\`, add \`"${REGISTRY_NAMESPACE}": "${SITE_URL}/r/{name}.json"\` to \`registries\` in \`components.json\` and run it again.`,
    `- If it still fails, stop and tell me. Don't write the components yourself: the Manual tab on ${SITE_URL}${installPage.url} lists the files to copy by hand.`,
    "",
    "## The example",
    "",
    `Create this as \`${fileName}\` in the project's components folder, and render it on a page: a new route, unless I named one. It is \`${examplePath}\` in CalendarCN's repository.`,
    "",
    `${fence}tsx`,
    source,
    fence,
    "",
    "- The imports use the aliases `@/components`, `@/hooks` and `@/lib`. Change them if `components.json` sets other aliases.",
    ...(readsNow
      ? [
          "- It calls `new Date()`. That is fine unless the project sets `cacheComponents` in its Next.js config: the rule on it below says what to do then.",
        ]
      : []),
    "",
    RULES_HEADING,
    "",
    rules,
    "",
    "## Before you say it's done",
    "",
    "Check each of these, and tell me which ones you couldn't check:",
    "",
    "- The project type-checks.",
    "- The page renders with no new error in the browser console.",
    "- If the example shows events on a day, week or month grid, dragging one moves it.",
    "- It reads well in light and dark mode. If the project has no theme toggle, add the `dark` class to `<html>` to see dark mode.",
    "",
    "## Read more",
    "",
    `- This page as Markdown: ${pageUrl}.md`,
    ...(page.url === CALENDAR_CORE_PATH
      ? []
      : [
          `- Calendar Core as Markdown, for \`CalendarProvider\`, \`useCalendar()\` and the event type: ${coreUrl}.md`,
        ]),
    `- Every docs page: ${SITE_URL}/llms.txt`,
    "",
    showsEvents
      ? "When it renders, ask me which events to show."
      : "When it renders, ask me where it goes in the app.",
  ];

  return lines.join("\n");
}
