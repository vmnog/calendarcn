import { createElement } from "react";
import type { ElementType, FunctionComponent, ReactNode } from "react";
import { asMarkdown, md, renderToMarkdown } from "fumadocs-core/server";

import {
  getExamplePath,
  isExampleName,
  readExampleSource,
} from "@/components/docs/examples";
import {
  NPM,
  REGISTRY_NAMESPACE,
  getInstallSteps,
} from "@/components/docs/install-tabs";
import type { DocsMapQuestion } from "@/components/docs/docs-map";
import type { PropDefinition } from "@/components/docs/props-table";
import { SITE_URL } from "@/lib/source";
import type { DocsPage } from "@/lib/source";

/** The CalendarCN repository, for links to pull requests */
const GITHUB_URL = "https://github.com/vmnog/calendarcn";

/**
 * Package-manager tabs (from ```npm blocks) left out of the Markdown: the npm
 * tab's command stands for all four.
 */
const SKIPPED_PACKAGE_MANAGERS = new Set(["pnpm", "yarn", "bun"]);

/** Props of a page's `_markdown` export (`includeProcessedMarkdown` in `source.config.ts`) */
interface MarkdownBodyProps {
  /** The Markdown form of every MDX component the pages use */
  components: Record<string, ElementType>;
}

interface ChildrenProps {
  children?: ReactNode;
}

interface CodeBlockTabProps extends ChildrenProps {
  /** The tab's name, a package manager for ```npm blocks */
  value?: string;
}

interface CalloutProps extends ChildrenProps {
  title?: ReactNode;
}

interface CardProps extends ChildrenProps {
  title: ReactNode;
  href?: string;
  description?: ReactNode;
}

interface ContributorProps {
  handle: string;
  pr: number;
}

interface DocsMapProps {
  questions: DocsMapQuestion[];
}

interface DocsMapCtaProps extends ChildrenProps {
  title: string;
}

interface ComponentPreviewProps {
  name: string;
  todo?: ReactNode;
}

interface InstallTabsProps extends ChildrenProps {
  item: string;
}

interface PropsTableProps {
  rows?: PropDefinition[];
  nameHeader?: string;
  todo?: ReactNode;
}

/** A Markdown block: the blank lines keep it apart from what's around it */
function block(text: string): string {
  return `\n\n${text}\n\n`;
}

/** Text on one line, for a list item or a table cell */
function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Length of the longest run of backticks in a text */
function longestBacktickRun(text: string): number {
  const runs = Array.from(text.matchAll(/`+/g), (run) => run[0].length);
  return Math.max(0, ...runs);
}

/** Inline code, fenced with more backticks than the text holds */
function inlineCode(text: string): string {
  const fence = "`".repeat(longestBacktickRun(text) + 1);
  const pad = text.startsWith("`") || text.endsWith("`") ? " " : "";
  return `${fence}${pad}${text}${pad}${fence}`;
}

/** A fenced code block, with the file's path as its title when it has one */
function codeBlock(lang: string, code: string, title?: string): string {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(code) + 1));
  const meta = title ? ` title="${title}"` : "";
  return block(`${fence}${lang}${meta}\n${code}\n${fence}`);
}

/** A table cell: one line, with the pipes escaped (GitHub tables need it in code too) */
function tableCell(text: string): string {
  return oneLine(text).replaceAll("|", "\\|");
}

/** React children (Markdown text and MDX components) as Markdown */
function renderChildren(children: ReactNode): Promise<string> {
  return md`${children}`;
}

/** `Steps`, `Step`, `Tabs`, `Tab` and the tabs of ```npm blocks: their children */
function ChildrenOnly({ children }: ChildrenProps) {
  asMarkdown();
  return children;
}

/** Tab buttons: nothing to say in Markdown */
function Nothing() {
  asMarkdown();
  return null;
}

/** One tab of a ```npm block: the npm command, without the other managers' */
function CodeBlockTab({ value, children }: CodeBlockTabProps) {
  asMarkdown();
  if (value && SKIPPED_PACKAGE_MANAGERS.has(value)) return null;
  return children;
}

/** `Kbd`: the key as inline code */
async function Kbd({ children }: ChildrenProps) {
  asMarkdown();
  return inlineCode(oneLine(await renderChildren(children)));
}

/** `KbdGroup`: its keys as one inline code, `⌘K`, or `Alt+↑` when a key is a word */
async function KbdGroup({ children }: ChildrenProps) {
  asMarkdown();
  // Each `Kbd` inside arrives as inline code
  const keys = (await renderChildren(children))
    .split("`")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  const separator = keys.every((key) => key.length === 1) ? "" : "+";
  return inlineCode(keys.join(separator));
}

/** `Callout`: a quote, starting with its title */
async function Callout({ title, children }: CalloutProps) {
  asMarkdown();
  if (!title) return md.linePrefix("> ")`${children}`;
  return md.linePrefix("> ")`**${title}**\n\n${children}`;
}

/** `Cards`: a list, one `Card` per item */
async function Cards({ children }: ChildrenProps) {
  asMarkdown();
  const items = (await renderChildren(children))
    .split("\n")
    .filter((line) => line.trim().length > 0);
  return block(items.join("\n"));
}

/** `Card`: a list item linking its title, then its text */
async function Card({ title, href, description, children }: CardProps) {
  asMarkdown();
  const name = oneLine(await renderChildren(title));
  const text = oneLine(await renderChildren(description ?? children));
  const link = href ? `[${name}](${href})` : `**${name}**`;
  return `- ${link}${text ? `: ${text}` : ""}\n`;
}

/** `Contributor`: thanks, linking the profile and the pull request */
function Contributor({ handle, pr }: ContributorProps) {
  asMarkdown();
  return `Thanks to [@${handle}](https://github.com/${handle}) ([#${pr}](${GITHUB_URL}/pull/${pr})).`;
}

/** `DocsMapCta`: its title and text, then the two links its buttons open */
async function DocsMapCta({ title, children }: DocsMapCtaProps) {
  asMarkdown();
  const text = oneLine(await renderChildren(children));
  return block(
    `**${title}** ${text} [Open the live demo](${SITE_URL}/) or [the repository](${GITHUB_URL}).`,
  );
}

/** `LiveDemoPreview`: a link to the demo the page frames */
function LiveDemoPreview() {
  asMarkdown();
  return block(`[The live demo](${SITE_URL}/), built from this block.`);
}

/**
 * `InstallTabs`: the CLI command, then the Manual tab's steps as a list. Both
 * come from `getInstallSteps()`, as the tabs on the page do.
 */
async function InstallTabs({ item, children }: InstallTabsProps) {
  asMarkdown();
  const steps = getInstallSteps(item);
  const files = steps.files.map(
    ({ label, url }) => `   - [${inlineCode(label)}](${url})`,
  );

  const manualSteps = [
    steps.calendarItems.length > 0 &&
      `Install the items it builds on: ${steps.calendarItems
        .map((name) => inlineCode(`${REGISTRY_NAMESPACE}/${name}`))
        .join(", ")}`,
    steps.dependenciesCommand &&
      `Install the dependencies: ${inlineCode(steps.dependenciesCommand(NPM))}`,
    steps.shadcnCommand &&
      `Add the shadcn/ui components it uses: ${inlineCode(steps.shadcnCommand(NPM))}`,
    `Copy these files into your project, keeping the paths under your components, hooks and lib folders:\n${files.join("\n")}`,
  ].filter((step) => typeof step === "string");

  return [
    codeBlock("bash", steps.cliCommand(NPM)),
    block("Or install it by hand:"),
    block(manualSteps.map((step, index) => `${index + 1}. ${step}`).join("\n")),
    await renderChildren(children),
  ].join("");
}

/** `PropsTable`: a table of Prop, Type, Default (when a row has one) and Description */
async function PropsTable({
  rows = [],
  nameHeader = "Prop",
  todo,
}: PropsTableProps) {
  asMarkdown();
  if (rows.length === 0) {
    return block(
      todo ? oneLine(await renderChildren(todo)) : "Nothing to list here.",
    );
  }

  // Types and return values have no defaults; drop the empty column, as the page does
  const showDefault = rows.some((row) => row.default);
  const header = [
    nameHeader,
    "Type",
    ...(showDefault ? ["Default"] : []),
    "Description",
  ];

  const lines = await Promise.all(
    rows.map(async (row) => {
      const name = `${inlineCode(row.name)}${row.required ? " (required)" : ""}`;
      const description =
        typeof row.description === "string"
          ? row.description
          : await renderChildren(row.description);
      const cells = [
        name,
        inlineCode(oneLine(row.type)),
        ...(showDefault ? [row.default ? inlineCode(row.default) : "–"] : []),
        description,
      ];
      return `| ${cells.map(tableCell).join(" | ")} |`;
    }),
  );

  return block(
    [
      `| ${header.join(" | ")} |`,
      `|${" --- |".repeat(header.length)}`,
      ...lines,
    ].join("\n"),
  );
}

/**
 * The Markdown form of every MDX component the docs pages use
 * (`getMDXComponents` lists them). A component missing here is printed as its
 * JSX tag, which fails `e2e/llms.spec.ts`: give a new MDX component a form here.
 */
function getMarkdownComponents(page: DocsPage): Record<string, ElementType> {
  const pageUrl = `${SITE_URL}${page.url}`;

  /**
   * `ComponentPreview`: a line saying where the example runs, then its file,
   * read with the function the page's Code tab uses so the two can't differ.
   */
  async function ComponentPreview({ name, todo }: ComponentPreviewProps) {
    asMarkdown();
    if (todo) {
      return block(
        `The ${inlineCode(name)} example lands with the component. ${oneLine(await renderChildren(todo))}`,
      );
    }
    if (!isExampleName(name)) {
      throw new Error(
        `ComponentPreview: no example named "${name}" in src/examples (register it in src/components/docs/examples.ts).`,
      );
    }

    return [
      block(`Live example, interactive at ${pageUrl}. Its source:`),
      codeBlock("tsx", await readExampleSource(name), getExamplePath(name)),
    ].join("");
  }

  /** `DocsMap`: the questions as a list, each linking the section that answers it */
  function DocsMap({ questions }: DocsMapProps) {
    asMarkdown();
    return block(
      questions
        .map(({ question, href }) => {
          // An anchor alone means nothing outside the page
          const url = href.startsWith("#") ? `${pageUrl}${href}` : href;
          return `- [${question}](${url})`;
        })
        .join("\n"),
    );
  }

  return {
    Callout,
    Card,
    Cards,
    CodeBlockTab,
    CodeBlockTabs: ChildrenOnly,
    CodeBlockTabsList: Nothing,
    CodeBlockTabsTrigger: Nothing,
    ComponentPreview,
    Contributor,
    DocsMap,
    DocsMapCta,
    InstallTabs,
    Kbd,
    KbdGroup,
    LiveDemoPreview,
    // A calendar that plays one move: nothing to read
    PlayableHero: Nothing,
    PropsTable,
    Step: ChildrenOnly,
    Steps: ChildrenOnly,
    Tab: ChildrenOnly,
    Tabs: ChildrenOnly,
  };
}

/** Whether a page's `_markdown` export is the component `output: "function"` makes */
function isMarkdownBody(
  value: unknown,
): value is FunctionComponent<MarkdownBodyProps> {
  return typeof value === "function";
}

/**
 * A docs page as Markdown: its title as a heading, its description, then its
 * content with every MDX component in its Markdown form. Served at the page's
 * URL plus `.md`, and joined into `/llms-full.txt`.
 */
export async function getPageMarkdown(page: DocsPage): Promise<string> {
  const Body = page.data._exports._markdown;
  if (!isMarkdownBody(Body)) {
    throw new Error(
      `${page.path} has no Markdown component: set includeProcessedMarkdown with output "function" in source.config.ts.`,
    );
  }

  const body = await renderToMarkdown(
    createElement(Body, { components: getMarkdownComponents(page) }),
  );
  const heading = [`# ${page.data.title}`, page.data.description]
    .filter(Boolean)
    .join("\n\n");

  return `${heading}\n\n${body}\n`;
}
