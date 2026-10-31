import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/**
 * MDX pages and `meta.json` sidebar ordering for the `/docs` route.
 * `fumadocs-mdx` compiles this into `.source/` (imported as `collections/*`).
 */
export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
