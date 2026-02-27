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
import { generateMockEvents } from "@/lib/mock-events";
import { SidebarLeft } from "@/components/sidebar-left";
import type { CalendarEvent } from "@/components/week-view-types";
import { SidebarRight } from "@/components/sidebar-right";
import { WeekView, getCalendarHeaderInfo, getVisibleDays } from "@/components/week-view";
import { DayView, getDayHeaderInfo } from "@/components/day-view";

type CalendarView = "day" | "week";
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
  const [currentView, setCurrentView] = React.useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [events, setEvents] = React.useState(() => generateMockEvents());
  const [dirtyEventIds, setDirtyEventIds] = React.useState(() => new Set<string>());
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
  const selectedEvent = React.useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const handleEventChange = React.useCallback((updatedEvent: CalendarEvent) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e))
    );
    setDirtyEventIds((prev) => new Set(prev).add(updatedEvent.id));
  }, []);

  const switchView = React.useCallback((view: CalendarView) => {
    if (view === currentView) return;
    if (view === "day") {
      const today = startOfDay(new Date());
      setCurrentView("day");
      setCurrentDate(today);
      setVisibleDays([today]);
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      setCurrentView("week");
      setCurrentDate(weekStart);
      setVisibleDays(getVisibleDays(weekStart));
    }
  }, [currentView, currentDate]);

  const goToToday = React.useCallback(() => {
    if (currentView === "day") {
      setCurrentDate(startOfDay(new Date()));
    } else {
      setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 0 }));
    }
  }, [currentView]);

  const goToPrev = React.useCallback(() => {
    if (currentView === "day") {
      setCurrentDate((prev) => addDays(prev, -1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, -1));
    }
  }, [currentView]);

  const goToNext = React.useCallback(() => {
    if (currentView === "day") {
      setCurrentDate((prev) => addDays(prev, 1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, 1));
    }
  }, [currentView]);

  const goToDate = React.useCallback(
    (date: Date) => setCurrentDate(date),
    []
  );
  const goToDateFromSidebar = React.useCallback(
    (date: Date) => {
      if (currentView === "day") {
        setCurrentDate(startOfDay(date));
      } else {
        setCurrentDate(startOfWeek(date, { weekStartsOn: 0 }));
      }
    },
    [currentView]
  );
  const { toggleSidebar, open: rightSidebarOpen } = useSidebar();

  const [visibleDays, setVisibleDays] = React.useState<Date[]>(() =>
    currentView === "day" ? [currentDate] : getVisibleDays(currentDate)
  );

  const weekHeaderInfo = getCalendarHeaderInfo(visibleDays[0] ?? currentDate, 0);
  const dayHeaderInfo = getDayHeaderInfo(visibleDays[0] ?? currentDate);

  const navLabel = currentView === "day" ? "day" : "week";

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "/") {
        e.preventDefault();
        setLeftSidebarOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape") {
        setSelectedEventId(null);
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        goToToday();
        return;
      }

      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        switchView("day");
        return;
      }

      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        switchView("week");
        return;
      }

      if (e.key === "j" || e.key === "J" || e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
        return;
      }

      if (e.key === "k" || e.key === "K" || e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, goToToday, goToPrev, goToNext, switchView]);

  return (
    <>
      <SidebarRight open={leftSidebarOpen} onDateSelect={goToDateFromSidebar} currentDate={currentDate} visibleDays={visibleDays} />
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
              {currentView === "day" ? (
                <>
                  <span className="font-extrabold">
                    {dayHeaderInfo.monthName} {dayHeaderInfo.dayNumber}
                  </span>{" "}
                  <span className="text-muted-foreground text-xs">
                    {dayHeaderInfo.dayName}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-extrabold">{weekHeaderInfo.monthName}</span>{" "}
                  <span className="font-extrabold">{weekHeaderInfo.year}</span>{" "}
                  <span className="text-muted-foreground text-xs">
                    Week {weekHeaderInfo.weekNumber}
                  </span>
                </>
              )}
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
                  {currentView === "day" ? "Day" : "Week"}
                  <ChevronDownIcon className="size-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => switchView("day")}>
                  Day
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => switchView("week")}>
                  Week
                </DropdownMenuItem>
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
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={goToPrev}>
                <ChevronLeftIcon className="size-4" />
                <span className="sr-only">Previous {navLabel}</span>
              </Button>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={goToNext}>
                <ChevronRightIcon className="size-4" />
                <span className="sr-only">Next {navLabel}</span>
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
          {currentView === "day" ? (
            <DayView
              currentDate={currentDate}
              events={events}
              onEventClick={(e) => setSelectedEventId(e.id)}
              selectedEventId={selectedEvent?.id}
              onBackgroundClick={() => setSelectedEventId(null)}
              onDateChange={goToDate}
              onVisibleDaysChange={setVisibleDays}
              onEventChange={handleEventChange}
              dirtyEventIds={dirtyEventIds}
            />
          ) : (
            <WeekView
              currentDate={currentDate}
              events={events}
              onEventClick={(e) => setSelectedEventId(e.id)}
              selectedEventId={selectedEvent?.id}
              onBackgroundClick={() => setSelectedEventId(null)}
              onDateChange={goToDate}
              onVisibleDaysChange={setVisibleDays}
              onEventChange={handleEventChange}
              dirtyEventIds={dirtyEventIds}
            />
          )}
        </div>
      </SidebarInset>
      <SidebarLeft selectedEvent={selectedEvent} onPrevWeek={goToPrev} onNextWeek={goToNext} />
    </>
  );
}

export default function Page() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <SidebarProvider className="h-screen">
      <PageContent />
    </SidebarProvider>
  );
}
