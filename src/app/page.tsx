"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
} from "lucide-react";

import { generateMockEvents } from "@/lib/mock-events";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { WeekView, getCalendarHeaderInfo } from "@/components/week-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";

function PageContent() {
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true);
  const [currentDate] = React.useState(() => new Date());
  const { toggleSidebar, open: rightSidebarOpen } = useSidebar();

  const { monthName, year, weekNumber } = getCalendarHeaderInfo(currentDate, 0);

  const events = React.useMemo(
    () => generateMockEvents(currentDate),
    [currentDate]
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command + / for left sidebar
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
        return;
      }
      // / for right sidebar (only if not in an input)
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <>
      <SidebarRight open={leftSidebarOpen} />
      <SidebarInset className="flex flex-col overflow-hidden">
        <header className="bg-background sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center gap-2 px-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={() => setLeftSidebarOpen((prev) => !prev)}
                >
                  <PanelLeftIcon />
                  <span className="sr-only">Toggle Calendar Sidebar</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {leftSidebarOpen ? "Close" : "Open"} sidebar <Kbd className="ml-1">⌘</Kbd> <Kbd>/</Kbd>
              </TooltipContent>
            </Tooltip>
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <h1 className="text-xl">
              <span className="font-extrabold">{monthName}</span>{" "}
              <span className="font-extrabold">{year}</span>{" "}
              <span className="text-muted-foreground text-xs">
                Week {weekNumber}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 px-4">
            <Avatar className="size-7">
              <AvatarImage src="https://github.com/vmnog.png" alt="Victor Nogueira" />
              <AvatarFallback>VN</AvatarFallback>
            </Avatar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1 px-3">
                  Week
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>Day</DropdownMenuItem>
                <DropdownMenuItem>Week</DropdownMenuItem>
                <DropdownMenuItem>Month</DropdownMenuItem>
                <DropdownMenuItem>Year</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="sm" className="px-3">
              Today
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                <ChevronLeftIcon className="size-4" />
                <span className="sr-only">Previous week</span>
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground">
                <ChevronRightIcon className="size-4" />
                <span className="sr-only">Next week</span>
              </Button>
            </div>
            {!rightSidebarOpen && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground"
                    onClick={toggleSidebar}
                  >
                    <PanelRightIcon />
                    <span className="sr-only">Toggle Navigation Sidebar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Open context panel <Kbd className="ml-1">/</Kbd>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-hidden">
          <WeekView currentDate={currentDate} events={events} />
        </div>
      </SidebarInset>
      <SidebarLeft />
    </>
  );
}

export default function Page() {
  return (
    <SidebarProvider className="h-screen">
      <PageContent />
    </SidebarProvider>
  );
}
