import type { ReactNode } from "react";
import { CalendarDaysIcon } from "lucide-react";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { RootProvider } from "fumadocs-ui/provider/next";

import { source } from "@/lib/source";

import "./docs.css";

/** Repository link shown in the docs header. */
const GITHUB_URL = "https://github.com/vmnog/calendarcn";

interface DocsRootLayoutProps {
  children: ReactNode;
}

export default function DocsRootLayout({ children }: DocsRootLayoutProps) {
  return (
    // The app's ThemeProvider (src/app/layout.tsx) already owns dark mode.
    <RootProvider theme={{ enabled: false }}>
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
        links={[{ text: "Demo", url: "/", active: "none" }]}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
