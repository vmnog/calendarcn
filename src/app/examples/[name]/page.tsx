import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  FRAMED_EXAMPLES,
  isExampleName,
  isFramedExample,
  renderExample,
} from "@/components/docs/examples";

interface ExampleFramePageProps {
  params: Promise<{ name: string }>;
}

/** Only the framed examples have a page: any other name is a 404 */
export const dynamicParams = false;

export function generateStaticParams() {
  return FRAMED_EXAMPLES.map((name) => ({ name }));
}

/** The docs page that frames it is the one to find, not the frame's content */
export const metadata: Metadata = {
  title: "Example - CalendarCN",
  robots: { index: false, follow: false },
};

/**
 * One docs example alone on a page, for `ComponentPreview` to show in an
 * iframe: a full-page block such as Calendar App lays out for the viewport,
 * and the frame gives it one of its own.
 */
export default async function ExampleFramePage({
  params,
}: ExampleFramePageProps) {
  const { name } = await params;
  if (!isExampleName(name) || !isFramedExample(name)) {
    notFound();
  }

  return renderExample(name);
}
