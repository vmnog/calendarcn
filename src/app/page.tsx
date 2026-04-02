"use client";

import * as React from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PanelLeftIcon,
  PanelRightIcon,
} from "lucide-react";

import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useTheme } from "next-themes";
import { generateMockEvents } from "@/lib/mock-events";
import { CommandMenu } from "@/components/command-menu";
import { SidebarLeft } from "@/components/sidebar-left";
import type {
  CalendarEvent,
  ViewSettings,
  ViewType,
} from "@/components/week-view-types";
import { SidebarRight } from "@/components/sidebar-right";
import { MonthView } from "@/components/month-view";
import {
  WeekView,
  getCalendarHeaderInfo,
  getVisibleDays,
} from "@/components/week-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ViewDropdown } from "@/components/view-dropdown";
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
  const [numberOfDays, setNumberOfDays] = React.useState(7);
  const [viewSettings, setViewSettings] = React.useState<ViewSettings>({
    showWeekends: true,
    showDeclinedEvents: true,
    showWeekNumbers: true,
  });
  const [highlightedDate, setHighlightedDate] = React.useState<Date | null>(
    null,
  );
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
    } else if (view === "month") {
      setCurrentDate(startOfMonth(new Date()));
    } else {
      setCurrentDate(startOfWeek(new Date(), { weekStartsOn: 0 }));
    }
  }, [view]);

  const goToPrev = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, -1));
    } else if (view === "month") {
      setCurrentDate((prev) => addMonths(prev, -1));
    } else {
      setCurrentDate((prev) => addWeeks(prev, -1));
    }
  }, [view]);

  const goToNext = React.useCallback(() => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, 1));
    } else if (view === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
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
        setCurrentDate(startOfDay(new Date()));
        return;
      }
      if (newView === "month") {
        setCurrentDate((prev) => startOfMonth(prev));
        return;
      }
      setCurrentDate((prev) => startOfWeek(prev, { weekStartsOn: 0 }));
    },
    [view],
  );

  const handleMoreClick = React.useCallback((date: Date) => {
    setView("week");
    setCurrentDate(startOfWeek(date, { weekStartsOn: 0 }));
    setHighlightedDate(date);
  }, []);

  React.useEffect(() => {
    if (!highlightedDate) return;
    const timer = setTimeout(() => setHighlightedDate(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightedDate]);

  const toggleWeekends = React.useCallback(() => {
    setViewSettings((prev) => ({ ...prev, showWeekends: !prev.showWeekends }));
  }, []);

  const toggleDeclinedEvents = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showDeclinedEvents: !prev.showDeclinedEvents,
    }));
  }, []);

  const toggleWeekNumbers = React.useCallback(() => {
    setViewSettings((prev) => ({
      ...prev,
      showWeekNumbers: !prev.showWeekNumbers,
    }));
  }, []);

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

  // Sync sidebar mini-calendar when in month view
  React.useEffect(() => {
    if (view !== "month") return;
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    setVisibleDays(eachDayOfInterval({ start: monthStart, end: monthEnd }));
  }, [view, currentDate]);

  const headerDate =
    view === "month" ? currentDate : (visibleDays[0] ?? currentDate);
  const { monthName, year, weekNumber } = getCalendarHeaderInfo(headerDate, 0);

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
      // Shift+Cmd+E for toggle weekends
      if (e.key === "e" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleWeekends();
        return;
      }
      // Shift+Cmd+D for toggle declined events
      if (e.key === "d" && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleDeclinedEvents();
        return;
      }
      // Cmd+, for general settings (placeholder)
      if (e.key === "," && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
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

      // 1 for day view
      if (e.key === "1") {
        e.preventDefault();
        switchView("day");
        return;
      }

      // D for day view
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        switchView("day");
        return;
      }

      // 0 for week view
      if (e.key === "0") {
        e.preventDefault();
        switchView("week");
        return;
      }

      // W for week view
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        switchView("week");
        return;
      }

      // 2-9 for number of days
      if (/^[2-9]$/.test(e.key)) {
        e.preventDefault();
        setNumberOfDays(Number(e.key));
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

      // Shift+M for cycle theme
      if (e.key === "M" && e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        cycleTheme();
        return;
      }

      // m for month view (lowercase only, no shift)
      if (e.key === "m") {
        e.preventDefault();
        switchView("month");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    toggleSidebar,
    goToToday,
    goToPrev,
    goToNext,
    switchView,
    toggleWeekends,
    toggleDeclinedEvents,
    cycleTheme,
  ]);

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
        visibleDays={view === "month" ? [] : visibleDays}
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
                {view === "day" && format(currentDate, "EEEE, MMM d")}
                {view === "week" && `Week ${weekNumber}`}
                {view === "month" && ""}
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
            <ViewDropdown
              view={view}
              numberOfDays={numberOfDays}
              viewSettings={viewSettings}
              onSwitchView={switchView}
              onSetNumberOfDays={setNumberOfDays}
              onToggleWeekends={toggleWeekends}
              onToggleDeclinedEvents={toggleDeclinedEvents}
              onToggleWeekNumbers={toggleWeekNumbers}
            />
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
                  {view === "day"
                    ? "Previous day"
                    : view === "month"
                      ? "Previous month"
                      : "Previous week"}
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
                  {view === "day"
                    ? "Next day"
                    : view === "month"
                      ? "Next month"
                      : "Next week"}
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
          {view === "month" ? (
            <MonthView
              currentDate={currentDate}
              events={events}
              viewSettings={viewSettings}
              onEventClick={(e) => setSelectedEventId(e.id)}
              selectedEventId={selectedEvent?.id}
              onBackgroundClick={() => setSelectedEventId(null)}
              onEventChange={handleEventChange}
              onMoreClick={handleMoreClick}
              onDayNumberClick={handleMoreClick}
              isSidebarOpen={rightSidebarOpen}
              onDockToSidebar={() => {
                if (!rightSidebarOpen) toggleSidebar();
              }}
              onClosePopover={() => setSelectedEventId(null)}
            />
          ) : (
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
              highlightedDate={highlightedDate}
            />
          )}
        </div>
      </SidebarInset>
      <SidebarLeft
        selectedEvent={selectedEvent}
        onEventChange={handleEventChange}
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
