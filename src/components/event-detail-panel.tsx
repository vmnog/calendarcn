"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { differenceInMinutes, format } from "date-fns";
import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  MapPin,
  MoreHorizontal,
  NotepadText,
  RefreshCcw,
  Scissors,
  SquareDashed,
  Trash2,
  User,
  Video,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { CalendarEvent, EventColor } from "./week-view-types";

interface EventDetailPanelProps {
  event: CalendarEvent;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
}

const colorDotClass: Record<EventColor, string> = {
  red: "bg-event-red-border",
  orange: "bg-event-orange-border",
  yellow: "bg-event-yellow-border",
  green: "bg-event-green-border",
  blue: "bg-event-blue-border",
  purple: "bg-event-purple-border",
  gray: "bg-event-gray-border",
};

function formatDuration(start: Date, end: Date): string {
  const totalMinutes = differenceInMinutes(end, start);

  if (totalMinutes < 60) {
    return `${totalMinutes}min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h${minutes}min`;
}

function formatTimeDisplay(date: Date): string {
  const minutes = date.getMinutes();
  if (minutes === 0) {
    return format(date, "h a");
  }
  return format(date, "h:mm a");
}

function formatVisibility(visibility?: "default" | "public" | "private"): string {
  if (visibility === "public") {
    return "Public";
  }
  if (visibility === "private") {
    return "Private";
  }
  return "Default visibility";
}

function FieldRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="size-4 shrink-0 text-[#C7C5C1] dark:text-[#595959]" />
      <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">{label}</span>
      {value && (
        <span className="text-muted-foreground text-xs">{value}</span>
      )}
    </div>
  );
}

function TimezoneDisplay({ timezone }: { timezone: string }) {
  const spaceIdx = timezone.indexOf(" ");
  if (spaceIdx === -1) {
    return <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">{timezone}</span>;
  }

  const code = timezone.substring(0, spaceIdx);
  const city = timezone.substring(spaceIdx + 1);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-[#C7C5C1] dark:text-[#595959]">{code}</span>
      <span className="text-foreground">{city}</span>
    </span>
  );
}

function RecurrenceDisplay({ recurrence }: { recurrence: string }) {
  const onIdx = recurrence.indexOf(" on ");
  if (onIdx === -1) {
    return <span className="text-foreground text-xs">{recurrence}</span>;
  }

  const main = recurrence.substring(0, onIdx);
  const suffix = recurrence.substring(onIdx);

  return (
    <span className="text-xs">
      <span className="text-foreground">{main}</span>
      <span className="text-[#C7C5C1] dark:text-[#595959]">{suffix}</span>
    </span>
  );
}

const EVENT_TYPES = ["Event", "Focus time", "Out of office", "Birthday"] as const;
type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_TOOLTIPS: Partial<Record<EventType, string>> = {
  "Focus time": "Create a focus time event with the option to automatically decline meetings during this time. Available for work and school accounts.",
  "Out of office": "Create an out of office (OOO) event with the option to automatically decline meetings during this time. Available for work and school accounts.",
  "Birthday": "Create a birthday event to keep track of a person's upcoming birthdays. Birthdays from your Google Contacts may appear on a separate Birthday calendar.",
};

function EventTypeHelpIcon({ tooltip }: { tooltip?: string }) {
  const [tooltipPos, setTooltipPos] = React.useState<{ top: number; left: number } | null>(null);

  if (!tooltip) {
    return null;
  }

  function handleMouseEnter(e: React.MouseEvent<HTMLSpanElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top + rect.height / 2, left: rect.left });
  }

  function handleMouseLeave() {
    setTooltipPos(null);
  }

  return (
    <span
      className="ml-auto shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <CircleHelp className="size-3.5 text-white" />
      {tooltipPos && ReactDOM.createPortal(
        <div
          className="pointer-events-none fixed z-[100] max-w-[240px] rounded-md bg-[#252525] border border-[#303030] px-2 py-1 text-xs text-white shadow-md"
          style={{ top: tooltipPos.top, left: tooltipPos.left - 8, transform: "translate(-100%, -50%)" }}
        >
          {tooltip}
        </div>,
        document.body
      )}
    </span>
  );
}

export function EventDetailPanel({ event, onPrevWeek, onNextWeek }: EventDetailPanelProps) {
  const color = event.color ?? "blue";
  const [eventType, setEventType] = React.useState<EventType>("Event");

  const otherTypes = EVENT_TYPES.filter((t) => t !== eventType);

  return (
    <div className="flex flex-col gap-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="text-foreground flex items-center gap-0.5 text-xs font-medium">
              {eventType}
              <ChevronDown className="text-[#C7C5C1] dark:text-[#595959] size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="left" className="min-w-[180px] bg-[#252525] border-[#303030]">
            <DropdownMenuItem className="group/item text-xs text-white focus:bg-[#303030] focus:text-white" onSelect={() => setEventType(eventType)}>
              <Check className="size-3.5" />
              <span className="flex-1">{eventType}</span>
              <EventTypeHelpIcon tooltip={EVENT_TYPE_TOOLTIPS[eventType]} />
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#303030]" />
            {otherTypes.map((type) => (
              <DropdownMenuItem key={type} className="group/item text-xs text-white focus:bg-[#303030] focus:text-white pl-8" onSelect={() => setEventType(type)}>
                <span className="flex-1">{type}</span>
                <EventTypeHelpIcon tooltip={EVENT_TYPE_TOOLTIPS[type]} />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7 text-[#C7C5C1] dark:text-[#595959]">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="left" className="min-w-[180px]">
            <DropdownMenuItem className="text-xs">
              <Scissors className="size-3.5" />
              Cut
              <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs">
              <Copy className="size-3.5" />
              Copy
              <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-xs">
              <SquareDashed className="size-3.5" />
              Duplicate
              <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="text-xs">
              <Trash2 className="size-3.5" />
              Delete
              <DropdownMenuShortcut>delete</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <p className="text-foreground px-4 text-xs">{event.title}</p>

      {/* Divider */}
      <div className="border-border border-t" />

      {/* Time */}
      {!event.isAllDay && (
        <div className="flex items-center gap-3 px-4">
          <Clock className="size-4 shrink-0 text-[#C7C5C1] dark:text-[#595959]" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-foreground font-medium">{formatTimeDisplay(event.start)}</span>
            <span className="text-[#C7C5C1] dark:text-[#595959]">→</span>
            <span className="text-foreground font-medium">{formatTimeDisplay(event.end)}</span>
            <span className="text-[#C7C5C1] dark:text-[#595959]">{formatDuration(event.start, event.end)}</span>
          </div>
        </div>
      )}

      {/* Date — indented to align with time text */}
      <div className="text-foreground pl-11 text-xs">
        {format(event.start, "EEE MMM d")}
      </div>

      {event.recurrence ? (
        <>
          {/* All-day toggle row */}
          <div className="flex items-center gap-3 px-4">
            <Switch size="xs" className="data-[state=unchecked]:!bg-[#C7C5C1] dark:data-[state=unchecked]:!bg-[#595959] data-[state=checked]:!bg-[#3A85D3]" />
            <span className="text-foreground text-xs">All-day</span>
          </div>

          {/* Timezone row */}
          <div className="flex items-center gap-3 px-4">
            <Globe className="size-4 shrink-0 text-[#C7C5C1] dark:text-[#595959]" />
            <TimezoneDisplay timezone={event.timezone ?? "GMT-3 Sao Paulo"} />
          </div>

          {/* Recurrence row */}
          <div className="flex items-center gap-3 px-4">
            <RefreshCcw className="size-4 shrink-0 text-[#C7C5C1] dark:text-[#595959]" />
            <div className="flex flex-1 items-center justify-between">
              <RecurrenceDisplay recurrence={event.recurrence} />
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="size-6 text-[#C7C5C1] dark:text-[#595959]" onClick={onPrevWeek}>
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-6 text-[#C7C5C1] dark:text-[#595959]" onClick={onNextWeek}>
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-6 pl-11">
          <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">All-day</span>
          <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">Time zone</span>
          <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">Repeat</span>
        </div>
      )}

      {/* Divider */}
      <div className="border-border border-t" />

      {/* Field sections */}
      <div className="flex flex-col px-4">
        <FieldRow icon={User} label="Participants and Rooms" />
        <FieldRow icon={Video} label="Conferencing" />
        <FieldRow icon={NotepadText} label="AI Meeting Notes and Docs" />
        <FieldRow icon={MapPin} label="Location" value={event.location} />
      </div>

      {/* Divider */}
      <div className="border-border border-t" />

      {/* Description */}
      <div className="flex flex-col gap-1 px-4">
        <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">Description</span>
        {event.description && (
          <span className="text-foreground text-xs">{event.description}</span>
        )}
      </div>

      {/* Divider */}
      <div className="border-border border-t" />

      {/* Calendar */}
      <div className="flex items-center gap-2 px-4">
        <div className={cn("size-3 rounded-xs", colorDotClass[color])} />
        <span className="text-foreground text-xs">
          {event.calendarEmail ?? event.calendarId ?? "Calendar"}
        </span>
      </div>

      {/* Status */}
      <div className="mt-1 grid grid-cols-2 pl-9">
        <span className="text-foreground text-xs font-medium capitalize">
          {event.status ?? "Busy"}
        </span>
        <span className="text-foreground text-xs font-medium">
          {formatVisibility(event.visibility)}
        </span>
      </div>

      {/* Reminders */}
      <div className="mt-1 flex flex-col gap-3 px-4">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-[#C7C5C1] dark:text-[#595959]" />
          <span className="text-xs text-[#C7C5C1] dark:text-[#595959]">Reminders</span>
        </div>
        {event.reminders && event.reminders.length > 0 && (
          event.reminders.map((reminder) => (
            <span
              key={`${reminder.amount}-${reminder.unit}`}
              className="text-foreground pl-6 text-xs"
            >
              <span className="font-medium">{reminder.amount}{reminder.unit.replace(/s$/, "")}</span>
              {" "}before
            </span>
          ))
        )}
      </div>
    </div>
  );
}
