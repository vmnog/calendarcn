import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/source";

/** `/robots.txt`: every crawler may read everything, and the sitemap lists it. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
