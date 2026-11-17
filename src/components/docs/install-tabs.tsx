import type { ReactNode } from "react";
import Link from "next/link";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { cn } from "@/lib/utils";
import { CODE_THEMES } from "@/components/docs/code-themes";
import { DocsPre } from "@/components/docs/docs-code-block";

import registry from "../../../registry.json";

/** Registry namespace configured in `components.json` (see the Installation page). */
export const REGISTRY_NAMESPACE = "@calendarcn";

/** Where the Manual tab links each file's source */
const SOURCE_URL = "https://github.com/vmnog/calendarcn/blob/main";

/** shadcn/ui items every project already has after `shadcn init` */
const PRESET_REGISTRY_ITEMS = new Set(["utils"]);

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

/** The parts of a `registry.json` item the Manual tab reads */
interface RegistryItem {
  name: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files: { path: string }[];
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
  /** The command that adds the item with the shadcn CLI */
  cliCommand: (packageManager: PackageManager) => string;
  /** CalendarCN items it builds on, without the namespace */
  calendarItems: string[];
  /** The command that installs its npm packages, when it has any */
  dependenciesCommand?: (packageManager: PackageManager) => string;
  /** The command that adds the shadcn/ui components it uses, when it uses any */
  shadcnCommand?: (packageManager: PackageManager) => string;
  /** The files to copy */
  files: InstallFile[];
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
    files: entry.files.map(({ path }) => ({
      label: path.replace(/^src\//, ""),
      url: `${SOURCE_URL}/${path}`,
    })),
  };
}

interface InstallTabsProps {
  /** Registry item name, e.g. `week-view`. */
  item: string;
  /** Extra notes, shown at the end of the Manual tab. */
  children?: ReactNode;
}

/**
 * CLI / Manual installation tabs for a registry item, with a copy button on
 * every command. The CLI tab lists one command per package manager and keeps
 * the chosen one across pages. The Manual tab is built from `registry.json`,
 * so its dependencies and files always match what the CLI installs.
 */
export function InstallTabs({ item, children }: InstallTabsProps) {
  const steps = getInstallSteps(item);

  return (
    <Tabs items={["CLI", "Manual"]} className="docs-surface">
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
    </Tabs>
  );
}

interface ManualStepsProps {
  steps: InstallSteps;
}

/** The steps the CLI would run, written out: items, packages, components, files */
function ManualSteps({ steps }: ManualStepsProps) {
  const { calendarItems, dependenciesCommand, shadcnCommand, files } = steps;

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
