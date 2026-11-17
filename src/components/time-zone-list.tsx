"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  POPULAR_TIME_ZONES,
  getTimeZoneOption,
  getTimeZoneOptions,
  searchTimeZones,
} from "@/lib/time-zones";
import type {
  TimeZoneListProps,
  TimeZoneListVariant,
  TimeZoneOption,
} from "./week-view-types";

/** En dash between a zone's name and its city, as Notion Calendar writes it */
const NAME_CITY_SEPARATOR = " – ";

/** A titled run of zones in the list */
interface TimeZoneSection {
  key: string;
  /** Heading above the zones; none for the popular ones on top */
  heading?: string;
  options: TimeZoneOption[];
}

/** Classes of each list's items and muted text */
const VARIANT_CLASSES: Record<
  TimeZoneListVariant,
  { item: string; muted: string; heading: string; separator: string }
> = {
  command: {
    item: "",
    muted: "text-muted-foreground",
    heading: "",
    separator: "",
  },
  menu: {
    item: "h-[30px] gap-[9px] rounded-md py-0 pr-2 pl-1.5 text-sm text-[#D4D4D4] data-[selected=true]:bg-[#303030] data-[selected=true]:text-[#D4D4D4]",
    muted: "text-[#7F7F7F]",
    heading: "[&_[cmdk-group-heading]]:text-[#7F7F7F]",
    separator: "mx-0 bg-[#303030]",
  },
};

/**
 * The zones of a time zone picker, for Notion Calendar's "Travel to time
 * zone...", "Show additional time zones..." and the time axis labels'
 * menus. Renders cmdk groups: put it in a `Command` with
 * `shouldFilter={false}` next to the input that sets `query`. Without a
 * query it lists the popular zones, then every zone by offset under "All
 * time zones"; a query lists the zones whose offset, city, name or id
 * match it.
 */
export function TimeZoneList({
  query,
  onSelect,
  timeZones,
  variant = "command",
}: TimeZoneListProps) {
  // Offsets as of when the list opened
  const [now] = React.useState(() => new Date());
  // Every zone, listed once per mount: typing searches it
  const allOptions = React.useMemo(() => getTimeZoneOptions(now), [now]);
  const classes = VARIANT_CLASSES[variant];

  const sections = React.useMemo<TimeZoneSection[]>(() => {
    const byId = new Map(allOptions.map((option) => [option.id, option]));
    const pick = (ids: string[]) =>
      ids.map((id) => byId.get(id) ?? getTimeZoneOption(now, id));
    if (timeZones) {
      return [
        { key: "shown", options: searchTimeZones(pick(timeZones), query) },
      ];
    }
    if (query.trim()) {
      return [{ key: "search", options: searchTimeZones(allOptions, query) }];
    }
    return [
      { key: "popular", options: pick(POPULAR_TIME_ZONES) },
      { key: "all", heading: "All time zones", options: allOptions },
    ];
  }, [allOptions, now, timeZones, query]);

  return (
    <>
      <CommandEmpty className={cn("py-6 text-center text-sm", classes.muted)}>
        No time zones found.
      </CommandEmpty>
      {sections.map((section, index) => (
        <React.Fragment key={section.key}>
          {index > 0 && <CommandSeparator className={classes.separator} />}
          <CommandGroup
            heading={section.heading}
            className={cn(variant === "menu" && "p-1", classes.heading)}
          >
            {section.options.map((option) => (
              <CommandItem
                key={option.id}
                // Unique across sections: a popular zone is also under "All"
                value={`${section.key}:${option.id}`}
                onSelect={() => onSelect(option.id)}
                className={classes.item}
              >
                {variant === "command" ? (
                  <span className="min-w-0 truncate">
                    ({option.offsetLabel}) {option.name}
                    {NAME_CITY_SEPARATOR}
                    {option.city}
                  </span>
                ) : (
                  <>
                    <span className={cn("shrink-0", classes.muted)}>
                      {option.offsetLabel}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {option.name}
                      {NAME_CITY_SEPARATOR}
                      {option.city}
                    </span>
                  </>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        </React.Fragment>
      ))}
    </>
  );
}
