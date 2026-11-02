import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDaysIcon } from "lucide-react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";

import { DocsAnnouncement } from "@/components/docs/docs-announcement";
import { source } from "@/lib/source";

import "./docs.css";

/** Repository link shown in the docs header. */
const GITHUB_URL = "https://github.com/vmnog/calendarcn";

/** The live demo, the header's one filled button. */
const DEMO_URL = "/";

interface DocsRootLayoutProps {
  children: ReactNode;
}

export default function DocsRootLayout({ children }: DocsRootLayoutProps) {
  return (
    // The app's ThemeProvider (src/app/layout.tsx) already owns dark mode.
    <RootProvider theme={{ enabled: false }}>
      <DocsAnnouncement />
      <DocsLayout
        tree={source.getPageTree()}
        nav={{
          mode: "top",
          url: "/docs",
          title: (
            <>
              <CalendarDaysIcon className="size-5" />
              <span className="font-semibold">CalendarCN</span>
            </>
          ),
        }}
        githubUrl={GITHUB_URL}
        links={[
          {
            type: "custom",
            on: "nav",
            children: (
              <Link
                href={DEMO_URL}
                className="inline-flex h-8 items-center rounded-lg bg-(--docs-cta) px-3 text-sm font-medium text-white transition-[background-color,scale] duration-150 ease-out hover:bg-(--docs-cta-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--docs-cta) active:scale-[0.96] motion-reduce:active:scale-100"
              >
                Live demo
              </Link>
            ),
          },
          { text: "Demo", url: DEMO_URL, active: "none", on: "menu" },
        ]}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
