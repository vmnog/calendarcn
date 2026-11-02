import type { Node } from "fumadocs-core/page-tree";

import { source } from "@/lib/source";

interface DocsEyebrowProps {
  /** URL of the current page. */
  url: string;
}

/**
 * Name of the sidebar section (a `---Name---` separator in `meta.json`) that
 * lists the page at `url`, or the folder holding it.
 */
function findSection(
  nodes: Node[],
  url: string,
  section?: string,
): string | undefined {
  let current = section;
  for (const node of nodes) {
    if (node.type === "separator") {
      current = typeof node.name === "string" ? node.name : undefined;
      continue;
    }
    if (node.type === "page") {
      if (node.url === url) {
        return current;
      }
      continue;
    }
    const folderName = typeof node.name === "string" ? node.name : current;
    if (node.index?.url === url) {
      return folderName;
    }
    const found = findSection(node.children, url, folderName);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Mono label above a page title naming its sidebar section, e.g. "Components". */
export function DocsEyebrow({ url }: DocsEyebrowProps) {
  const section = findSection(source.pageTree.children, url);
  if (!section) {
    return null;
  }

  return (
    <p className="font-mono text-[0.6875rem] leading-4 font-medium tracking-[0.16em] text-(--docs-nav-label) uppercase">
      {section}
    </p>
  );
}
