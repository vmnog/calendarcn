"use client";

import * as React from "react";
import { ChevronRight, Eye, EyeOff, Rss } from "lucide-react";

import { cn } from "@/lib/utils";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useCalendarConfig } from "@/components/calendar-provider";
import type { CalendarInfo, EventColor } from "@/components/calendar-types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { groupCalendarsByEmail } from "@/lib/event-utils";

/** Swatch color of each calendar color */
const CALENDAR_SWATCH_CLASSES: Record<EventColor, string> = {
  red: "bg-event-red",
  orange: "bg-event-orange",
  yellow: "bg-event-yellow",
  green: "bg-event-green",
  blue: "bg-event-blue",
  purple: "bg-event-purple",
  gray: "bg-event-gray",
};

/** Hidden calendars when the list owns them: none */
const NO_HIDDEN_CALENDARS: string[] = [];

/** Label of the group of calendars that have no account `email` */
const NO_ACCOUNT_LABEL = "Calendars";

interface CalendarListProps {
  /**
   * Calendars to list, grouped under their account `email`. Defaults to the
   * `calendars` of the nearest `CalendarProvider`.
   */
  calendars?: CalendarInfo[];
  /** Ids of the hidden calendars (controlled) */
  hiddenCalendarIds?: string[];
  /** Ids of the calendars hidden at first (uncontrolled) */
  defaultHiddenCalendarIds?: string[];
  /** Called with the new hidden ids when a calendar is shown or hidden */
  onHiddenCalendarIdsChange?: (hiddenCalendarIds: string[]) => void;
}

/**
 * The sidebar's calendars, one collapsible group per account, with an eye
 * button to show or hide each. Hiding only dims the row: filter your events
 * with `onHiddenCalendarIdsChange` to take them off the calendar.
 */
export function CalendarList({
  calendars: calendarsProp,
  hiddenCalendarIds: hiddenCalendarIdsProp,
  defaultHiddenCalendarIds = NO_HIDDEN_CALENDARS,
  onHiddenCalendarIdsChange,
}: CalendarListProps) {
  const config = useCalendarConfig();
  const calendars = calendarsProp ?? config.calendars;
  const [hiddenCalendarIds, setHiddenCalendarIds] = useControllableState({
    prop: hiddenCalendarIdsProp,
    defaultProp: defaultHiddenCalendarIds,
    onChange: onHiddenCalendarIdsChange,
  });

  const groups = React.useMemo(
    () => groupCalendarsByEmail(calendars),
    [calendars],
  );

  const toggleVisibility = (calendarId: string) => {
    setHiddenCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId],
    );
  };

  return (
    <>
      {groups.map((group, index) => (
        <React.Fragment key={group.email ?? NO_ACCOUNT_LABEL}>
          <SidebarGroup className="py-0">
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroupLabel
                asChild
                className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full rounded-sm text-xs"
              >
                <CollapsibleTrigger>
                  <span className="truncate">
                    {group.email ?? NO_ACCOUNT_LABEL}
                  </span>
                  {/* Open state: Radix sets data-state on the root, Base UI data-panel-open on the trigger */}
                  <ChevronRight className="ml-auto shrink-0 opacity-0 transition-transform group-hover/label:opacity-100 group-data-[state=open]/collapsible:rotate-90 group-data-panel-open/label:rotate-90" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0">
                    {group.calendars.map((calendar) => {
                      const isVisible = !hiddenCalendarIds.includes(
                        calendar.id,
                      );
                      return (
                        <SidebarMenuItem
                          key={calendar.id}
                          className="group/calendar-item"
                        >
                          <SidebarMenuButton className="rounded-sm pr-1">
                            <div
                              className={cn(
                                "size-3 shrink-0 flex items-center justify-center rounded-xs",
                                CALENDAR_SWATCH_CLASSES[calendar.color],
                                !isVisible && "opacity-40",
                              )}
                            >
                              {calendar.isSubscribed && (
                                <Rss className="size-2 text-white" />
                              )}
                            </div>
                            <span
                              className={cn(
                                "flex-1 truncate text-xs text-sidebar-foreground",
                                !isVisible && "opacity-50",
                              )}
                            >
                              {calendar.name}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`${isVisible ? "Hide" : "Show"} ${calendar.name}`}
                              className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm opacity-0 hover:bg-sidebar-accent group-hover/calendar-item:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleVisibility(calendar.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleVisibility(calendar.id);
                                }
                              }}
                            >
                              {isVisible ? (
                                <Eye className="size-3.5 text-calendar-sidebar-muted-foreground" />
                              ) : (
                                <EyeOff className="size-3.5 text-calendar-sidebar-muted-foreground" />
                              )}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
          {index < groups.length - 1 && <SidebarSeparator className="mx-0" />}
        </React.Fragment>
      ))}
    </>
  );
}
