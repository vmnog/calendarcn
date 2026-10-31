import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/notebook/page";
import { createRelativeLink } from "fumadocs-ui/mdx";

import { getMDXComponents } from "@/components/docs/mdx-components";
import { source } from "@/lib/source";

/** Social preview image, the same one the root layout uses (served from `public/`). */
const OG_IMAGE = "/og-image.png";

/** X/Twitter handle credited on shared docs links. */
const TWITTER_HANDLE = "@mevmnog";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      footer={{ className: "docs-footer" }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) {
    notFound();
  }

  const title = `${page.data.title} - CalendarCN`;
  const description = page.data.description;

  // Relative URLs resolve against `metadataBase` (https://calendarcn.xyz) in
  // the root layout. Next replaces nested objects like `openGraph` instead of
  // merging them, so the shared fields are repeated here.
  return {
    title,
    description,
    alternates: { canonical: page.url },
    openGraph: {
      type: "article",
      siteName: "CalendarCN",
      url: page.url,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
      creator: TWITTER_HANDLE,
    },
  };
}
