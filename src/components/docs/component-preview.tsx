import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import { Pre } from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { cn } from "@/lib/utils";
import { CODE_THEMES } from "@/components/docs/code-themes";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";
import {
  getExamplePath,
  isExampleName,
  readExampleSource,
  renderExample,
} from "@/components/docs/examples";

/**
 * Starting height of the preview frame, in px. Drag its corner to resize.
 * Tall enough for the ~520px event details popover below the views' header.
 */
const DEFAULT_PREVIEW_HEIGHT = 640;

/** Height of the code block's file name bar (Fumadocs `h-9.5`), in px. */
const CODE_TITLE_BAR_HEIGHT = 38;

interface ComponentPreviewProps {
  /** Example file in `src/examples/`, without `.tsx`, e.g. `week-view-demo`. */
  name: string;
  /** Starting frame height in px. */
  height?: number;
  /**
   * Shows a placeholder with this message instead of the example, for
   * components that don't exist yet.
   */
  todo?: ReactNode;
  className?: string;
}

/**
 * Preview / Code tabs for an example, in the style of ui.shadcn.com. The
 * Preview tab renders the example component itself (fully interactive);
 * the Code tab shows that component's file, read from disk at build time,
 * so the two can't drift apart.
 */
export async function ComponentPreview({
  name,
  height = DEFAULT_PREVIEW_HEIGHT,
  todo,
  className,
}: ComponentPreviewProps) {
  if (todo) {
    return (
      <PreviewTabs className={className}>
        <Tab value="Preview" className="p-0">
          <PreviewPlaceholder name={name} height={height}>
            {todo}
          </PreviewPlaceholder>
        </Tab>
        <Tab value="Code">
          <p className="text-sm text-fd-muted-foreground">
            The <code>{name}</code> example lands with the component.
          </p>
        </Tab>
      </PreviewTabs>
    );
  }

  // A typo in an MDX page fails the build instead of rendering nothing
  if (!isExampleName(name)) {
    throw new Error(
      `ComponentPreview: no example named "${name}" in src/examples (register it in src/components/docs/examples.ts).`,
    );
  }

  const filePath = getExamplePath(name);
  const source = await readExampleSource(name);

  return (
    <PreviewTabs className={className}>
      <Tab value="Preview" className="p-0">
        <div
          data-example={name}
          className="docs-preview relative isolate min-h-[400px] max-h-[960px] resize-y overflow-hidden rounded-xl bg-background text-foreground"
          style={{ height }}
        >
          {renderExample(name)}
        </div>
      </Tab>
      <Tab value="Code">
        <ServerCodeBlock
          lang="tsx"
          code={source}
          themes={CODE_THEMES}
          components={{
            pre: (props: HTMLAttributes<HTMLPreElement>) => (
              <DocsCodeBlock
                {...props}
                title={filePath}
                // Same total height as the preview, so switching tabs doesn't jump
                viewportProps={{
                  style: { maxHeight: height - CODE_TITLE_BAR_HEIGHT },
                }}
              >
                <Pre>{props.children}</Pre>
              </DocsCodeBlock>
            ),
          }}
        />
      </Tab>
    </PreviewTabs>
  );
}

interface PreviewTabsProps {
  className?: string;
  children: ReactNode;
}

function PreviewTabs({ className, children }: PreviewTabsProps) {
  return (
    <Tabs
      items={["Preview", "Code"]}
      className={cn("docs-surface not-prose", className)}
    >
      {children}
    </Tabs>
  );
}

interface PreviewPlaceholderProps {
  name: string;
  height: number;
  children: ReactNode;
}

function PreviewPlaceholder({
  name,
  height,
  children,
}: PreviewPlaceholderProps) {
  return (
    <div
      data-example={name}
      className="flex flex-col items-center justify-center gap-3 rounded-xl p-6 text-center"
      style={{ height }}
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-fd-secondary text-fd-muted-foreground shadow-[var(--shadow-border)]">
        <CalendarDaysIcon className="size-5" />
      </div>
      <p className="text-sm font-medium text-fd-foreground">
        Preview coming soon
      </p>
      <p className="max-w-sm text-sm text-pretty text-fd-muted-foreground">
        {children} Until then, try the{" "}
        <Link href="/" className="font-medium underline underline-offset-4">
          live demo
        </Link>
        .
      </p>
    </div>
  );
}
