"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

import type { ViewSettings, ViewType } from "@/components/week-view-types";

/** Display labels for each view type */
const VIEW_LABELS: Record<ViewType, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  agenda: "Agenda",
};

/** View mode options with their shortcut labels */
const VIEW_OPTIONS: Array<{
  value: ViewType;
  label: string;
  shortcuts: Array<string>;
}> = [
  { value: "day", label: "Day", shortcuts: ["1", "or", "D"] },
  { value: "week", label: "Week", shortcuts: ["0", "or", "W"] },
  { value: "month", label: "Month", shortcuts: ["M"] },
  { value: "agenda", label: "Agenda", shortcuts: ["A"] },
];

/** Number-of-days options for the submenu */
const DAYS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Views that hide the weekend when "Weekends" is off. The rest ignore it for now */
const WEEKENDS_SETTING_VIEWS: ViewType[] = ["month", "agenda"];

/** Views that draw week numbers when "Week numbers" is on. The rest ignore it for now */
const WEEK_NUMBERS_SETTING_VIEWS: ViewType[] = ["month"];

/**
 * Shortcut hints inside menu items drop the key-cap background. Classes
 * rather than a Kbd variant, so the file works with the stock shadcn/ui Kbd.
 */
const PLAIN_KBD_CLASS = "h-auto min-w-0 rounded-none bg-transparent px-0";

/** "Soon" badge of a setting the current view doesn't read yet, as in the command menu */
const SOON_BADGE = (
  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
    Soon
  </span>
);

/**
 * A setting marked "Soon" stays disabled, but only its label and check dim:
 * the badge keeps its full strength. Both spellings of the variant, because
 * the Radix and Base UI styles of shadcn/ui write it differently.
 */
const SOON_ITEM_CLASS =
  "data-[disabled]:opacity-100 data-disabled:opacity-100 [&_svg]:opacity-50";

interface ViewDropdownProps {
  view: ViewType;
  numberOfDays: number;
  viewSettings: ViewSettings;
  onSwitchView: (view: ViewType) => void;
  onSetNumberOfDays: (count: number) => void;
  onToggleWeekends: () => void;
  onToggleDeclinedEvents: () => void;
  onToggleWeekNumbers: () => void;
}

export function ViewDropdown({
  view,
  numberOfDays,
  viewSettings,
  onSwitchView,
  onSetNumberOfDays,
  onToggleWeekends,
  onToggleDeclinedEvents,
  onToggleWeekNumbers,
}: ViewDropdownProps) {
  const weekendsSoon = !WEEKENDS_SETTING_VIEWS.includes(view);
  const weekNumbersSoon = !WEEK_NUMBERS_SETTING_VIEWS.includes(view);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-1 px-3">
          {VIEW_LABELS[view]}
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        {VIEW_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onSwitchView(option.value)}
          >
            <CheckIcon
              className={cn(
                "size-4 shrink-0",
                view !== option.value && "invisible",
              )}
            />
            {option.label}
            <KbdGroup className="ml-auto">
              {option.shortcuts.map((s) =>
                s === "or" ? (
                  <span key={s} className="text-muted-foreground text-xs">
                    or
                  </span>
                ) : (
                  <Kbd key={s} className={PLAIN_KBD_CLASS}>
                    {s}
                  </Kbd>
                ),
              )}
            </KbdGroup>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />

        {/* Number of days submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="pl-8">
            Number of days
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {DAYS_OPTIONS.map((n) => (
              <DropdownMenuItem key={n} onClick={() => onSetNumberOfDays(n)}>
                <CheckIcon
                  className={cn(
                    "size-4 shrink-0",
                    numberOfDays !== n && "invisible",
                  )}
                />
                {n} days
                <Kbd className={cn(PLAIN_KBD_CLASS, "ml-auto")}>{n}</Kbd>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />

        {/* View settings submenu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="pl-8">
            View settings
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56">
            {/* Day and week view don't hide the weekend yet */}
            <DropdownMenuCheckboxItem
              disabled={weekendsSoon}
              className={cn(weekendsSoon && SOON_ITEM_CLASS)}
              checked={viewSettings.showWeekends}
              onCheckedChange={() => onToggleWeekends()}
            >
              <span className={cn(weekendsSoon && "opacity-50")}>Weekends</span>
              {weekendsSoon ? (
                SOON_BADGE
              ) : (
                <KbdGroup className="ml-auto">
                  <Kbd className={PLAIN_KBD_CLASS}>shift</Kbd>
                  <Kbd className={PLAIN_KBD_CLASS}>&#8984;</Kbd>
                  <Kbd className={PLAIN_KBD_CLASS}>E</Kbd>
                </KbdGroup>
              )}
            </DropdownMenuCheckboxItem>

            {/* Nothing filters by this setting yet */}
            <DropdownMenuCheckboxItem
              disabled
              className={SOON_ITEM_CLASS}
              checked={viewSettings.showDeclinedEvents}
              onCheckedChange={() => onToggleDeclinedEvents()}
            >
              <span className="opacity-50">Declined events</span>
              {SOON_BADGE}
            </DropdownMenuCheckboxItem>

            {/* Only month view draws week numbers */}
            <DropdownMenuCheckboxItem
              disabled={weekNumbersSoon}
              className={cn(weekNumbersSoon && SOON_ITEM_CLASS)}
              checked={viewSettings.showWeekNumbers}
              onCheckedChange={() => onToggleWeekNumbers()}
            >
              <span className={cn(weekNumbersSoon && "opacity-50")}>
                Week numbers
              </span>
              {weekNumbersSoon && SOON_BADGE}
            </DropdownMenuCheckboxItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
