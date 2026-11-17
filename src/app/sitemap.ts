import type { MetadataRoute } from "next";

import { SITE_URL, source } from "@/lib/source";

/** `/sitemap.xml`: the home page (the live demo) and every docs page. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL },
    ...source.getPages().map((page) => ({ url: `${SITE_URL}${page.url}` })),
  ];
}
