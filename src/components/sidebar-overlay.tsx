"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface SidebarOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
  /** Accessible name of the dialog (visually hidden) */
  title: string;
  /** Accessible description of the dialog (visually hidden) */
  description: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Renders sidebar content as a modal sheet on narrow viewports.
 *
 * Mirrors the mobile branch of the shadcn `Sidebar` (same Sheet, same
 * classes), but lets the caller own the open state and the breakpoint.
 * Closes on outside tap and Escape via the Radix dialog.
 */
export function SidebarOverlay({
  open,
  onOpenChange,
  side,
  title,
  description,
  className,
  style,
  children,
}: SidebarOverlayProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        side={side}
        className={cn(
          "bg-sidebar text-sidebar-foreground w-(--sidebar-width) max-w-[85vw] gap-0 p-0 [&>button]:hidden",
          className,
        )}
        style={style}
        // Focus the sheet itself rather than its first field: autofocusing the
        // search input would pop the phone keyboard and swallow the "/" toggle
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          if (e.currentTarget instanceof HTMLElement) e.currentTarget.focus();
        }}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
