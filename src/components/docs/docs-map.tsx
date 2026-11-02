import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownIcon, CalendarDaysIcon, GithubIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** The live demo, where the closing card sends people who want to try first. */
const DEMO_URL = "/";

/** Repository link, the closing card's second way in. */
const GITHUB_URL = "https://github.com/vmnog/calendarcn";

/** Focus ring shared by the cards and buttons. */
const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring";

export interface DocsMapQuestion {
  /** The question, phrased the way a reader would ask it. */
  question: string;
  /** Anchor of the section on the page that answers it, e.g. `#install`. */
  href: string;
}

interface DocsMapProps {
  /** Questions in reading order. The first is the suggested start. */
  questions: DocsMapQuestion[];
}

/**
 * Numbered question cards that jump to the sections answering them, in the
 * style of aihero.dev's map. Two columns, one on phones. The first card
 * carries the brand accent as the place to start.
 */
export function DocsMap({ questions }: DocsMapProps) {
  return (
    <nav aria-label="Map" className="not-prose my-6">
      <ol className="grid gap-2.5 sm:grid-cols-2">
        {questions.map(({ question, href }, index) => {
          const isHighlighted = index === 0;

          return (
            <li key={href} className="flex">
              <a
                href={href}
                data-highlighted={isHighlighted || undefined}
                className={cn(
                  "docs-map-card flex flex-1 items-center gap-3 rounded-md px-4 py-3.5",
                  FOCUS_RING_CLASS,
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "shrink-0 font-mono text-xs font-medium",
                    isHighlighted
                      ? "text-(--docs-accent)"
                      : "text-(--docs-nav-label)",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "text-base leading-snug font-medium text-pretty",
                    isHighlighted
                      ? "text-fd-foreground"
                      : "text-fd-foreground/85",
                  )}
                >
                  {question}
                </span>
                <ArrowDownIcon
                  aria-hidden
                  className={cn(
                    "ml-auto size-4 shrink-0",
                    isHighlighted
                      ? "text-(--docs-accent)"
                      : "text-(--docs-nav-label)",
                  )}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface DocsMapCtaProps {
  /** Short heading, e.g. "Not sure where to start?". */
  title: string;
  /** One or two sentences under the title. */
  children: ReactNode;
}

/**
 * Closing card under the map for readers who'd rather try than read: the
 * brand mark, a short pitch, and buttons to the live demo and the repository.
 */
export function DocsMapCta({ title, children }: DocsMapCtaProps) {
  return (
    <div className="not-prose docs-surface my-6 flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-(--docs-accent-wash) text-(--docs-accent)">
          <CalendarDaysIcon aria-hidden className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-[-0.01em] text-fd-foreground">
            {title}
          </p>
          <div className="mt-1 text-sm leading-relaxed text-pretty text-(--docs-nav-item)">
            {children}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link
          href={DEMO_URL}
          className={cn(
            "inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-(--docs-cta) px-3.5 text-sm font-medium text-white transition-[background-color,scale] duration-150 ease-out hover:bg-(--docs-cta-hover) active:scale-[0.96] motion-reduce:active:scale-100 sm:flex-none",
            FOCUS_RING_CLASS,
          )}
        >
          Open the live demo
        </Link>
        <a
          href={GITHUB_URL}
          className={cn(
            "docs-surface inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium text-fd-foreground sm:flex-none",
            FOCUS_RING_CLASS,
          )}
        >
          <GithubIcon aria-hidden className="size-4" />
          GitHub
        </a>
      </div>
    </div>
  );
}
