import type { ReactNode } from "react";
import Link from "next/link";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
  Pre,
} from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { cn } from "@/lib/utils";
import { CODE_THEMES } from "@/components/docs/code-themes";
import { DocsCodeBlock, DocsPre } from "@/components/docs/docs-code-block";
import { SITE_URL } from "@/lib/source";

import registry from "../../../registry.json";

/** Registry namespace configured in `components.json` (see the Installation page). */
export const REGISTRY_NAMESPACE = "@calendarcn";

/** Where the Manual tab links each file's source */
const SOURCE_URL = "https://github.com/vmnog/calendarcn/blob/main";

/** shadcn/ui items every project already has after `shadcn init` */
const PRESET_REGISTRY_ITEMS = new Set(["utils"]);

/** The Installation page as Markdown, where the prompt sends an assistant when the CLI fails */
const INSTALLATION_MARKDOWN_URL = `${SITE_URL}/docs/installation.md`;

/** The docs' index for assistants, which the prompt names when the tabs aren't told their page */
const DOCS_INDEX_URL = `${SITE_URL}/llms.txt`;

/** What the Manual tab says above an item's CSS variables */
export const CSS_STEP_TEXT =
  "Add its variables to your global CSS file. Where a variable is already there, this value replaces it:";

/** The prompt wraps like prose instead of scrolling like code, clear of the copy button */
const PROMPT_TEXT_CLASS =
  "w-full ps-4 pe-10 leading-6 break-words whitespace-pre-wrap";

/** A package manager's shadcn CLI runner and the command that adds npm packages */
interface PackageManager {
  name: string;
  runner: string;
  add: string;
}

/** npm: the package manager the tabs' Markdown form writes its commands for */
export const NPM: PackageManager = {
  name: "npm",
  runner: "npx",
  add: "npm install",
};

/**
 * Package managers shown in the CLI tab. Runners match the tabs fumadocs-mdx
 * generates for ```npm code blocks.
 */
const PACKAGE_MANAGERS: PackageManager[] = [
  { name: "pnpm", runner: "pnpm dlx", add: "pnpm add" },
  NPM,
  { name: "yarn", runner: "yarn dlx", add: "yarn add" },
  { name: "bun", runner: "bun x", add: "bun add" },
];

/** The parts of a `registry.json` item the tabs read */
interface RegistryItem {
  name: string;
  title: string;
  dependencies?: string[];
  registryDependencies?: string[];
  /** A theme item has none: it only writes CSS variables */
  files?: { path: string }[];
  /** Variables the CLI writes into the project's CSS file */
  cssVars?: {
    theme?: Record<string, string>;
    light?: Record<string, string>;
    dark?: Record<string, string>;
  };
}

/** Every item in the registry, by name */
const REGISTRY_ITEMS = new Map<string, RegistryItem>(
  (registry.items as RegistryItem[]).map((entry) => [entry.name, entry]),
);

/** A file the CLI copies, as the Manual tab lists it */
interface InstallFile {
  /** Path under the project's source folder, e.g. `components/week-view.tsx` */
  label: string;
  /** The file's source on GitHub */
  url: string;
}

/**
 * What the CLI does for a registry item, as the Manual tab and the tabs'
 * Markdown form (`src/components/docs/markdown.ts`) both write it out.
 */
export interface InstallSteps {
  /** The item's title, e.g. `Week View` */
  title: string;
  /** The command that adds the item with the shadcn CLI */
  cliCommand: (packageManager: PackageManager) => string;
  /** CalendarCN items it builds on, without the namespace */
  calendarItems: string[];
  /** The command that installs its npm packages, when it has any */
  dependenciesCommand?: (packageManager: PackageManager) => string;
  /** The command that adds the shadcn/ui components it uses, when it uses any */
  shadcnCommand?: (packageManager: PackageManager) => string;
  /** The files to copy; none for an item that only adds CSS variables */
  files: InstallFile[];
  /**
   * The CSS the CLI writes into the project's global CSS file, when the item
   * has variables: each one under `:root` and `.dark`, and a Tailwind color
   * for it in `@theme inline`
   */
  css?: string;
}

/** A CSS rule with one declaration per line, or nothing when it has none */
function toCssRule(selector: string, declarations: string[]): string[] {
  if (declarations.length === 0) return [];
  return [`${selector} {\n${declarations.join("\n")}\n}`];
}

/**
 * An item's `cssVars` as the CSS the shadcn CLI writes for a Tailwind CSS 4
 * project: the variables under `:root` and `.dark`, and a `--color-*` for
 * each in `@theme inline`, so Tailwind has a utility for it
 */
function toCss(cssVars: RegistryItem["cssVars"]): string | undefined {
  if (!cssVars) return undefined;
  const light = Object.entries(cssVars.light ?? {});
  const dark = Object.entries(cssVars.dark ?? {});
  const names = new Set([...light, ...dark].map(([name]) => name));
  const declare = ([name, value]: [string, string]) => `  --${name}: ${value};`;

  const rules = [
    ...toCssRule("@theme inline", [
      ...Object.entries(cssVars.theme ?? {}).map(declare),
      ...[...names].map((name) => `  --color-${name}: var(--${name});`),
    ]),
    ...toCssRule(":root", light.map(declare)),
    ...toCssRule(".dark", dark.map(declare)),
  ];
  return rules.length > 0 ? rules.join("\n\n") : undefined;
}

/**
 * Reads a registry item's install steps from `registry.json`, so they always
 * match what the CLI installs. Throws for a name that isn't an item: a typo
 * in an MDX page fails the build.
 */
export function getInstallSteps(item: string): InstallSteps {
  const entry = REGISTRY_ITEMS.get(item);
  if (!entry) {
    throw new Error(`InstallTabs: "${item}" is not an item in registry.json`);
  }

  const dependencies = entry.dependencies ?? [];
  const registryDependencies = entry.registryDependencies ?? [];
  const calendarItems = registryDependencies
    .filter((name) => name.startsWith(`${REGISTRY_NAMESPACE}/`))
    .map((name) => name.slice(REGISTRY_NAMESPACE.length + 1));
  const shadcnItems = registryDependencies.filter(
    (name) =>
      !name.startsWith(`${REGISTRY_NAMESPACE}/`) &&
      !PRESET_REGISTRY_ITEMS.has(name),
  );

  return {
    title: entry.title,
    cliCommand: ({ runner }) =>
      `${runner} shadcn add ${REGISTRY_NAMESPACE}/${item}`,
    calendarItems,
    dependenciesCommand:
      dependencies.length > 0
        ? ({ add }) => `${add} ${dependencies.join(" ")}`
        : undefined,
    shadcnCommand:
      shadcnItems.length > 0
        ? ({ runner }) => `${runner} shadcn add ${shadcnItems.join(" ")}`
        : undefined,
    files: (entry.files ?? []).map(({ path }) => ({
      label: path.replace(/^src\//, ""),
      url: `${SOURCE_URL}/${path}`,
    })),
    css: toCss(entry.cssVars),
  };
}

/**
 * The Prompt tab's text: one paragraph to paste into an AI coding assistant,
 * in the shape of skills.sh's prompts. It runs the CLI, then sends the
 * assistant to the docs as Markdown, which carry the usage and the API.
 */
export function getInstallPrompt(
  { title, cliCommand }: InstallSteps,
  docsUrl: string = DOCS_INDEX_URL,
): string {
  return [
    `Run \`${cliCommand(NPM)}\` in this project to install CalendarCN's ${title}.`,
    `If the command fails, read ${INSTALLATION_MARKDOWN_URL} and set up what's missing first.`,
    `Then read ${docsUrl} in full and follow it to add ${title} to the app.`,
  ].join(" ");
}

export interface InstallTabsProps {
  /** Registry item name, e.g. `week-view`. */
  item: string;
  /**
   * The Markdown of the page the tabs are on, which the Prompt tab tells an
   * assistant to read. The docs page sets it.
   */
  docsUrl?: string;
  /** Extra notes, shown at the end of the Manual tab. */
  children?: ReactNode;
}

/**
 * CLI / Manual / Prompt installation tabs for a registry item, with a copy
 * button on every command. The CLI tab lists one command per package manager
 * and keeps the chosen one across pages. The Manual tab is built from
 * `registry.json`, so its dependencies and files always match what the CLI
 * installs. The Prompt tab is the same install as a prompt for an AI coding
 * assistant.
 */
export function InstallTabs({ item, docsUrl, children }: InstallTabsProps) {
  const steps = getInstallSteps(item);

  return (
    <Tabs items={["CLI", "Manual", "Prompt"]} className="docs-surface">
      {/* The package-manager tabs fill the panel edge to edge, sharing its radius. */}
      <Tab value="CLI" className="not-prose p-0">
        <PackageManagerTabs
          command={steps.cliCommand}
          className="rounded-[inherit] border-none"
        />
      </Tab>
      <Tab value="Manual">
        <ManualSteps steps={steps} />
        {children}
      </Tab>
      <Tab value="Prompt">
        <DocsCodeBlock>
          <Pre className={PROMPT_TEXT_CLASS}>
            {getInstallPrompt(steps, docsUrl)}
          </Pre>
        </DocsCodeBlock>
      </Tab>
    </Tabs>
  );
}

interface ManualStepsProps {
  steps: InstallSteps;
}

/** The steps the CLI would run, written out: items, packages, components, files */
function ManualSteps({ steps }: ManualStepsProps) {
  const { calendarItems, dependenciesCommand, shadcnCommand, files, css } =
    steps;

  return (
    <Steps>
      {calendarItems.length > 0 && (
        <Step>
          <p>Install the items it builds on:</p>
          <ul>
            {calendarItems.map((name) => (
              <li key={name}>
                <Link href={`/docs/components/${name}`}>{name}</Link>
              </li>
            ))}
          </ul>
        </Step>
      )}
      {dependenciesCommand && (
        <Step>
          <p>Install the dependencies:</p>
          <PackageManagerTabs command={dependenciesCommand} />
        </Step>
      )}
      {shadcnCommand && (
        <Step>
          <p>Add the shadcn/ui components it uses:</p>
          <PackageManagerTabs command={shadcnCommand} />
        </Step>
      )}
      {files.length > 0 && (
        <Step>
          <p>
            Copy these files into your project, keeping the paths under your
            components, hooks and lib folders:
          </p>
          <ul>
            {files.map(({ label, url }) => (
              <li key={url}>
                <a href={url}>
                  <code>{label}</code>
                </a>
              </li>
            ))}
          </ul>
        </Step>
      )}
      {css && (
        <Step>
          <p>{CSS_STEP_TEXT}</p>
          <ServerCodeBlock
            lang="css"
            themes={CODE_THEMES}
            code={css}
            components={{ pre: DocsPre }}
          />
        </Step>
      )}
    </Steps>
  );
}

interface PackageManagerTabsProps {
  /** The command for one package manager */
  command: (packageManager: PackageManager) => string;
  className?: string;
}

/** One copyable command per package manager, remembering the choice across pages */
function PackageManagerTabs({ command, className }: PackageManagerTabsProps) {
  return (
    <CodeBlockTabs
      defaultValue={PACKAGE_MANAGERS[0].name}
      groupId="package-manager"
      persist
      className={cn("docs-code-tabs not-prose my-0", className)}
    >
      <CodeBlockTabsList>
        {PACKAGE_MANAGERS.map(({ name }) => (
          <CodeBlockTabsTrigger key={name} value={name}>
            {name}
          </CodeBlockTabsTrigger>
        ))}
      </CodeBlockTabsList>
      {PACKAGE_MANAGERS.map((packageManager) => (
        <CodeBlockTab key={packageManager.name} value={packageManager.name}>
          <ServerCodeBlock
            lang="bash"
            themes={CODE_THEMES}
            code={command(packageManager)}
            components={{ pre: DocsPre }}
          />
        </CodeBlockTab>
      ))}
    </CodeBlockTabs>
  );
}
