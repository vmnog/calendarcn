import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";

import { cn } from "@/lib/utils";

/** Default height of the preview frame, in px. */
const DEFAULT_PREVIEW_HEIGHT = 420;

interface ComponentPreviewProps {
  /** Registry item name, e.g. `week-view`. */
  name: string;
  /** Page to embed in an iframe (e.g. `/` for the live demo). Omit to show a placeholder. */
  src?: string;
  /** Frame height in px. */
  height?: number;
  /** Shown in the Code tab, usually a fenced code block. */
  children?: ReactNode;
  className?: string;
}

/**
 * Preview / Code frame for component pages, in the style of ui.shadcn.com.
 *
 * TODO: render the real component once the registry items exist instead of
 * an iframe or placeholder.
 */
export function ComponentPreview({
  name,
  src,
  height = DEFAULT_PREVIEW_HEIGHT,
  children,
  className,
}: ComponentPreviewProps) {
  return (
    <Tabs items={["Preview", "Code"]} className={cn("not-prose", className)}>
      <Tab value="Preview" className="p-0">
        {src ? (
          <iframe
            src={src}
            title={`${name} preview`}
            loading="lazy"
            className="block w-full rounded-xl bg-background"
            style={{ height }}
          />
        ) : (
          <PreviewPlaceholder name={name} height={height} />
        )}
      </Tab>
      <Tab value="Code">
        {children ?? (
          <p className="text-sm text-fd-muted-foreground">
            Example code for <code>{name}</code> lands with the registry item.
          </p>
        )}
      </Tab>
    </Tabs>
  );
}

interface PreviewPlaceholderProps {
  name: string;
  height: number;
}

function PreviewPlaceholder({ name, height }: PreviewPlaceholderProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl p-6 text-center"
      style={{ height }}
    >
      <div className="flex size-10 items-center justify-center rounded-lg border bg-fd-secondary text-fd-muted-foreground">
        <CalendarDaysIcon className="size-5" />
      </div>
      <p className="text-sm font-medium text-fd-foreground">
        Live preview coming soon
      </p>
      <p className="max-w-sm text-sm text-fd-muted-foreground">
        <code className="font-mono text-xs">{name}</code> renders here once the
        calendar is split into registry items. Until then, try the{" "}
        <Link href="/" className="font-medium underline underline-offset-4">
          live demo
        </Link>
        .
      </p>
    </div>
  );
}
