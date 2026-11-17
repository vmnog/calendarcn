import { loader } from "fumadocs-core/source";
import type { InferPageType } from "fumadocs-core/source";
import type { Node } from "fumadocs-core/page-tree";
import { docs } from "collections/server";

/** Page tree and page lookup for the `/docs` route (collection in `source.config.ts`). */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

/**
 * Where the site is served: the origin of the absolute URLs in `/llms.txt`,
 * the pages' Markdown, `/sitemap.xml` and `/robots.txt`.
 */
export const SITE_URL = "https://calendarcn.xyz";

/** A docs page, as `source.getPage()` returns it */
export type DocsPage = InferPageType<typeof source>;

/** A sidebar group (a `---Name---` separator in `meta.json`) and its pages */
export interface DocsSection {
  title: string;
  pages: DocsPage[];
}

/** Title of the pages the sidebar lists above its first group */
const UNGROUPED_SECTION_TITLE = "Docs";

/**
 * Path of a page's Markdown: its URL plus `.md`, so `/docs.md` for the
 * introduction. `next.config.ts` rewrites it to the route that renders it.
 */
export function getMarkdownPath(page: DocsPage): string {
  return `${page.url}.md`;
}

/**
 * Every docs page in sidebar order, grouped as the sidebar groups them.
 * `/llms.txt` and `/llms-full.txt` list the pages in this order.
 */
export function getDocsSections(): DocsSection[] {
  const sections: DocsSection[] = [];

  function addPage(page: DocsPage | undefined) {
    if (!page) return;
    if (sections.length === 0) {
      sections.push({ title: UNGROUPED_SECTION_TITLE, pages: [] });
    }
    sections[sections.length - 1].pages.push(page);
  }

  function addNodes(nodes: Node[]) {
    for (const node of nodes) {
      if (node.type === "separator") {
        const title = typeof node.name === "string" ? node.name : "";
        sections.push({ title, pages: [] });
        continue;
      }
      if (node.type === "page") {
        addPage(source.getNodePage(node));
        continue;
      }
      // A folder's pages join the group the folder is listed in
      if (node.index) addPage(source.getNodePage(node.index));
      addNodes(node.children);
    }
  }

  addNodes(source.getPageTree().children);
  return sections.filter((section) => section.pages.length > 0);
}
