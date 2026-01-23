import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { Agentation } from "agentation";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Calendar CN - Open Source Calendar Component",
  description:
    "A beautifully crafted calendar component for React. Built with shadcn/ui, inspired by Notion Calendar. Week view, dark mode, and more.",
  keywords: [
    "calendar",
    "react",
    "nextjs",
    "shadcn",
    "tailwind",
    "open source",
    "notion calendar",
    "week view",
    "dark mode",
  ],
  authors: [{ name: "Victor Nogueira", url: "https://github.com/vmnog" }],
  creator: "Victor Nogueira",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://calendarcn.vercel.app",
    title: "Calendar CN - Open Source Calendar Component",
    description:
      "A beautifully crafted calendar component for React. Built with shadcn/ui, inspired by Notion Calendar.",
    siteName: "Calendar CN",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Calendar CN - Open Source Calendar Component",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Calendar CN - Open Source Calendar Component",
    description:
      "A beautifully crafted calendar component for React. Built with shadcn/ui, inspired by Notion Calendar.",
    images: ["/og-image.png"],
    creator: "@vmaborern",
  },
  metadataBase: new URL("https://calendarcn.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {process.env.NODE_ENV === "development" && <Agentation />}
        </ThemeProvider>
      </body>
    </html>
  );
}
