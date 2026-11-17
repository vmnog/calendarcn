import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/** An MDX expression that holds only a block comment, the way MDX pages write a comment */
const MDX_COMMENT = /^\s*\/\*[\s\S]*\*\/\s*$/;

/**
 * MDX pages and `meta.json` sidebar ordering for the `/docs` route.
 * `fumadocs-mdx` compiles this into `.source/` (imported as `collections/*`).
 *
 * `includeProcessedMarkdown` adds a `_markdown` export to every page: the page
 * as Markdown, for `/llms.txt`, `/llms-full.txt` and `<page-url>.md`. With
 * `output: "function"` it's a component whose MDX components keep their
 * evaluated props (a `PropsTable`'s `rows`), so each one can write its own
 * Markdown (`src/components/docs/markdown.ts`).
 */
export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: {
        output: "function",
        // `## Title [#title]` isn't Markdown outside Fumadocs
        headingIds: false,
        bullet: "-",
        // An MDX comment is a note to the page's authors
        filterElement: (node) =>
          !(
            (node.type === "mdxFlowExpression" ||
              node.type === "mdxTextExpression") &&
            MDX_COMMENT.test(node.value)
          ),
      },
    },
  },
});

export default defineConfig();
