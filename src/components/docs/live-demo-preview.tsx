"use client";

import * as React from "react";
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

/**
 * Screenshots of the live demo (1200×720), one per theme, shown until the
 * frame has loaded it: the demo takes a few seconds, and the frame would be
 * blank meanwhile
 */
const POSTER_LIGHT_SRC = "/docs/calendar-app-poster.webp";
const POSTER_DARK_SRC = "/docs/calendar-app-poster-dark.webp";

/** Shared by both posters: they fill the frame from its top left corner */
const POSTER_CLASS =
  "pointer-events-none absolute inset-0 size-full object-cover [object-position:top_left]";

interface LiveDemoPreviewProps {
  /** Starting frame height in px. */
  height?: number;
  className?: string;
}

/**
 * The live demo in a frame, for full-page blocks a docs preview can't hold.
 * An iframe gives the demo its own viewport, so it lays out for the frame's
 * width (sidebars inline or as overlays) as it would on a screen that size.
 * A screenshot in the page's theme stands in until the frame loads, then
 * the demo fades in over it.
 */
export function LiveDemoPreview({
  height = DEFAULT_FRAME_HEIGHT,
  className,
}: LiveDemoPreviewProps) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // A frame on screen can finish loading before the page hydrates, which
  // `onLoad` would miss
  React.useEffect(() => {
    const document = frameRef.current?.contentDocument;
    if (
      document?.readyState === "complete" &&
      document.location.href !== "about:blank"
    ) {
      setIsLoaded(true);
    }
  }, []);

  return (
    <figure className={cn("docs-surface not-prose rounded-xl", className)}>
      <div
        data-live-demo
        data-loaded={isLoaded || undefined}
        className="relative min-h-[400px] max-h-[1080px] resize-y overflow-hidden rounded-t-xl bg-background"
        style={{ height }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a poster the frame covers, sized by CSS */}
        <img
          src={POSTER_LIGHT_SRC}
          alt=""
          className={cn(POSTER_CLASS, "dark:hidden")}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- same, for dark mode */}
        <img
          src={POSTER_DARK_SRC}
          alt=""
          className={cn(POSTER_CLASS, "hidden dark:block")}
        />
        <iframe
          ref={frameRef}
          src={LIVE_DEMO_PATH}
          title="CalendarCN live demo"
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "relative block size-full border-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
            isLoaded ? "opacity-100" : "opacity-0",
          )}
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
