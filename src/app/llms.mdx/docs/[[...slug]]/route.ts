import { notFound } from "next/navigation";

import { getPageMarkdown } from "@/components/docs/markdown";
import { source } from "@/lib/source";

/** Rendered once, at build time */
export const revalidate = false;

/** A path that isn't a docs page is a 404, never rendered on request */
export const dynamicParams = false;

interface MarkdownRouteContext {
  params: Promise<{ slug?: string[] }>;
}

/**
 * A docs page as Markdown. `next.config.ts` rewrites the page's URL plus
 * `.md` here (`/docs/components/week-view.md`, and `/docs.md` for the
 * introduction).
 */
export async function GET(_request: Request, { params }: MarkdownRouteContext) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  return new Response(await getPageMarkdown(page), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

export function generateStaticParams() {
  return source.generateParams();
}
