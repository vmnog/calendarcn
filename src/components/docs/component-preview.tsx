import { cache } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import { Pre } from "fumadocs-ui/components/codeblock";
import { ServerCodeBlock } from "fumadocs-ui/components/codeblock.rsc";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { cn } from "@/lib/utils";
import { CODE_THEMES } from "@/components/docs/code-themes";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";
import { PreviewTab } from "@/components/docs/preview-tab";
import { EXAMPLE_ITEMS } from "@/components/docs/example-items";
import {
  getExamplePath,
  isExampleName,
  readExampleSource,
  renderExample,
} from "@/components/docs/examples";
import {
  buildExamplePrompt,
  indexDocsPages,
  readSkillRules,
} from "@/components/docs/prompt";
import { source as docsSource } from "@/lib/source";

/**
 * Starting height of the preview frame, in px. Drag its corner to resize.
 * Tall enough for the ~520px event details popover below the views' header.
 */
const DEFAULT_PREVIEW_HEIGHT = 640;

/** Height of the code block's file name bar (Fumadocs `h-9.5`), in px. */
const CODE_TITLE_BAR_HEIGHT = 38;

/** The tabs of every example, in order. */
const PREVIEW_TABS = ["Preview", "Code", "Prompt"];

/** Title of the Prompt tab's block, where the Code tab shows the file's path. */
const PROMPT_TITLE = "Prompt";

/**
 * Makes a code block read as prose: long lines wrap instead of scrolling
 * sideways. Blank lines get a line's height here, because Fumadocs only sizes
 * `.line:empty` and a plain-text line always holds an empty span.
 */
const WRAPPED_PRE_CLASS =
  "w-full break-words whitespace-pre-wrap [&_.line]:min-h-[1lh]";

/**
 * Where the docs render each example and each item's install tabs, read from
 * the pages' MDX once per render: a prompt links both pages.
 */
const getDocsPageIndex = cache(async () => {
  const pages = await Promise.all(
    docsSource.getPages().map(async (page) => ({
      title: page.data.title,
      url: page.url,
      text: await page.data.getText("raw"),
    })),
  );
  return indexDocsPages(pages);
});

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
 * Preview / Code / Prompt tabs for an example, in the style of ui.shadcn.com.
 * The Preview tab renders the example component itself (fully interactive);
 * the Code tab shows that component's file, read from disk at build time,
 * so the two can't drift apart. The Prompt tab holds a prompt to paste into a
 * coding agent, built from that same file, `registry.json` and the skill in
 * `skills/calendarcn/SKILL.md` (see `buildExamplePrompt()`).
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
        <Tab value="Prompt">
          <p className="text-sm text-fd-muted-foreground">
            The prompt for <code>{name}</code> lands with the component.
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
  const item = EXAMPLE_ITEMS[name];
  const [source, rules, pages] = await Promise.all([
    readExampleSource(name),
    readSkillRules(),
    getDocsPageIndex(),
  ]);

  const page = pages.examplePages.get(name);
  const installPage = pages.installPages.get(item);
  // The prompt links both pages, so a missing one fails the build too
  if (!page || !installPage) {
    throw new Error(
      `ComponentPreview: the "${name}" prompt needs a docs page with <ComponentPreview name="${name}" /> and one with <InstallTabs item="${item}" />.`,
    );
  }

  const prompt = buildExamplePrompt({
    item,
    examplePath: filePath,
    source,
    rules,
    page,
    installPage,
  });

  return (
    <PreviewTabs className={className}>
      {/* An unfocusable panel, or the first event click closes its own popover */}
      <PreviewTab value="Preview" className="p-0">
        <div
          data-example={name}
          className="docs-preview relative isolate min-h-[400px] max-h-[960px] resize-y overflow-hidden rounded-xl bg-background text-foreground"
          style={{ height }}
        >
          {renderExample(name)}
        </div>
      </PreviewTab>
      <Tab value="Code">
        <PanelCodeBlock
          lang="tsx"
          code={source}
          title={filePath}
          height={height}
        />
      </Tab>
      <Tab value="Prompt">
        <PanelCodeBlock
          lang="text"
          code={prompt}
          title={PROMPT_TITLE}
          height={height}
          wrap
        />
      </Tab>
    </PreviewTabs>
  );
}

interface PanelCodeBlockProps {
  /** Shiki language of the code, e.g. `tsx`, or `text` for none. */
  lang: string;
  code: string;
  /** Shown in the bar above the code, beside the copy button. */
  title: string;
  /** The preview frame's height in px, which the block matches. */
  height: number;
  /** Wraps long lines instead of scrolling sideways, for prose. */
  wrap?: boolean;
}

/** A tab's code block: a title bar with a copy button over the code. */
function PanelCodeBlock({
  lang,
  code,
  title,
  height,
  wrap = false,
}: PanelCodeBlockProps) {
  return (
    <ServerCodeBlock
      lang={lang}
      code={code}
      themes={CODE_THEMES}
      components={{
        pre: (props: HTMLAttributes<HTMLPreElement>) => (
          <DocsCodeBlock
            {...props}
            title={title}
            // Same total height as the preview, so switching tabs doesn't jump
            viewportProps={{
              style: { maxHeight: height - CODE_TITLE_BAR_HEIGHT },
            }}
          >
            <Pre className={cn(wrap && WRAPPED_PRE_CLASS)}>
              {props.children}
            </Pre>
          </DocsCodeBlock>
        ),
      }}
    />
  );
}

interface PreviewTabsProps {
  className?: string;
  children: ReactNode;
}

function PreviewTabs({ className, children }: PreviewTabsProps) {
  return (
    <Tabs
      items={PREVIEW_TABS}
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
