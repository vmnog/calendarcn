import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

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
  title: "CalendarCN - Beautiful Open Source Calendar for React",
  description:
    "A beautifully crafted calendar component for React. Built with shadcn/ui and Tailwind CSS, inspired by Notion Calendar. Features week view, dark mode, event colors, and more.",
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
  authors: [{ name: "Victor Nogueira", url: "https://vmnog.com" }],
  creator: "Victor Nogueira",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://calendarcn.vercel.app",
    title: "CalendarCN - Beautiful Open Source Calendar for React",
    description:
      "A beautifully crafted calendar component built with shadcn/ui and Tailwind CSS, inspired by Notion Calendar. Week view, dark mode, and more.",
    siteName: "CalendarCN",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CalendarCN - Beautiful Open Source Calendar for React",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CalendarCN - Beautiful Open Source Calendar for React",
    description:
      "A beautifully crafted calendar component built with shadcn/ui and Tailwind CSS, inspired by Notion Calendar. Week view, dark mode, and more.",
    images: ["/og-image.png"],
    creator: "@mevmnog",
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
