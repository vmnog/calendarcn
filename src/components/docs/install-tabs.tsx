import type { ReactNode } from "react";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { DocsPre } from "@/components/docs/docs-code-block";

/** Registry namespace configured in `components.json` (see the Installation page). */
const REGISTRY_NAMESPACE = "@calendarcn";

/** Shiki themes, matching the ones fumadocs-mdx uses for MDX code blocks. */
const CODE_THEMES = { light: "github-light", dark: "github-dark" } as const;

/**
 * Package managers shown in the CLI tab, each with its shadcn CLI runner.
 * Runners match the tabs fumadocs-mdx generates for ```npm code blocks.
 */
const PACKAGE_MANAGERS = [
  { name: "pnpm", runner: "pnpm dlx" },
  { name: "npm", runner: "npx" },
  { name: "yarn", runner: "yarn dlx" },
  { name: "bun", runner: "bun x" },
] as const;

interface InstallTabsProps {
  /** Registry item name, e.g. `week-view`. */
  item: string;
  /** Manual installation steps, shown in the Manual tab. */
  children?: ReactNode;
}

/**
 * CLI / Manual installation tabs for a registry item, with a copy button on
 * every command. The CLI tab lists one command per package manager and keeps
 * the chosen one across pages.
 */
export function InstallTabs({ item, children }: InstallTabsProps) {
  return (
    <Tabs items={["CLI", "Manual"]} className="docs-surface">
      {/* The package-manager tabs fill the panel edge to edge, sharing its radius. */}
      <Tab value="CLI" className="not-prose p-0">
        <CodeBlockTabs
          defaultValue={PACKAGE_MANAGERS[0].name}
          groupId="package-manager"
          persist
          className="docs-code-tabs my-0 rounded-[inherit] border-none"
        >
          <div className="flex items-center gap-2 pe-3">
            <CodeBlockTabsList className="flex-1">
              {PACKAGE_MANAGERS.map(({ name }) => (
                <CodeBlockTabsTrigger key={name} value={name}>
                  {name}
                </CodeBlockTabsTrigger>
              ))}
            </CodeBlockTabsList>
            <span
              title={`The ${REGISTRY_NAMESPACE} registry isn't published yet`}
              className="shrink-0 rounded-full bg-fd-warning/10 px-2 py-0.5 text-xs font-medium text-fd-warning"
            >
              Coming soon
            </span>
          </div>
          {PACKAGE_MANAGERS.map(({ name, runner }) => (
            <CodeBlockTab key={name} value={name}>
              <ServerCodeBlock
                lang="bash"
                themes={CODE_THEMES}
                code={`${runner} shadcn add ${REGISTRY_NAMESPACE}/${item}`}
                components={{ pre: DocsPre }}
              />
            </CodeBlockTab>
          ))}
        </CodeBlockTabs>
      </Tab>
      <Tab value="Manual">
        {children ?? (
          <p className="text-sm text-fd-muted-foreground">
            Manual steps for <code>{item}</code> land with the registry item.
          </p>
        )}
      </Tab>
    </Tabs>
  );
}
