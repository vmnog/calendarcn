"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Globe, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCalendar } from "@/components/calendar-provider";
import {
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MENU_SECONDARY_CLASS,
} from "@/components/event-detail-parts";
import { TimeZoneList } from "@/components/time-zone-list";
import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  addTimeZone,
  makeTimeZonePrimary,
  makeTimeZoneSecondary,
  removeTimeZone,
  replaceTimeZone,
} from "@/lib/time-zones";
import { getTimeZoneCity } from "@/lib/timezone-label";
import type { TimeZoneAxisLabelProps } from "./week-view-types";

/** The menu surface the labels' menus share with the details' menus */
const MENU_CLASS = cn(
  "rounded-lg p-0 shadow-lg text-calendar-menu-foreground/77",
  EVENT_DETAIL_MENU_CLASS,
);

/** A menu item: 32px tall, its highlight inset, as Notion Calendar's */
const MENU_ITEM_CLASS =
  "h-8 gap-2 rounded-md px-2 py-0 text-sm text-calendar-menu-foreground/77 data-[selected=true]:bg-calendar-menu-accent data-[selected=true]:text-calendar-menu-accent-foreground/93 [&_svg]:text-calendar-menu-muted-foreground";

/** "Remove time zone from list" and "Travel back home", in the danger color */
const MENU_ITEM_DESTRUCTIVE_CLASS =
  "text-calendar-danger data-[selected=true]:text-calendar-danger [&_svg]:!text-calendar-danger";

/** The search field at the top of a zone list */
const SEARCH_INPUT_CLASS =
  "h-9 w-full border-b border-calendar-menu-border bg-transparent px-3 text-sm text-calendar-menu-foreground/80 outline-none placeholder:text-calendar-menu-muted-foreground";

/** One action of a label's menu */
interface LabelMenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Muted text at the item's right: the zone's city */
  detail?: string;
  /** Key that does the same, shown at the right */
  shortcut?: string;
  /** Drawn in red, after a separator */
  destructive?: boolean;
}

/**
 * Keeps clicks in a label and its menus from reaching the time grid, whose
 * own click clears the selected event
 */
function stopClick(e: React.MouseEvent) {
  e.stopPropagation();
}

/**
 * The zone list of a label's menu, with its search field: picks a zone for
 * "Change time zone" or the "+" button
 */
function TimeZoneMenuList({
  onSelect,
}: {
  onSelect: (timeZone: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  return (
    <Command
      shouldFilter={false}
      label="Time zones"
      className="bg-transparent text-inherit"
    >
      {/* A plain input: the list filters itself, and arrow keys still
          reach the list's own handler */}
      <input
        autoFocus
        aria-label="Time zone"
        placeholder="Time zone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={SEARCH_INPUT_CLASS}
      />
      <div className="max-h-[300px] overflow-y-auto" role="presentation">
        <TimeZoneList query={query} onSelect={onSelect} variant="menu" />
      </div>
    </Command>
  );
}

/**
 * The "+" that adds a time zone, as the left-most column, from a searchable
 * list, as Notion Calendar's. The time grid puts it in the "All-day"
 * corner, under the labels: a long label ("GMT+5:30") fills its column
 */
export function AddTimeZoneButton() {
  const { changeTimeZones } = useCalendar();
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Add time zone"
          title="Add time zone"
          className={cn(
            "absolute top-[7px] left-1.5 z-10 flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground",
            open && "bg-accent text-foreground",
          )}
        >
          <Plus className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[360px] max-w-[calc(100vw-16px)]", MENU_CLASS)}
        onClick={stopClick}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.stopPropagation();
          setOpen(false);
        }}
      >
        {open && (
          <TimeZoneMenuList
            onSelect={(zone) => {
              setOpen(false);
              changeTimeZones((zones) => addTimeZone(zones, zone));
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The label above one time zone column of the time grid ("EST", "GMT−3").
 * A click or right-click opens Notion Calendar's menu for it: "Change time
 * zone", "Make time zone primary" (or secondary) and "Remove time zone
 * from list". The zone the calendar travelled to is filled in the primary
 * color, with "Add as primary time zone", "Add as secondary time zone" and
 * "Travel back home" instead, and an x that travels back home.
 */
export function TimeZoneAxisLabel({
  column,
  hasOtherZones,
}: TimeZoneAxisLabelProps) {
  const { changeTimeZones, travelToTimeZone } = useCalendar();
  const [open, setOpen] = React.useState(false);
  /** "Change time zone" swaps the menu for a zone list */
  const [isChanging, setIsChanging] = React.useState(false);
  const { timeZone, label, kind } = column;
  const city = getTimeZoneCity(timeZone) || timeZone;
  const isTravel = kind === "travel";
  const isPrimary = kind === "primary" || kind === "home";

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setIsChanging(false);
  };

  /** Closes the menu, then runs the item's action */
  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  const items: LabelMenuItem[] = isTravel
    ? [
        {
          label: "Add as primary time zone",
          icon: Plus,
          onSelect: run(() => {
            changeTimeZones((zones) => makeTimeZonePrimary(zones, timeZone));
            travelToTimeZone(null);
          }),
        },
        {
          label: "Add as secondary time zone",
          icon: Plus,
          onSelect: run(() => {
            changeTimeZones((zones) => addTimeZone(zones, timeZone));
            travelToTimeZone(null);
          }),
        },
        {
          label: "Travel back home",
          icon: X,
          shortcut: "esc",
          destructive: true,
          onSelect: run(() => travelToTimeZone(null)),
        },
      ]
    : [
        {
          label: "Change time zone",
          icon: Globe,
          detail: city,
          onSelect: () => setIsChanging(true),
        },
        ...(isPrimary
          ? hasOtherZones
            ? [
                {
                  label: "Make time zone secondary",
                  icon: ArrowLeft,
                  onSelect: run(() => changeTimeZones(makeTimeZoneSecondary)),
                },
              ]
            : []
          : [
              {
                label: "Make time zone primary",
                icon: ArrowRight,
                onSelect: run(() =>
                  changeTimeZones((zones) =>
                    makeTimeZonePrimary(zones, timeZone),
                  ),
                ),
              },
            ]),
        // The only zone left stays
        ...(isPrimary && !hasOtherZones
          ? []
          : [
              {
                label: "Remove time zone from list",
                icon: X,
                destructive: true,
                onSelect: run(() =>
                  changeTimeZones((zones) => removeTimeZone(zones, timeZone)),
                ),
              },
            ]),
      ];
  const actions = items.filter((item) => !item.destructive);
  const destructive = items.filter((item) => item.destructive);

  const renderItem = (item: LabelMenuItem) => {
    const Icon = item.icon;
    return (
      <CommandItem
        key={item.label}
        value={item.label}
        onSelect={item.onSelect}
        className={cn(
          MENU_ITEM_CLASS,
          item.destructive && MENU_ITEM_DESTRUCTIVE_CLASS,
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.detail && (
          <span className={cn("shrink-0", EVENT_DETAIL_MENU_SECONDARY_CLASS)}>
            {item.detail}
          </span>
        )}
        {item.shortcut && (
          <Kbd className="shrink-0 bg-calendar-menu-foreground/10 text-calendar-menu-muted-foreground">
            {item.shortcut}
          </Kbd>
        )}
      </CommandItem>
    );
  };

  return (
    <div
      className={cn(
        "relative flex w-16 flex-shrink-0 items-center justify-end pr-1",
        isTravel
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground",
      )}
      onClick={stopClick}
    >
      {/* Empty on the server and during hydration, where zones are unknown */}
      {label && (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${label} ${city} time zone`}
              onContextMenu={(e) => {
                e.preventDefault();
                handleOpenChange(true);
              }}
              className={cn(
                // Its own size: next to a text color in one class list,
                // tailwind-merge would drop the custom `text-xxs`
                "rounded-sm px-1 py-0.5 text-xxs leading-none outline-none focus-visible:ring-1 focus-visible:ring-ring",
                isTravel ? "hover:bg-primary-foreground/15" : "hover:bg-accent",
                open && !isTravel && "bg-accent",
              )}
            >
              {label}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className={cn(
              isChanging ? "w-[360px] max-w-[calc(100vw-16px)]" : "w-[240px]",
              MENU_CLASS,
            )}
            onClick={stopClick}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              // The calendar's Escape would deselect, or travel back home
              e.stopPropagation();
              setOpen(false);
            }}
          >
            {isChanging ? (
              <TimeZoneMenuList
                onSelect={(zone) => {
                  setOpen(false);
                  changeTimeZones((zones) =>
                    replaceTimeZone(zones, timeZone, zone),
                  );
                }}
              />
            ) : (
              <Command
                label={`${label} time zone`}
                // Takes the focus when the menu opens, so the arrow keys
                // and Enter reach the items
                tabIndex={0}
                className="bg-transparent p-1.5 text-inherit outline-none"
              >
                <CommandGroup className="p-0">
                  {actions.map(renderItem)}
                </CommandGroup>
                {destructive.length > 0 && (
                  <>
                    <div className="mx-1 my-[5px] h-px bg-calendar-menu-border" />
                    <CommandGroup className="p-0">
                      {destructive.map(renderItem)}
                    </CommandGroup>
                  </>
                )}
              </Command>
            )}
          </PopoverContent>
        </Popover>
      )}
      {isTravel && (
        // Tooltips need a provider with Radix; a closer one (yours) still wins
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Travel back home"
                onClick={() => travelToTimeZone(null)}
                className="absolute top-0.5 right-0.5 flex size-3 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary-foreground/80"
              >
                <X className="size-2" strokeWidth={3} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Travel back home <Kbd className="ml-1">esc</Kbd>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
