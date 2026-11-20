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

/**
 * Docs pages that moved, old path to new path (a `#section` when the page
 * became part of another one). Registry items link to the old URLs and the
 * shadcn CLI copies those links into people's projects, so never delete one.
 */
const DOCS_REDIRECTS: { from: string; to: string }[] = [
  {
    from: "/docs/components/time-grid",
    to: "/docs/components/day-week-view#time-grid",
  },
  {
    from: "/docs/components/day-view",
    to: "/docs/components/day-week-view#day-view",
  },
  { from: "/docs/components/week-view", to: "/docs/components/day-week-view" },
  {
    from: "/docs/components/mini-calendar",
    to: "/docs/components/calendar-sidebar#mini-calendar",
  },
  {
    from: "/docs/components/calendar-list",
    to: "/docs/components/calendar-sidebar#calendar-list",
  },
  {
    from: "/docs/components/theme-toggle",
    to: "/docs/components/calendar-sidebar#theme-toggle",
  },
  {
    from: "/docs/components/sidebar-overlay",
    to: "/docs/components/calendar-sidebar#sidebar-overlay",
  },
  {
    from: "/docs/components/people-picker",
    to: "/docs/guides/meet-with-people",
  },
  {
    from: "/docs/components/scheduling",
    to: "/docs/guides/share-your-availability",
  },
  {
    from: "/docs/components/calendar-toaster",
    to: "/docs/guides/undo-and-notices",
  },
  { from: "/docs/loading-events", to: "/docs/guides/loading-events" },
  { from: "/docs/import-export", to: "/docs/guides/import-export" },
  {
    from: "/docs/keyboard-shortcuts",
    to: "/docs/reference/keyboard-shortcuts",
  },
  { from: "/docs/sample-data", to: "/docs/reference/sample-data" },
  { from: "/docs/roadmap", to: "/docs/project/roadmap" },
  { from: "/docs/changelog", to: "/docs/project/changelog" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return DOCS_REDIRECTS.flatMap(({ from, to }) => {
      const [page] = to.split("#");
      return [
        { source: from, destination: to, permanent: true },
        // The Markdown versions follow their page, without the section
        ...MARKDOWN_EXTENSIONS.map((extension) => ({
          source: `${from}.${extension}`,
          destination: `${page}.${extension}`,
          permanent: true,
        })),
      ];
    });
  },
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
