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

/**
 * Shortcut hints inside menu items drop the key-cap background. Classes
 * rather than a Kbd variant, so the file works with the stock shadcn/ui Kbd.
 */
const PLAIN_KBD_CLASS = "h-auto min-w-0 rounded-none bg-transparent px-0";

/** "Soon" badge of a setting that isn't built yet, as in the command menu */
const SOON_BADGE = (
  <span className="bg-muted text-muted-foreground ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-medium">
    Soon
  </span>
);

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
            <DropdownMenuCheckboxItem
              checked={viewSettings.showWeekends}
              onCheckedChange={() => onToggleWeekends()}
            >
              Weekends
              <KbdGroup className="ml-auto">
                <Kbd className={PLAIN_KBD_CLASS}>shift</Kbd>
                <Kbd className={PLAIN_KBD_CLASS}>&#8984;</Kbd>
                <Kbd className={PLAIN_KBD_CLASS}>E</Kbd>
              </KbdGroup>
            </DropdownMenuCheckboxItem>

            {/* Nothing filters by this setting yet */}
            <DropdownMenuCheckboxItem
              disabled
              checked={viewSettings.showDeclinedEvents}
              onCheckedChange={() => onToggleDeclinedEvents()}
            >
              Declined events
              {SOON_BADGE}
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={viewSettings.showWeekNumbers}
              onCheckedChange={() => onToggleWeekNumbers()}
            >
              Week numbers
            </DropdownMenuCheckboxItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
