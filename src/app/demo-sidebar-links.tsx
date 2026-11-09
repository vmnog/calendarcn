"use client";

import Link from "next/link";
import { BookOpen, Github } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Where the GitHub button goes */
const REPOSITORY_URL = "https://github.com/vmnog/calendarcn";

/**
 * The demo's docs and GitHub buttons, in the calendar sidebar's footer
 * before the theme toggle. A Next.js `Link` keeps the docs a client-side
 * navigation away.
 */
export function DemoSidebarLinks() {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-sidebar-foreground"
            asChild
          >
            <Link href="/docs">
              <BookOpen className="size-4" />
              <span className="sr-only">Documentation</span>
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Go to docs</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-sidebar-foreground"
            asChild
          >
            <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
              <Github className="size-4" />
              <span className="sr-only">GitHub repository</span>
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Go to repo</TooltipContent>
      </Tooltip>
    </>
  );
}
