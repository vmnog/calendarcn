import type { ComponentProps, ReactNode } from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import {
  CalloutContainer,
  CalloutDescription,
  CalloutTitle,
} from "fumadocs-ui/components/callout";
import { Card } from "fumadocs-ui/components/card";
import { CodeBlockTabs } from "fumadocs-ui/components/codeblock";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { MDXComponents } from "mdx/types";

import { cn } from "@/lib/utils";
import { Challenge } from "@/components/docs/challenge";
import { ComponentPreview } from "@/components/docs/component-preview";
import { DocsPre } from "@/components/docs/docs-code-block";
import { DocsContributor } from "@/components/docs/docs-contributor";
import { DocsMap, DocsMapCta } from "@/components/docs/docs-map";
import { InstallTabs } from "@/components/docs/install-tabs";
import { LegacyAnchors } from "@/components/docs/legacy-anchors";
import { LiveDemoPreview } from "@/components/docs/live-demo-preview";
import { PlayableHero } from "@/components/docs/playable-hero";
import { PropsTable } from "@/components/docs/props-table";
import { EventColorTokens, ThemeTokens } from "@/components/docs/theme-tokens";
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

/** What a docs callout takes: Fumadocs' container props, plus its title */
type DocsCalloutProps = Omit<
  ComponentProps<typeof CalloutContainer>,
  "title"
> & {
  /** The rule, in under 8 words: `.docs-callout-title` sets it in small caps */
  title?: ReactNode;
};

/**
 * Fumadocs `Callout` with the docs surface instead of a border and drop
 * shadow. Its title states the rule ("Give the view a parent with a height"),
 * so the page can be skimmed by its callouts.
 */
function DocsCallout({
  className,
  title,
  children,
  ...props
}: DocsCalloutProps) {
  return (
    <CalloutContainer className={cn("docs-surface", className)} {...props}>
      {title && (
        <CalloutTitle className="docs-callout-title">{title}</CalloutTitle>
      )}
      <CalloutDescription>{children}</CalloutDescription>
    </CalloutContainer>
  );
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
    Challenge,
    ComponentPreview,
    Contributor: DocsContributor,
    DocsMap,
    DocsMapCta,
    InstallTabs,
    LegacyAnchors,
    LiveDemoPreview,
    PlayableHero,
    PropsTable,
    ThemeTokens,
    EventColorTokens,
    ...components,
  };
}
