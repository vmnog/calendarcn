"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Banner } from "fumadocs-ui/components/banner";

/** Bar height. Fumadocs offsets the sticky header and sidebar by it. */
const ANNOUNCEMENT_HEIGHT = "2.25rem";

/** Page the announcement links to. */
const ANNOUNCEMENT_HREF = "/docs/installation";

/** Finds the bar, so the scroll listener can measure how much of it shows. */
const ANNOUNCEMENT_SELECTOR = "[data-docs-announcement]";

/**
 * Fumadocs' offset for the sticky header, sidebar and table of contents.
 * `Banner` sets it to the bar's full height on `:root`.
 */
const BANNER_HEIGHT_VARIABLE = "--fd-banner-height";

/**
 * One-line announcement above the docs header: a mono tag, the news and an arrow.
 *
 * The bar scrolls away with the page. Fumadocs' `Banner` is sticky, but its
 * parent is `body`, one viewport tall, so it left after one screen while the
 * header, sidebar and table of contents kept its full height as their offset,
 * leaving a gap above the header. So the bar is `relative`, and
 * `--fd-banner-height` follows the part of it still on screen: its full height
 * at the top of the page, then 0 once it's gone, and the header sticks to the
 * very top.
 */
export function DocsAnnouncement() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>(ANNOUNCEMENT_SELECTOR);
    if (!bar) return;
    const root = document.documentElement;
    let shownHeight = "";

    const syncShownHeight = () => {
      const { bottom, height } = bar.getBoundingClientRect();
      const next = `${Math.min(Math.max(bottom, 0), height)}px`;
      if (next === shownHeight) return;
      shownHeight = next;
      root.style.setProperty(BANNER_HEIGHT_VARIABLE, next);
    };

    syncShownHeight();
    window.addEventListener("scroll", syncShownHeight, { passive: true });
    return () => {
      window.removeEventListener("scroll", syncShownHeight);
      root.style.removeProperty(BANNER_HEIGHT_VARIABLE);
    };
  }, []);

  return (
    <Banner
      data-docs-announcement=""
      height={ANNOUNCEMENT_HEIGHT}
      className="relative border-b bg-fd-background text-[0.8125rem] font-normal"
    >
      <Link
        href={ANNOUNCEMENT_HREF}
        className="inline-flex items-center gap-2.5 rounded-sm text-fd-foreground transition-colors hover:text-fd-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
      >
        <span className="rounded-[4px] border border-(--docs-accent-line) px-1.5 py-1 font-mono text-[0.625rem] leading-none font-medium tracking-[0.1em] text-(--docs-accent) uppercase">
          Registry
        </span>
        <span>Install CalendarCN with the shadcn CLI</span>
        <ArrowRightIcon aria-hidden className="size-3.5 shrink-0" />
      </Link>
    </Banner>
  );
}
