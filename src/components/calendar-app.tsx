"use client";

import * as React from "react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import { useCalendarShortcuts } from "@/hooks/use-calendar-shortcuts";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useMediaQuery } from "@/hooks/use-media-query";
import { AgendaView } from "@/components/agenda-view";
import { CalendarHeader } from "@/components/calendar-header";
import {
  CalendarProvider,
  useCalendar,
  useCalendarConfig,
} from "@/components/calendar-provider";
import { CalendarSettingsDialog } from "@/components/calendar-settings";
import { CalendarSidebar } from "@/components/calendar-sidebar";
import { CalendarToaster } from "@/components/calendar-toaster";
import { CommandMenu } from "@/components/command-menu";
import {
  CONTEXT_PANEL_WIDTH,
  DetailsSidebar,
} from "@/components/details-sidebar";
import { MonthView } from "@/components/month-view";
import { PeoplePicker } from "@/components/people-picker";
import { TimeGrid } from "@/components/time-grid";
import { YearView } from "@/components/year-view";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  filterShownEvents,
  getPeriodStart,
  mergeShownEvents,
} from "@/lib/event-utils";
import { parseIcs, toIcs, toIcsCalendar } from "@/lib/ics";
import {
  KEYBOARD_SHORTCUT_GROUPS,
  SHORTCUTS,
  filterKeyboardShortcutGroups,
} from "@/lib/keyboard-shortcuts";
import { toDisplayEvent } from "@/lib/time-zones";
import type {
  CalendarInfo,
  CalendarProviderProps,
  CalendarTheme,
  HourCycle,
  PeoplePickerMode,
} from "@/components/calendar-types";
import type {
  CalendarAppProps,
  CalendarSettingsSection,
  CommandMenuPage,
  DetailedCalendarEvent,
  DetailsSidebarActions,
  TimeZoneCommand,
} from "@/components/week-view-types";

/** Hour the time grid opens on unless `scrollToHour` says otherwise */
const DEFAULT_SCROLL_HOUR = 8;

/** File types the command menu's .ics import offers */
const ICS_FILE_TYPES = ".ics,text/calendar";

/** Name of the file the command menu's .ics export downloads unless `exportFileName` says otherwise */
const DEFAULT_EXPORT_FILE_NAME = "calendar.ics";

/**
 * Viewports at least this wide keep both sidebars inline (Tailwind `xl`).
 * Narrower ones show the context panel as an overlay: inline, it would leave
 * the calendar under ~500px at 1024px (240px left + 308px right).
 */
const WIDE_LAYOUT_QUERY = "(min-width: 1280px)";

/** No events, for an app given neither `events` nor `defaultEvents` */
const NO_EVENTS: DetailedCalendarEvent[] = [];

/** No hidden calendars: every calendar shows until its eye is clicked */
const NO_HIDDEN_CALENDARS: string[] = [];

/** No calendars: an app given no `calendars` and before any is added */
const NO_CALENDARS: CalendarInfo[] = [];

/** CalendarAppProps that configure the app's chrome rather than the provider */
type CalendarAppShellOptions = Pick<
  CalendarAppProps,
  | "scrollToHour"
  | "headerActions"
  | "sidebarFooterActions"
  | "exportFileName"
  | "exportCalendarName"
  | "onOpenSettings"
  | "settingsDialog"
  | "onSupport"
  | "onAbout"
  | "showComingSoon"
  | "shortcuts"
>;

interface CalendarAppStateProps extends Omit<CalendarAppProps, "className"> {
  /** Whether the context panel sits inline (true) or opens as an overlay */
  isWideLayout: boolean;
}

interface CalendarAppShellProps extends CalendarAppShellOptions {
  /** Whether the context panel sits inline (true) or opens as an overlay */
  isWideLayout: boolean;
  /** Adds events read from an .ics file, replacing those with the same id */
  onImportEvents: (events: DetailedCalendarEvent[]) => void;
  /**
   * Adds events read from an .ics file as a calendar named after the file,
   * and returns them with its id
   */
  onImportCalendar: (
    fileName: string,
    events: DetailedCalendarEvent[],
  ) => DetailedCalendarEvent[];
  /** The app's "Add calendar account", with its helpers bound */
  onAddCalendarAccount?: CalendarAppProps["onAddCalendarAccount"];
  /** Sets the clock the calendar shows (the settings' Time format) */
  onHourCycleChange: (hourCycle: HourCycle) => void;
  /** Every event the app holds, hidden calendars included: what "Export .ics file" writes */
  allEvents: DetailedCalendarEvent[];
  /** Ids of the calendars hidden from the sidebar's list */
  hiddenCalendarIds: string[];
  /** Called with the new hidden ids when a calendar is shown or hidden */
  onHiddenCalendarIdsChange: (hiddenCalendarIds: string[]) => void;
}

/**
 * The live demo as one component: the calendar sidebar on the left, the
 * header and the day, week, month, year or agenda view in the middle, the details
 * sidebar on the right, the ⌘K command menu, the toasts after a delete,
 * cut or copy, theme cycling, .ics import and export, and the keyboard
 * shortcuts. The settings dialog (`settingsDialog`) and the account and app
 * commands (`onAddCalendarAccount`, `onSupport`, `onAbout`) show when you
 * turn them on. Takes every `CalendarProvider` prop,
 * so events can be controlled or left to the app, and the calendars,
 * contacts, rooms and conferencing come from your data.
 *
 * It fills the viewport. On wide screens (1280px and up) both sidebars sit
 * inline; narrower, the details sidebar opens over the calendar, and on
 * phones the calendar sidebar does too. The eye beside a calendar in the
 * sidebar hides its events from every view.
 */
export function CalendarApp({ className, ...props }: CalendarAppProps) {
  const isWideLayout = useMediaQuery(WIDE_LAYOUT_QUERY);

  // The context panel starts open where it sits inline (wide screens) and
  // closed where it would cover the calendar. Crossing the breakpoint resets it.
  const [contextPanelOpen, setContextPanelOpen] = React.useState(isWideLayout);
  const [prevIsWideLayout, setPrevIsWideLayout] = React.useState(isWideLayout);
  if (isWideLayout !== prevIsWideLayout) {
    setPrevIsWideLayout(isWideLayout);
    setContextPanelOpen(isWideLayout);
  }

  return (
    <SidebarProvider
      className={cn("h-screen", className)}
      style={{ "--sidebar-width": CONTEXT_PANEL_WIDTH } as React.CSSProperties}
      open={contextPanelOpen}
      onOpenChange={setContextPanelOpen}
    >
      <CalendarAppState {...props} isWideLayout={isWideLayout} />
    </SidebarProvider>
  );
}

/**
 * The provider, with the app owning the events (so the command menu can
 * import an .ics file into them, controlled or not) and opening the phone
 * details sheet on select. Everything below reads the calendar state from
 * `useCalendar()`.
 */
function CalendarAppState({
  isWideLayout,
  events: eventsProp,
  defaultEvents,
  onEventsChange,
  onEventSelect,
  onEventsImport,
  scrollToHour,
  headerActions,
  sidebarFooterActions,
  exportFileName,
  exportCalendarName,
  onOpenSettings,
  settingsDialog,
  onAddCalendarAccount,
  onSupport,
  onAbout,
  showComingSoon,
  shortcuts,
  children,
  ...providerProps
}: CalendarAppStateProps) {
  const { isMobile, setOpenMobile: setContextPanelOpenMobile } = useSidebar();
  const [events, setEvents] = useControllableState({
    prop: eventsProp,
    defaultProp: defaultEvents ?? NO_EVENTS,
    onChange: onEventsChange,
  });

  /** Calendars hidden from the sidebar's list. Their events leave every view */
  const [hiddenCalendarIds, setHiddenCalendarIds] =
    React.useState(NO_HIDDEN_CALENDARS);
  /** Calendars added from .ics files, after the app's `calendars` */
  const [addedCalendars, setAddedCalendars] = React.useState(NO_CALENDARS);
  /** Clock picked in the settings; until then, the app's `hourCycle` */
  const [pickedHourCycle, setPickedHourCycle] =
    React.useState<HourCycle | null>(null);

  const calendarsProp = providerProps.calendars ?? NO_CALENDARS;
  const calendars = React.useMemo(
    () => [
      ...calendarsProp,
      ...addedCalendars.filter(
        (added) => !calendarsProp.some((calendar) => calendar.id === added.id),
      ),
    ],
    [calendarsProp, addedCalendars],
  );

  // The provider, and with it every view, the details and the search, gets
  // the shown calendars' events only
  const shownEvents = React.useMemo(
    () => filterShownEvents(events, hiddenCalendarIds),
    [events, hiddenCalendarIds],
  );

  // The provider's changes cover the shown events, so they are merged back
  // into the full list. An event that lands on a hidden calendar (created
  // there, or moved to it) shows that calendar again instead of vanishing.
  const handleShownEventsChange = React.useCallback(
    (shown: DetailedCalendarEvent[]) => {
      const stillHidden = hiddenCalendarIds.filter(
        (id) => !shown.some((event) => event.calendarId === id),
      );
      if (stillHidden.length !== hiddenCalendarIds.length) {
        setHiddenCalendarIds(stillHidden);
      }
      setEvents((current) =>
        mergeShownEvents(current, shown, hiddenCalendarIds),
      );
    },
    [hiddenCalendarIds, setEvents],
  );

  // Phones show event details in the context panel sheet: the 320px popover
  // doesn't fit beside an event on a ~390px screen
  const handleEventSelect = React.useCallback(
    (eventId: string) => {
      onEventSelect?.(eventId);
      if (isMobile) setContextPanelOpenMobile(true);
    },
    [onEventSelect, isMobile, setContextPanelOpenMobile],
  );

  // Importing the same file again updates its events instead of adding copies
  const importEvents = React.useCallback(
    (imported: DetailedCalendarEvent[]) => {
      const importedIds = new Set(imported.map((event) => event.id));
      setEvents((current) => [
        ...current.filter((event) => !importedIds.has(event.id)),
        ...imported,
      ]);
      onEventsImport?.(imported);
    },
    [setEvents, onEventsImport],
  );

  // An .ics file as a calendar of its own: added once, its events with it
  const importCalendar = React.useCallback(
    (fileName: string, imported: DetailedCalendarEvent[]) => {
      const { calendar, events: calendarEvents } = toIcsCalendar(
        fileName,
        imported,
        calendars,
      );
      setAddedCalendars((current) =>
        current.some((added) => added.id === calendar.id)
          ? current
          : [...current, calendar],
      );
      setHiddenCalendarIds((current) =>
        current.filter((id) => id !== calendar.id),
      );
      importEvents(calendarEvents);
      return calendarEvents;
    },
    [calendars, importEvents],
  );

  // The provider reads only its own props. Its event type is erased here,
  // as in the Calendar block, because TypeScript can't check JSX props
  // against its generic conditional `createEvent` type.
  const calendarProviderProps: CalendarProviderProps = {
    ...(providerProps as CalendarProviderProps),
    calendars,
    hourCycle: pickedHourCycle ?? providerProps.hourCycle,
    events: shownEvents,
    onEventsChange:
      handleShownEventsChange as CalendarProviderProps["onEventsChange"],
    onEventSelect: handleEventSelect,
    children: (
      <>
        <CalendarAppShell
          isWideLayout={isWideLayout}
          onImportEvents={importEvents}
          onImportCalendar={importCalendar}
          onHourCycleChange={setPickedHourCycle}
          allEvents={events}
          hiddenCalendarIds={hiddenCalendarIds}
          onHiddenCalendarIdsChange={setHiddenCalendarIds}
          scrollToHour={scrollToHour}
          headerActions={headerActions}
          sidebarFooterActions={sidebarFooterActions}
          exportFileName={exportFileName}
          exportCalendarName={exportCalendarName}
          onOpenSettings={onOpenSettings}
          settingsDialog={settingsDialog}
          onAddCalendarAccount={onAddCalendarAccount}
          onSupport={onSupport}
          onAbout={onAbout}
          showComingSoon={showComingSoon}
          shortcuts={shortcuts}
        />
        {children}
      </>
    ),
  };

  return <CalendarProvider {...calendarProviderProps} />;
}

/**
 * The chrome around the calendar: sidebars, header, command menu, theme
 * cycling, .ics import and export, and the app shortcuts.
 */
function CalendarAppShell({
  isWideLayout,
  onImportEvents,
  onImportCalendar,
  onAddCalendarAccount,
  onHourCycleChange,
  allEvents,
  hiddenCalendarIds,
  onHiddenCalendarIdsChange,
  scrollToHour = DEFAULT_SCROLL_HOUR,
  headerActions,
  sidebarFooterActions,
  exportFileName = DEFAULT_EXPORT_FILE_NAME,
  exportCalendarName,
  onOpenSettings,
  settingsDialog = false,
  onSupport,
  onAbout,
  showComingSoon = false,
  shortcuts = true,
}: CalendarAppShellProps) {
  const { theme, setTheme } = useTheme();
  const {
    toggleSidebar,
    open: contextPanelOpen,
    openMobile: contextPanelOpenMobile,
    isMobile,
  } = useSidebar();
  const { view, weekStartsOn, numberOfDays, goToDate } =
    useCalendar<DetailedCalendarEvent>();
  const { timeZone } = useCalendarConfig();
  // shadcn tracks the panel's phone state separately; read whichever is active
  const rightSidebarOpen = isMobile ? contextPanelOpenMobile : contextPanelOpen;
  /** Inline calendar sidebar state (tablet and desktop) */
  const [leftSidebarOpen, setLeftSidebarOpen] = React.useState(true);
  /** Calendar sidebar overlay state (phones); starts closed */
  const [leftOverlayOpen, setLeftOverlayOpen] = React.useState(false);
  // Close the overlay when leaving the phone layout, so it doesn't pop back
  // open the next time the viewport narrows
  const [prevIsMobile, setPrevIsMobile] = React.useState(isMobile);
  if (isMobile !== prevIsMobile) {
    setPrevIsMobile(isMobile);
    setLeftOverlayOpen(false);
  }
  const leftSidebarVisible = isMobile ? leftOverlayOpen : leftSidebarOpen;
  const [commandMenuOpen, setCommandMenuOpen] = React.useState(false);
  /** Page the command menu opens on: its commands, or Go to date's field (.) */
  const [commandMenuPage, setCommandMenuPage] =
    React.useState<CommandMenuPage>("commands");
  /** The time zone list the command menu opens on (Z), or none (Cmd+K) */
  const [commandMenuZoneCommand, setCommandMenuZoneCommand] = React.useState<
    TimeZoneCommand | undefined
  >(undefined);
  /** Whether the people picker F and P open is open */
  const [peoplePickerOpen, setPeoplePickerOpen] = React.useState(false);
  /** What picking someone does; kept while the picker closes, so its text stays */
  const [peoplePickerMode, setPeoplePickerMode] =
    React.useState<PeoplePickerMode>("meet-with");
  /** Hidden file picker behind the command menu's "Import .ics file" */
  const icsInputRef = React.useRef<HTMLInputElement>(null);
  /** Hidden file picker behind `importIcsCalendar()` (Add calendar account) */
  const icsCalendarInputRef = React.useRef<HTMLInputElement>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  /** Pane the settings dialog opens on */
  const [settingsSection, setSettingsSection] =
    React.useState<CalendarSettingsSection>("general");
  /** The details sidebar's event search and full shortcut list */
  const detailsActionsRef = React.useRef<DetailsSidebarActions>(null);

  // Phones show event details in the context panel sheet: the 320px popover
  // doesn't fit beside an event on a ~390px screen
  const showDetailsInPanel = isMobile || rightSidebarOpen;

  const toggleCommandMenu = React.useCallback(() => {
    setCommandMenuPage("commands");
    setCommandMenuZoneCommand(undefined);
    setCommandMenuOpen((prev) => !prev);
  }, []);

  /** The . key: the command menu, on Go to date's field */
  const openGoToDate = React.useCallback(() => {
    setCommandMenuPage("go-to-date");
    setCommandMenuZoneCommand(undefined);
    setCommandMenuOpen(true);
  }, []);

  /** Z: the command menu, on "Travel to time zone..."'s list */
  const openTravelPicker = React.useCallback(() => {
    setCommandMenuPage("commands");
    setCommandMenuZoneCommand("travel");
    setCommandMenuOpen(true);
  }, []);

  const openMeetWith = React.useCallback(() => {
    setPeoplePickerMode("meet-with");
    setPeoplePickerOpen(true);
  }, []);

  const openTeammatePicker = React.useCallback(() => {
    setPeoplePickerMode("teammate");
    setPeoplePickerOpen(true);
  }, []);

  const searchEvents = React.useCallback((query: string) => {
    detailsActionsRef.current?.searchEvents(query);
  }, []);

  /** The ? key and "Show keyboard shortcuts": the full list, in the context panel */
  const showAllShortcuts = React.useCallback(() => {
    detailsActionsRef.current?.showAllShortcuts();
  }, []);

  const toggleLeftSidebar = React.useCallback(() => {
    if (isMobile) {
      setLeftOverlayOpen((prev) => !prev);
      return;
    }
    setLeftSidebarOpen((prev) => !prev);
  }, [isMobile]);

  /** Shows the period of the earliest of the imported events */
  const showImported = React.useCallback(
    (imported: DetailedCalendarEvent[]) => {
      const earliest = imported.reduce((first, event) =>
        event.start < first.start ? event : first,
      );
      // The period of the day it falls on in the calendar's zone
      goToDate(
        getPeriodStart(
          toDisplayEvent(earliest, timeZone).start,
          view,
          weekStartsOn,
          numberOfDays,
        ),
      );
    },
    [goToDate, view, weekStartsOn, numberOfDays, timeZone],
  );

  /** Imports the picked .ics file and shows the period of its first event */
  const handleIcsFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Clear the input so picking the same file again imports it again
      e.target.value = "";
      if (!file) return;
      const imported = parseIcs(await file.text());
      if (imported.length === 0) return;
      onImportEvents(imported);
      showImported(imported);
    },
    [onImportEvents, showImported],
  );

  /** Adds the picked .ics file as a calendar named after it, and shows its first event */
  const handleIcsCalendarFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const imported = parseIcs(await file.text());
      if (imported.length === 0) return;
      showImported(onImportCalendar(file.name, imported));
    },
    [onImportCalendar, showImported],
  );

  /** "Add calendar account" in the sidebar, the command menu and the settings */
  const addCalendarAccount = React.useMemo(() => {
    if (!onAddCalendarAccount) return undefined;
    return () =>
      onAddCalendarAccount({
        importIcsCalendar: () => icsCalendarInputRef.current?.click(),
      });
  }, [onAddCalendarAccount]);

  /** Cmd+, and "Go to settings": the built-in dialog, else the app's own */
  const openSettings = React.useMemo(() => {
    if (!settingsDialog) return onOpenSettings;
    return () => {
      setSettingsSection("general");
      setSettingsOpen(true);
    };
  }, [settingsDialog, onOpenSettings]);

  /** "Manage calendar accounts": the built-in dialog, on the calendars */
  const manageCalendarAccounts = React.useMemo(() => {
    if (!settingsDialog) return undefined;
    return () => {
      setSettingsSection("calendars");
      setSettingsOpen(true);
    };
  }, [settingsDialog]);

  // The full list names only the keys this app handles: Cmd+, needs a
  // settings action, the built-in dialog or the app's own
  const shortcutGroups = React.useMemo(
    () =>
      openSettings
        ? KEYBOARD_SHORTCUT_GROUPS
        : filterKeyboardShortcutGroups(
            KEYBOARD_SHORTCUT_GROUPS,
            (shortcut) => shortcut !== SHORTCUTS.openSettings,
          ),
    [openSettings],
  );

  const exportIcs = React.useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([toIcs(allEvents, { calendarName: exportCalendarName })], {
        type: "text/calendar;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [allEvents, exportCalendarName, exportFileName]);

  /** Popover expand button: move the details into the context panel */
  const expandEventPopover = React.useCallback(() => {
    if (!rightSidebarOpen) toggleSidebar();
  }, [rightSidebarOpen, toggleSidebar]);

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

  // Calendar shortcuts: T, J/K, arrows, D/1, W/0, 2-9, M, A, C, Escape,
  // Shift+Cmd+E for weekends, and the event keys: Delete/Backspace, Cmd+X,
  // Cmd+C, Cmd+V, Cmd+D, Cmd+Z and Shift+Cmd+Z. Then the app's own, checked
  // first: Cmd+K, Cmd+/, /, Shift+M, Cmd+, . ? Z, F and P
  useCalendarShortcuts({
    enabled: shortcuts,
    onToggleCommandMenu: toggleCommandMenu,
    onToggleSidebar: toggleLeftSidebar,
    onToggleContextPanel: toggleSidebar,
    onCycleTheme: cycleTheme,
    onOpenSettings: openSettings,
    onGoToDate: openGoToDate,
    onShowShortcuts: showAllShortcuts,
    onTravelToTimeZone: openTravelPicker,
    onMeetWith: openMeetWith,
    onShowTeammateCalendar: openTeammatePicker,
  });

  return (
    <>
      <CommandMenu
        open={commandMenuOpen}
        onOpenChange={setCommandMenuOpen}
        onToggleSidebar={toggleLeftSidebar}
        onToggleContextPanel={toggleSidebar}
        onCycleTheme={cycleTheme}
        onImportIcs={() => icsInputRef.current?.click()}
        onExportIcs={exportIcs}
        onOpenSettings={openSettings}
        onSupport={onSupport}
        onAddCalendarAccount={addCalendarAccount}
        onManageCalendarAccounts={manageCalendarAccounts}
        onAbout={onAbout}
        onMeetWith={openMeetWith}
        onShowTeammateCalendar={openTeammatePicker}
        onSearchEvents={searchEvents}
        onShowShortcuts={showAllShortcuts}
        defaultPage={commandMenuPage}
        showComingSoon={showComingSoon}
        timeZoneCommand={commandMenuZoneCommand}
      />
      <PeoplePicker
        open={peoplePickerOpen}
        onOpenChange={setPeoplePickerOpen}
        mode={peoplePickerMode}
      />
      <input
        ref={icsInputRef}
        type="file"
        accept={ICS_FILE_TYPES}
        aria-label="Import .ics file"
        className="hidden"
        onChange={handleIcsFileChange}
      />
      {onAddCalendarAccount && (
        <input
          ref={icsCalendarInputRef}
          type="file"
          accept={ICS_FILE_TYPES}
          aria-label="Add an .ics file as a calendar"
          className="hidden"
          onChange={handleIcsCalendarFileChange}
        />
      )}
      {settingsDialog && (
        <CalendarSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          defaultSection={settingsSection}
          theme={theme as CalendarTheme | undefined}
          onThemeChange={setTheme}
          onHourCycleChange={onHourCycleChange}
          hiddenCalendarIds={hiddenCalendarIds}
          onHiddenCalendarIdsChange={onHiddenCalendarIdsChange}
          onAddCalendarAccount={addCalendarAccount}
        />
      )}
      <CalendarSidebar
        open={leftSidebarVisible}
        onOpenChange={setLeftOverlayOpen}
        overlay={isMobile}
        footerActions={sidebarFooterActions}
        hiddenCalendarIds={hiddenCalendarIds}
        onHiddenCalendarIdsChange={onHiddenCalendarIdsChange}
        onAddCalendarAccount={addCalendarAccount}
      />
      <SidebarInset className="flex flex-col overflow-hidden">
        <CalendarHeader
          sidebarOpen={leftSidebarVisible}
          onToggleSidebar={toggleLeftSidebar}
          contextPanelOpen={rightSidebarOpen}
          onToggleContextPanel={toggleSidebar}
        >
          {headerActions}
        </CalendarHeader>
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {view === "month" && (
            <MonthView
              showEventPopover={!showDetailsInPanel}
              onEventPopoverExpand={expandEventPopover}
            />
          )}
          {view === "agenda" && (
            <AgendaView
              showEventPopover={!showDetailsInPanel}
              onEventPopoverExpand={expandEventPopover}
            />
          )}
          {view === "year" && <YearView />}
          {/* One grid for day and week: switching re-lays it out instead of
              remounting, so the vertical scroll position is kept */}
          {(view === "day" || view === "week") && (
            <TimeGrid
              view={view}
              scrollToHour={scrollToHour}
              showEventPopover={!showDetailsInPanel}
              onEventPopoverExpand={expandEventPopover}
            />
          )}
          {/* Notion Calendar's toasts, at the bottom right over the view */}
          <CalendarToaster />
        </div>
      </SidebarInset>
      <DetailsSidebar
        overlay={!isWideLayout}
        actionsRef={detailsActionsRef}
        shortcutGroups={shortcutGroups}
      />
    </>
  );
}
