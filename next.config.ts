import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

/**
 * Endings that turn a docs URL into that page's Markdown. `.md` is the one the
 * docs link; `.mdx` answers too, because assistants that know Fumadocs sites
 * guess it.
 */
const MARKDOWN_EXTENSIONS = ["md", "mdx"];

/** An `Accept` header that names Markdown, as AI assistants send and browsers don't */
const MARKDOWN_ACCEPT = ".*text/markdown.*";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Before the pages, in this order: a docs page is prerendered, and a
      // host that serves it as a file would never reach a later rewrite.
      beforeFiles: [
        // Every docs page as Markdown (the route in `src/app/llms.mdx`)
        ...MARKDOWN_EXTENSIONS.flatMap((extension) => [
          { source: `/docs.${extension}`, destination: "/llms.mdx/docs" },
          {
            source: `/docs/:path*.${extension}`,
            destination: "/llms.mdx/docs/:path*",
          },
        ]),
        // A docs URL itself answers with Markdown when the request asks for it
        {
          source: "/docs/:path*",
          has: [{ type: "header", key: "accept", value: MARKDOWN_ACCEPT }],
          destination: "/llms.mdx/docs/:path*",
        },
      ],
    };
  },
};

/** Compiles `content/docs` MDX for the `/docs` route (see `source.config.ts`). */
const withMDX = createMDX();

export default withMDX(nextConfig);
