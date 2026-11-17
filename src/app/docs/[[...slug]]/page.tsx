import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page";
import { createRelativeLink } from "fumadocs-ui/mdx";

import { DocsEyebrow } from "@/components/docs/docs-eyebrow";
import { InstallTabs } from "@/components/docs/install-tabs";
import type { InstallTabsProps } from "@/components/docs/install-tabs";
import { getMDXComponents } from "@/components/docs/mdx-components";
import { SITE_URL, getMarkdownPath, source } from "@/lib/source";

/** Social preview image, the same one the root layout uses (served from `public/`). */
const OG_IMAGE = "/og-image.png";

/** X/Twitter handle credited on shared docs links. */
const TWITTER_HANDLE = "@mevmnog";

/** Folder of the pages' MDX files on GitHub, for the Open menu's "Open in GitHub". */
const CONTENT_URL =
  "https://github.com/vmnog/calendarcn/blob/main/content/docs";

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
  const markdownPath = getMarkdownPath(page);

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      footer={{ className: "docs-footer" }}
    >
      <DocsEyebrow url={page.url} />
      <DocsTitle className="text-[2rem] leading-[1.1] font-bold tracking-[-0.03em] text-balance sm:text-[2.5rem]">
        {page.data.title}
      </DocsTitle>
      <DocsDescription className="mb-4 max-w-[64ch] leading-[1.55] text-pretty">
        {page.data.description}
      </DocsDescription>
      {/* The page for an AI assistant: its Markdown to paste, or opened in one */}
      <div className="not-prose mb-8 flex flex-wrap items-center gap-2">
        <MarkdownCopyButton
          markdownUrl={markdownPath}
          className="docs-page-action"
        />
        <ViewOptionsPopover
          markdownUrl={markdownPath}
          githubUrl={`${CONTENT_URL}/${page.path}`}
          // Assistants read the Markdown, on the live site whatever host this is
          pageUrl={`${SITE_URL}${markdownPath}`}
          className="docs-page-action"
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
            // The Prompt tab sends an assistant to the page the tabs are on
            InstallTabs: (props: InstallTabsProps) => (
              <InstallTabs {...props} docsUrl={`${SITE_URL}${markdownPath}`} />
            ),
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
    alternates: {
      canonical: page.url,
      // Tells an assistant reading the page where its Markdown is
      types: { "text/markdown": getMarkdownPath(page) },
    },
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
