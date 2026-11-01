import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const nextConfig: NextConfig = {
  /* config options here */
};

/** Compiles `content/docs` MDX for the `/docs` route (see `source.config.ts`). */
const withMDX = createMDX();

export default withMDX(nextConfig);
