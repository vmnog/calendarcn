"use client";

import * as React from "react";
import { CalendarDays, Eye, EyeOff, Plus, Rss, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendar, useCalendarConfig } from "@/components/calendar-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { groupCalendarsByEmail } from "@/lib/event-utils";
import type {
  CalendarGroup,
  CalendarTheme,
  EventColor,
  HourCycle,
} from "@/components/calendar-types";
import type {
  CalendarSettingsDialogProps,
  CalendarSettingsSection,
} from "@/components/week-view-types";

/** Week view day counts the "Number of days" setting offers, as the view menu does */
const NUMBER_OF_DAYS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Theme choices, with Notion Calendar's labels */
const THEME_OPTIONS: { value: CalendarTheme; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light mode" },
  { value: "dark", label: "Dark mode" },
];

/** Clock choices, with Notion Calendar's labels and an example time */
const HOUR_CYCLE_OPTIONS: { value: HourCycle; label: string }[] = [
  { value: 12, label: "12-hour time (1:00 PM)" },
  { value: 24, label: "24-hour time (13:00)" },
];

/** Label of the calendars that have no account `email`, as in the calendar list */
const NO_ACCOUNT_LABEL = "Calendars";

/** Swatch color of each calendar color, as in the calendar list */
const CALENDAR_SWATCH_CLASSES: Record<EventColor, string> = {
  red: "bg-event-red",
  orange: "bg-event-orange",
  yellow: "bg-event-yellow",
  green: "bg-event-green",
  blue: "bg-event-blue",
  purple: "bg-event-purple",
  gray: "bg-event-gray",
};

/** A nav row: the selected one is filled */
const NAV_ITEM_CLASS =
  "flex w-auto shrink-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm whitespace-nowrap text-foreground/80 hover:bg-accent hover:text-accent-foreground sm:w-full";

/** Small heading above a group of nav rows (hidden on phones, where the nav is one row) */
const NAV_HEADING_CLASS =
  "text-muted-foreground hidden px-2 pt-3 pb-1 text-xs first:pt-0 sm:block";

/** A native select, styled like the app's inputs */
const SELECT_CLASS =
  "border-input bg-background text-foreground h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** "Soon" badge of a setting no view reads yet, as in the view menu */
const SOON_BADGE = (
  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
    Soon
  </span>
);

/** Key of a pane: "general", or a calendar account's email ("" without one) */
type PaneKey = "general" | `account:${string}`;

/** Pane key of a calendar group */
function accountPaneKey(group: CalendarGroup): PaneKey {
  return `account:${group.email ?? ""}`;
}

/** The pane a section opens on: General, or the first calendar account */
function sectionPane(
  section: CalendarSettingsSection,
  groups: CalendarGroup[],
): PaneKey {
  if (section === "calendars" && groups.length > 0) {
    return accountPaneKey(groups[0]);
  }
  return "general";
}

/**
 * Notion Calendar's settings, as a dialog: on the left, General and each
 * calendar account, then "Add calendar account"; on the right, the chosen
 * pane. General holds the calendar view settings (weekends, declined
 * events, week numbers, number of days) from the nearest `CalendarProvider`,
 * and the time format and theme when you pass their handlers. An account's
 * pane lists its calendars, with a button to show or hide each when you
 * pass `onHiddenCalendarIdsChange`. Each setting shows only when something
 * can change it, so the dialog fits what your app supports.
 */
export function CalendarSettingsDialog({
  open,
  onOpenChange,
  defaultSection = "general",
  theme,
  onThemeChange,
  onHourCycleChange,
  hiddenCalendarIds = [],
  onHiddenCalendarIdsChange,
  onAddCalendarAccount,
}: CalendarSettingsDialogProps) {
  const { calendars } = useCalendarConfig();
  const groups = React.useMemo(
    () => groupCalendarsByEmail(calendars),
    [calendars],
  );
  const [pane, setPane] = React.useState<PaneKey>(() =>
    sectionPane(defaultSection, groups),
  );

  // Each opening starts on `defaultSection`
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setPane(sectionPane(defaultSection, groups));
  }

  const account = groups.find((group) => accountPaneKey(group) === pane);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-[680px]"
        // The calendar's single-key shortcuts stay out while it's open;
        // Escape and Tab still close and move through the dialog
        onKeyDown={(e) => {
          if (e.key !== "Escape" && e.key !== "Tab") e.stopPropagation();
        }}
      >
        {/* Phones: a title row for the close button, above the nav's row */}
        <DialogTitle className="px-4 pt-4 pb-3 text-base font-semibold sm:sr-only">
          Settings
        </DialogTitle>
        <DialogDescription className="sr-only">
          The calendar&apos;s view, time format and theme, and its calendar
          accounts.
        </DialogDescription>
        {/* min-w-0: the nav's row scrolls instead of widening the dialog */}
        <div className="flex h-[min(480px,85vh)] min-w-0 flex-col sm:flex-row">
          <nav
            aria-label="Settings"
            className="bg-muted/40 flex shrink-0 gap-1 overflow-x-auto border-b p-2 sm:w-56 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-r sm:border-b-0"
          >
            <p className={NAV_HEADING_CLASS}>Account</p>
            <button
              type="button"
              aria-current={pane === "general" ? "page" : undefined}
              className={cn(
                NAV_ITEM_CLASS,
                pane === "general" && "bg-accent text-accent-foreground",
              )}
              onClick={() => setPane("general")}
            >
              <Settings className="size-4 shrink-0" />
              General
            </button>
            <p className={NAV_HEADING_CLASS}>Calendar accounts</p>
            {groups.map((group) => {
              const key = accountPaneKey(group);
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={pane === key ? "page" : undefined}
                  className={cn(
                    NAV_ITEM_CLASS,
                    pane === key && "bg-accent text-accent-foreground",
                  )}
                  onClick={() => setPane(key)}
                >
                  <CalendarDays className="size-4 shrink-0" />
                  <span className="min-w-0 truncate">
                    {group.email ?? NO_ACCOUNT_LABEL}
                  </span>
                </button>
              );
            })}
            {onAddCalendarAccount && (
              <button
                type="button"
                className={NAV_ITEM_CLASS}
                onClick={onAddCalendarAccount}
              >
                <Plus className="size-4 shrink-0" />
                Add calendar account
              </button>
            )}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {account ? (
              <AccountPane
                group={account}
                hiddenCalendarIds={hiddenCalendarIds}
                onHiddenCalendarIdsChange={onHiddenCalendarIdsChange}
              />
            ) : (
              <GeneralPane
                theme={theme}
                onThemeChange={onThemeChange}
                onHourCycleChange={onHourCycleChange}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A titled block of the General pane, ruled off from the next */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 border-b pb-5 last:border-b-0 last:pb-0"
    >
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** A switch with its label, the label first as in Notion Calendar's settings */
function SettingsSwitch({
  label,
  checked,
  onCheckedChange,
  soon = false,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: () => void;
  /** No view reads it yet: disabled, with a "Soon" badge */
  soon?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2 text-sm">
      <Switch
        id={id}
        aria-label={label}
        checked={checked}
        disabled={soon}
        onCheckedChange={() => onCheckedChange()}
      />
      <label htmlFor={id} className={cn(soon && "opacity-50")}>
        {label}
      </label>
      {soon && SOON_BADGE}
    </div>
  );
}

/**
 * General: the calendar view settings from the provider, and the time
 * format and theme when the app passes their handlers
 */
function GeneralPane({
  theme,
  onThemeChange,
  onHourCycleChange,
}: Pick<
  CalendarSettingsDialogProps,
  "theme" | "onThemeChange" | "onHourCycleChange"
>) {
  const {
    viewSettings,
    numberOfDays,
    toggleWeekends,
    toggleDeclinedEvents,
    toggleWeekNumbers,
    setNumberOfDays,
  } = useCalendar();
  const { hourCycle } = useCalendarConfig();
  const numberOfDaysId = React.useId();
  const hourCycleId = React.useId();

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection title="Calendar view">
        <SettingsSwitch
          label="Weekends"
          checked={viewSettings.showWeekends}
          onCheckedChange={toggleWeekends}
        />
        {/* No view filters declined events yet */}
        <SettingsSwitch
          label="Declined events"
          checked={viewSettings.showDeclinedEvents}
          onCheckedChange={toggleDeclinedEvents}
          soon
        />
        <SettingsSwitch
          label="Week numbers"
          checked={viewSettings.showWeekNumbers}
          onCheckedChange={toggleWeekNumbers}
        />
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor={numberOfDaysId}>Number of days in week view:</label>
          <select
            id={numberOfDaysId}
            value={numberOfDays}
            onChange={(e) => setNumberOfDays(Number(e.target.value))}
            className={cn(SELECT_CLASS, "w-40")}
          >
            {NUMBER_OF_DAYS_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </select>
        </div>
        {/* "Start week on:" goes here once the provider's week start can change */}
      </SettingsSection>
      {onHourCycleChange && (
        <SettingsSection title="Time format">
          <select
            id={hourCycleId}
            aria-label="Time format"
            value={hourCycle}
            onChange={(e) =>
              onHourCycleChange(Number(e.target.value) as HourCycle)
            }
            className={cn(SELECT_CLASS, "w-56")}
          >
            {HOUR_CYCLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </SettingsSection>
      )}
      {/* Time zones go here once the calendar can show more than one */}
      {onThemeChange && (
        <SettingsSection title="Theme">
          <div
            role="radiogroup"
            aria-label="Theme"
            className="flex flex-col gap-2"
          >
            {THEME_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="calendar-settings-theme"
                  value={option.value}
                  checked={(theme ?? "system") === option.value}
                  onChange={() => onThemeChange(option.value)}
                  className="accent-primary size-4"
                />
                {option.label}
              </label>
            ))}
          </div>
        </SettingsSection>
      )}
    </div>
  );
}

/** A calendar account: its calendars, each with its color and a show or hide button */
function AccountPane({
  group,
  hiddenCalendarIds,
  onHiddenCalendarIdsChange,
}: {
  group: CalendarGroup;
  hiddenCalendarIds: string[];
  onHiddenCalendarIdsChange?: (hiddenCalendarIds: string[]) => void;
}) {
  const toggleVisibility = (calendarId: string) => {
    onHiddenCalendarIdsChange?.(
      hiddenCalendarIds.includes(calendarId)
        ? hiddenCalendarIds.filter((id) => id !== calendarId)
        : [...hiddenCalendarIds, calendarId],
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="bg-muted flex size-10 items-center justify-center rounded-md">
          <CalendarDays className="size-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-foreground truncate text-base font-semibold">
            {group.email ?? NO_ACCOUNT_LABEL}
          </h3>
          <p className="text-muted-foreground text-sm">
            {group.calendars.length === 1
              ? "1 calendar"
              : `${group.calendars.length} calendars`}
          </p>
        </div>
      </div>
      <section aria-label="Calendars" className="rounded-md border">
        <h4 className="text-muted-foreground border-b px-3 py-2 text-sm">
          Calendars
        </h4>
        <ul>
          {group.calendars.map((calendar) => {
            const isVisible = !hiddenCalendarIds.includes(calendar.id);
            return (
              <li
                key={calendar.id}
                className="flex items-center gap-2 px-3 py-2 text-sm"
              >
                <span
                  className={cn(
                    "flex size-3 shrink-0 items-center justify-center rounded-xs",
                    CALENDAR_SWATCH_CLASSES[calendar.color],
                    !isVisible && "opacity-40",
                  )}
                >
                  {calendar.isSubscribed && (
                    <Rss className="size-2 text-white" />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    !isVisible && "opacity-50",
                  )}
                >
                  {calendar.name}
                </span>
                {onHiddenCalendarIdsChange && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={`${isVisible ? "Hide" : "Show"} ${calendar.name}`}
                    onClick={() => toggleVisibility(calendar.id)}
                  >
                    {isVisible ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
