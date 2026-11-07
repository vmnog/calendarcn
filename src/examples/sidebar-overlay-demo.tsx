"use client";

import * as React from "react";
import { CalendarDays, Inbox, Settings } from "lucide-react";

import { SidebarOverlay } from "@/components/sidebar-overlay";
import { Button } from "@/components/ui/button";

/** Rows of the example sidebar */
const ITEMS = [
  { label: "Calendar", icon: CalendarDays },
  { label: "Inbox", icon: Inbox },
  { label: "Settings", icon: Settings },
];

export function SidebarOverlayDemo() {
  const [open, setOpen] = React.useState(false);
  const [side, setSide] = React.useState<"left" | "right">("left");

  const openFrom = (nextSide: "left" | "right") => {
    setSide(nextSide);
    setOpen(true);
  };

  return (
    <div className="flex h-full items-center justify-center gap-2">
      <Button variant="outline" onClick={() => openFrom("left")}>
        Open from the left
      </Button>
      <Button variant="outline" onClick={() => openFrom("right")}>
        Open from the right
      </Button>
      <SidebarOverlay
        open={open}
        onOpenChange={setOpen}
        side={side}
        title="Example sidebar"
        description="A sidebar shown as a sheet."
        style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
      >
        <div className="flex h-14 shrink-0 items-center px-4 text-sm font-semibold text-sidebar-primary">
          Workspace
        </div>
        <nav className="flex flex-col gap-0.5 px-2">
          {ITEMS.map(({ label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              className="flex h-8 items-center gap-2 rounded-sm px-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => setOpen(false)}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>
      </SidebarOverlay>
    </div>
  );
}
