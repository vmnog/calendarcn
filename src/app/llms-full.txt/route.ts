import { getPageMarkdown } from "@/components/docs/markdown";
import { getDocsSections } from "@/lib/source";

/** Rendered once, at build time */
export const revalidate = false;

/** Line between two pages: each one starts with its own `#` heading */
const PAGE_SEPARATOR = "\n---\n\n";

/**
 * Every docs page's Markdown in one file, in sidebar order, the changelog and
 * roadmap included: an assistant updating an install needs the breaking
 * changes.
 */
export async function GET() {
  const pages = getDocsSections().flatMap((section) => section.pages);
  const markdown = await Promise.all(pages.map(getPageMarkdown));

  return new Response(markdown.join(PAGE_SEPARATOR), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
