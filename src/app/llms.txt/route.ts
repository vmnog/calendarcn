import { SITE_URL, getDocsSections, getMarkdownPath } from "@/lib/source";
import type { DocsPage } from "@/lib/source";

/** Rendered once, at build time */
export const revalidate = false;

/** What CalendarCN is and where an assistant finds the rest, above the list of pages */
const INTRO = `# CalendarCN

> An open-source calendar for React inspired by Notion Calendar: day, week, month, year and agenda views, drag to move and resize, multi-day events, time zones, dark mode and keyboard shortcuts. Built on shadcn/ui and Tailwind CSS, and installed with the shadcn CLI, which copies the source into your project.

- Install the full calendar with \`npx shadcn@latest add @calendarcn/calendar\`. The CLI finds the \`@calendarcn\` registry by itself, and every component is an item named \`@calendarcn/<name>\`. Setup and requirements (Tailwind CSS 4, React 19) are on the Installation page.
- Registry index, listing every item: ${SITE_URL}/r/registry.json
- All of the docs in one file: ${SITE_URL}/llms-full.txt
- Every page below is Markdown. A docs page's URL plus \`.md\` is that page as Markdown.`;

/** A page as a list item: its title linking its Markdown, then its description */
function formatPage(page: DocsPage): string {
  const link = `[${page.data.title}](${SITE_URL}${getMarkdownPath(page)})`;
  const description = page.data.description?.trim();
  return description ? `- ${link}: ${description}` : `- ${link}`;
}

/**
 * The docs' index for AI assistants (llmstxt.org): an intro, then every page
 * with its description and its Markdown URL, grouped as the sidebar groups
 * them.
 */
export function GET() {
  const sections = getDocsSections().map(
    ({ title, pages }) => `## ${title}\n\n${pages.map(formatPage).join("\n")}`,
  );

  return new Response(`${[INTRO, ...sections].join("\n\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
