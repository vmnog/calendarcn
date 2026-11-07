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

/**
 * Points shadcn/ui's `--sidebar-*` colors at the calendar's own
 * `--calendar-sidebar-*` tokens, for the element it's on and everything
 * inside. The calendar and details sidebars put it on their root, so they
 * keep Notion Calendar's colors without changing the rest of the app's
 * sidebar theme.
 */
export const CALENDAR_SIDEBAR_COLORS_CLASS = cn(
  "[--sidebar:var(--calendar-sidebar)]",
  "[--sidebar-foreground:var(--calendar-sidebar-foreground)]",
  "[--sidebar-primary:var(--calendar-sidebar-primary)]",
  "[--sidebar-primary-foreground:var(--calendar-sidebar-primary-foreground)]",
  "[--sidebar-accent:var(--calendar-sidebar-accent)]",
  "[--sidebar-accent-foreground:var(--calendar-sidebar-accent-foreground)]",
  "[--sidebar-border:var(--calendar-sidebar-border)]",
  "[--sidebar-ring:var(--calendar-sidebar-ring)]",
);

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
 * Closes on outside tap and Escape.
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
          CALENDAR_SIDEBAR_COLORS_CLASS,
          "bg-sidebar text-sidebar-foreground w-(--sidebar-width) max-w-[85vw] gap-0 p-0 [&>button]:hidden",
          className,
        )}
        style={style}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <OverlayBody>{children}</OverlayBody>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The sheet's content, focused when the sheet opens instead of its first
 * field: autofocusing the search input would pop the phone keyboard and
 * swallow the "/" toggle. It focuses itself in a layout effect, before the
 * dialog's own open autofocus runs, which then keeps focus where it is
 * (Radix and Base UI both skip it while focus is already inside).
 */
function OverlayBody({ children }: { children: React.ReactNode }) {
  const bodyRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    bodyRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      ref={bodyRef}
      tabIndex={-1}
      className="flex h-full w-full flex-col outline-none"
    >
      {children}
    </div>
  );
}
