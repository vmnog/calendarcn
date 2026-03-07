"use client";

import * as React from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
} from "lucide-react";

import { addDays, addWeeks, format, startOfDay, startOfWeek } from "date-fns";
import { useTheme } from "next-themes";
import { generateMockEvents } from "@/lib/mock-events";
import { CommandMenu } from "@/components/command-menu";
import { SidebarLeft } from "@/components/sidebar-left";
import type { CalendarEvent, ViewType } from "@/components/week-view-types";
import { SidebarRight } from "@/components/sidebar-right";
import {
  WeekView,
  getCalendarHeaderInfo,
  getVisibleDays,
} from "@/components/week-view";
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
  const { theme, setTheme } = useTheme();
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true);
  const [view, setView] = React.useState<ViewType>("week");
  const [currentDate, setCurrentDate] = React.useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );
  const [events, setEvents] = React.useState(() => generateMockEvents());
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(
    null,
  );
  const [commandMenuOpen, setCommandMenuOpen] = React.useState(false);
  const selectedEvent = React.useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const handleEventChange = React.useCallback((updatedEvent: CalendarEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)),
    );
  }, []);

  const goToToday = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate(startOfDay(new Date()));
    } else {
      setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 0 }));
    }
  }, [view]);

  const goToPrev = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, -1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, -1));
    }
  }, [view]);

  const goToNext = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  }, [view]);

  const goToDate = React.useCallback((date: Date) => setCurrentDate(date), []);

  const goToDateWeek = React.useCallback(
    (date: Date) => {
      if (view === "day") {
        setCurrentDate(startOfDay(date));
      } else {
        setCurrentDate(startOfWeek(date, { weekStartsOn: 0 }));
      }
    },
    [view],
  );

  const switchView = React.useCallback(
    (newView: ViewType) => {
      if (newView === view) return;
      setView(newView);
      if (newView === "day") {
        // Week → Day: use today or keep current date
        setCurrentDate(startOfDay(new Date()));
      } else {
        // Day → Week: snap to week containing the current day
        setCurrentDate((prev) => startOfWeek(prev, { weekStartsOn: 0 }));
      }
    },
    [view],
  );

  const cycleTheme = React.useCallback(() => {
    if (theme === "system") {
      setTheme("light");
      return;
    }
    if (theme === "light") {
      setTheme("dark");
      return;
    }
    setTheme("system");
  }, [theme, setTheme]);

  const { toggleSidebar, open: rightSidebarOpen } = useSidebar();

  const [visibleDays, setVisibleDays] = React.useState<Date[]>(() =>
    getVisibleDays(currentDate, view),
  );

  const { monthName, year, weekNumber } = getCalendarHeaderInfo(
    visibleDays[0],
    0,
  );

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K for command menu
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandMenuOpen((prev) => !prev);
        return;
      }
      // Command + / for left sidebar
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
        return;
      }
      // Escape to deselect event
      if (e.key === "Escape") {
        setSelectedEventId(null);
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

      // D for day view
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        switchView("day");
        return;
      }

      // W for week view
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        switchView("week");
        return;
      }

      // J or ArrowLeft for previous period
      if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
        return;
      }

      // K or ArrowRight for next period
      if (e.key === "k" || e.key === "K" || e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
        return;
      }

      // M for cycle theme (system → light → dark)
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        cycleTheme();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, goToToday, goToPrev, goToNext, switchView, cycleTheme]);

  return (
    <>
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onGoToToday={goToToday}
        onGoToPrev={goToPrev}
        onGoToNext={goToNext}
        onSwitchView={switchView}
        onToggleLeftSidebar={() => setLeftSidebarOpen((prev) => !prev)}
        onToggleRightSidebar={toggleSidebar}
        onCycleTheme={cycleTheme}
      />
      <SidebarRight
        open={leftSidebarOpen}
        onDateSelect={goToDateWeek}
        currentDate={currentDate}
        visibleDays={visibleDays}
      />
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
                {leftSidebarOpen ? "Close" : "Open"} sidebar{" "}
                <Kbd className="ml-1">⌘</Kbd> <Kbd>/</Kbd>
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
                {view === "day"
                  ? format(currentDate, "EEEE, MMM d")
                  : `Week ${weekNumber}`}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2 px-4">
            <Avatar className="size-7">
              <AvatarImage
                src="https://github.com/vmnog.png"
                alt="Victor Nogueira"
              />
              <AvatarFallback>VN</AvatarFallback>
            </Avatar>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1 px-3">
                  {view === "day" ? "Day" : "Week"}
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => switchView("day")}>
                  Day
                  <Kbd className="ml-auto">D</Kbd>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => switchView("week")}>
                  Week
                  <Kbd className="ml-auto">W</Kbd>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  Month
                  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
                    Soon
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  Year
                  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
                    Soon
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="secondary"
              size="sm"
              className="px-3"
              onClick={goToToday}
            >
              Today
            </Button>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={goToPrev}
              >
                <ChevronLeftIcon className="size-4" />
                <span className="sr-only">
                  {view === "day" ? "Previous day" : "Previous week"}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground"
                onClick={goToNext}
              >
                <ChevronRightIcon className="size-4" />
                <span className="sr-only">
                  {view === "day" ? "Next day" : "Next week"}
                </span>
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
          <WeekView
            view={view}
            currentDate={currentDate}
            events={events}
            onEventClick={(e) => setSelectedEventId(e.id)}
            selectedEventId={selectedEvent?.id}
            onBackgroundClick={() => setSelectedEventId(null)}
            onDateChange={goToDate}
            onVisibleDaysChange={setVisibleDays}
            onEventChange={handleEventChange}
            isSidebarOpen={rightSidebarOpen}
            onDockToSidebar={() => {
              if (!rightSidebarOpen) toggleSidebar();
            }}
            onClosePopover={() => setSelectedEventId(null)}
            onPrevWeek={goToPrev}
            onNextWeek={goToNext}
          />
        </div>
      </SidebarInset>
      <SidebarLeft
        selectedEvent={selectedEvent}
        onPrevWeek={goToPrev}
        onNextWeek={goToNext}
      />
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
