"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
} from "lucide-react";

import { addWeeks, startOfWeek } from "date-fns";
import { generateMockEvents } from "@/lib/mock-events";
import { SidebarLeft } from "@/components/sidebar-left";
import { SidebarRight } from "@/components/sidebar-right";
import { WeekView, getCalendarHeaderInfo, getVisibleDays } from "@/components/week-view";
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
  const [currentDate, setCurrentDate] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const goToToday = React.useCallback(() => setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 0 })), []);
  const goToPrevWeek = React.useCallback(
    () => setCurrentDate((prev) => addWeeks(prev, -1)),
    []
  );
  const goToNextWeek = React.useCallback(
    () => setCurrentDate((prev) => addWeeks(prev, 1)),
    []
  );
  const goToDate = React.useCallback(
    (date: Date) => setCurrentDate(date),
    []
  );
  const goToDateWeek = React.useCallback(
    (date: Date) => setCurrentDate(startOfWeek(date, { weekStartsOn: 0 })),
    []
  );
  const { toggleSidebar, open: rightSidebarOpen } = useSidebar();

  const [visibleDays, setVisibleDays] = React.useState<Date[]>(() => getVisibleDays(currentDate));

  const { monthName, year, weekNumber } = getCalendarHeaderInfo(visibleDays[0], 0);

  const events = React.useMemo(
    () => generateMockEvents(),
    []
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
      // Skip single-key shortcuts when focused on input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      // / for right sidebar
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // T for today
      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        goToToday();
        return;
      }

      // J or ArrowLeft for previous week
      if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevWeek();
        return;
      }

      // K or ArrowRight for next week
      if (e.key === "k" || e.key === "K" || e.key === "ArrowRight") {
        e.preventDefault();
        goToNextWeek();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, goToToday, goToPrevWeek, goToNextWeek]);

  return (
    <>
      <SidebarRight open={leftSidebarOpen} onDateSelect={goToDateWeek} currentDate={currentDate} visibleDays={visibleDays} />
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
                <DropdownMenuItem disabled>
                  Day
                  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">Soon</span>
                </DropdownMenuItem>
                <DropdownMenuItem>Week</DropdownMenuItem>
                <DropdownMenuItem disabled>
                  Month
                  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">Soon</span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  Year
                  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">Soon</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="sm" className="px-3" onClick={goToToday}>
              Today
            </Button>
            <div className="flex items-center">
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={goToPrevWeek}>
                <ChevronLeftIcon className="size-4" />
                <span className="sr-only">Previous week</span>
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={goToNextWeek}>
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
          <WeekView currentDate={currentDate} events={events} onDateChange={goToDate} onVisibleDaysChange={setVisibleDays} />
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
