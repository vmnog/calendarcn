import type { ComponentProps } from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Callout } from "fumadocs-ui/components/callout";
import { Card } from "fumadocs-ui/components/card";
import { CodeBlockTabs } from "fumadocs-ui/components/codeblock";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { MDXComponents } from "mdx/types";

import { cn } from "@/lib/utils";
import { ComponentPreview } from "@/components/docs/component-preview";
import { DocsPre } from "@/components/docs/docs-code-block";
import { DocsContributor } from "@/components/docs/docs-contributor";
import { DocsMap, DocsMapCta } from "@/components/docs/docs-map";
import { InstallTabs } from "@/components/docs/install-tabs";
import { LiveDemoPreview } from "@/components/docs/live-demo-preview";
import { PropsTable } from "@/components/docs/props-table";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

/** The app's `Kbd`, opted out of the Fumadocs prose `kbd` styles. */
function DocsKbd({ className, ...props }: ComponentProps<typeof Kbd>) {
  return <Kbd className={cn("not-prose", className)} {...props} />;
}

/** The app's `KbdGroup`, opted out of the Fumadocs prose `kbd` styles. */
function DocsKbdGroup({
  className,
  ...props
}: ComponentProps<typeof KbdGroup>) {
  return <KbdGroup className={cn("not-prose", className)} {...props} />;
}

/** Package-manager tabs (from ```npm blocks): one surface with flush code blocks. */
function DocsCodeBlockTabs({
  className,
  ...props
}: ComponentProps<typeof CodeBlockTabs>) {
  return (
    <CodeBlockTabs
      className={cn("docs-surface docs-code-tabs", className)}
      {...props}
    />
  );
}

/** Fumadocs `Callout` with the docs surface instead of a border and drop shadow. */
function DocsCallout({ className, ...props }: ComponentProps<typeof Callout>) {
  return <Callout className={cn("docs-surface", className)} {...props} />;
}

/** Fumadocs `Card` with the docs surface; the ring darkens on hover. */
function DocsCard({ className, ...props }: ComponentProps<typeof Card>) {
  return <Card className={cn("docs-surface", className)} {...props} />;
}

/** Components available in every `content/docs` MDX page without importing them. */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    pre: DocsPre,
    CodeBlockTabs: DocsCodeBlockTabs,
    Callout: DocsCallout,
    Card: DocsCard,
    Tabs,
    Tab,
    Steps,
    Step,
    Kbd: DocsKbd,
    KbdGroup: DocsKbdGroup,
    ComponentPreview,
    Contributor: DocsContributor,
    DocsMap,
    DocsMapCta,
    InstallTabs,
    LiveDemoPreview,
    PropsTable,
    ...components,
  };
}
