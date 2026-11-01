import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";

/** Full-text search over `/docs`, queried by the Fumadocs search dialog (Cmd+K). */
export const { GET } = createFromSource(source, {
  language: "english",
});
