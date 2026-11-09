import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Starting height of the frame, in px. Drag its corner to resize. Tall
 * enough for the details sidebar's event details.
 */
const DEFAULT_FRAME_HEIGHT = 720;

/** Where the live demo is served */
const LIVE_DEMO_PATH = "/";

interface LiveDemoPreviewProps {
  /** Starting frame height in px. */
  height?: number;
  className?: string;
}

/**
 * The live demo in a frame, for full-page blocks a docs preview can't hold.
 * An iframe gives the demo its own viewport, so it lays out for the frame's
 * width (sidebars inline or as overlays) as it would on a screen that size.
 */
export function LiveDemoPreview({
  height = DEFAULT_FRAME_HEIGHT,
  className,
}: LiveDemoPreviewProps) {
  return (
    <figure className={cn("docs-surface not-prose rounded-xl", className)}>
      <div
        className="min-h-[400px] max-h-[1080px] resize-y overflow-hidden rounded-t-xl bg-background"
        style={{ height }}
      >
        <iframe
          src={LIVE_DEMO_PATH}
          title="CalendarCN live demo"
          loading="lazy"
          className="block size-full border-0"
        />
      </div>
      <figcaption className="flex items-center justify-between gap-3 border-t px-4 py-2.5 text-sm text-fd-muted-foreground">
        <span>The live demo, built from this block.</span>
        <Link
          href={LIVE_DEMO_PATH}
          target="_blank"
          className="inline-flex shrink-0 items-center gap-1 font-medium text-fd-foreground hover:underline hover:underline-offset-4"
        >
          Open full screen
          <ArrowUpRightIcon className="size-3.5" />
        </Link>
      </figcaption>
    </figure>
  );
}
