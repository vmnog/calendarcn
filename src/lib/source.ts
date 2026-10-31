import { loader } from "fumadocs-core/source";
import { docs } from "collections/server";

/** Page tree and page lookup for the `/docs` route (collection in `source.config.ts`). */
export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
