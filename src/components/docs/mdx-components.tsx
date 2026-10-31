import type { ComponentProps } from "react";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import type { MDXComponents } from "mdx/types";

import { cn } from "@/lib/utils";
import { ComponentPreview } from "@/components/docs/component-preview";
import { InstallTabs } from "@/components/docs/install-tabs";
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

/** Components available in every `content/docs` MDX page without importing them. */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Tabs,
    Tab,
    Steps,
    Step,
    Kbd: DocsKbd,
    KbdGroup: DocsKbdGroup,
    ComponentPreview,
    InstallTabs,
    PropsTable,
    ...components,
  };
}
