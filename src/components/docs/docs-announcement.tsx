import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Banner } from "fumadocs-ui/components/banner";

/** Bar height. Fumadocs offsets the sticky header and sidebar by it. */
const ANNOUNCEMENT_HEIGHT = "2.25rem";

/** Page the announcement links to. */
const ANNOUNCEMENT_HREF = "/docs/installation";

/** One-line announcement above the docs header: a mono tag, the news and an arrow. */
export function DocsAnnouncement() {
  return (
    <Banner
      height={ANNOUNCEMENT_HEIGHT}
      className="border-b bg-fd-background text-[0.8125rem] font-normal"
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
