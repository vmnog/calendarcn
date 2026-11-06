"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  Link2,
  LoaderCircle,
  Video,
  VideoOff,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCalendarConfig } from "./calendar-provider";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_MENU_ITEM_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailDivider,
  EventDetailSection,
} from "./event-detail-parts";
import {
  EVENT_DETAIL_MENU_SECONDARY_CLASS,
  closeMenuOnEscape,
} from "./event-detail-suggestions";
import type {
  ConferenceProvider,
  ConferenceProviderOption,
  DetailedCalendarEvent,
  EventConference,
  EventDetailSectionProps,
} from "./week-view-types";

/** Name shown for a call whose service isn't among the offered ones */
const PROVIDER_NAMES: Record<ConferenceProvider, string> = {
  "google-meet": "Google Meet",
  zoom: "Zoom",
  "microsoft-teams": "Microsoft Teams",
  other: "Video call",
};

/** Item text in the conferencing menu */
const MENU_ITEM_CLASS = cn(EVENT_DETAIL_MENU_ITEM_CLASS, "gap-2 text-sm");

/** A row's 32px box, from 8px off the panel's edges, with the icon column at 26px */
const ROW_BOX_CLASS =
  "flex h-8 min-w-0 flex-1 items-center gap-[11px] pr-2 pl-[9px]";

/** Fill of the empty row while its menu is open */
const OPEN_ROW_CLASS =
  "border-[#F5F5F5] bg-[#F5F5F5] dark:border-[#242424] dark:bg-[#242424]";

/** The fallback camera's color in the (dark) menu */
const MENU_ICON_CLASS = cn(
  "size-4 shrink-0",
  EVENT_DETAIL_MENU_SECONDARY_CLASS,
);

/** A call being created by an option whose `createConference` is async */
interface PendingConference {
  option: ConferenceProviderOption;
  /** Event it's created for: another event's panel doesn't show it */
  eventId: string;
}

/** Whether `createConference` returned a promise rather than the call */
function isPromiseLike(
  value: EventConference | PromiseLike<EventConference>,
): value is PromiseLike<EventConference> {
  return "then" in value;
}

/**
 * The option that created the call: the one with its label, or, for a call
 * without one (imported, or set by the app), the first of its service
 */
function findOption(
  providers: ConferenceProviderOption[],
  conference: EventConference,
): ConferenceProviderOption | undefined {
  if (conference.label) {
    const labeled = providers.find(
      (option) => option.label === conference.label,
    );
    if (labeled) return labeled;
  }
  return providers.find((option) => option.provider === conference.provider);
}

/**
 * Props for ProviderIcon
 */
interface ProviderIconProps {
  /** The option's icon */
  icon?: React.ReactNode;
  /** Classes of the camera drawn without an icon */
  fallbackClassName?: string;
}

/** A service's 16px icon, or a camera for one without an icon */
function ProviderIcon({
  icon,
  fallbackClassName = EVENT_DETAIL_ICON_CLASS,
}: ProviderIconProps) {
  if (!icon) {
    return <Video className={fallbackClassName} />;
  }
  return (
    <span className="flex size-4 shrink-0 items-center justify-center [&>svg]:size-4">
      {icon}
    </span>
  );
}

/**
 * Props for ConferencingMenuContent
 */
interface ConferencingMenuContentProps {
  providers: ConferenceProviderOption[];
  /** Whether the event has a call, which adds "No conferencing" */
  hasCall: boolean;
  /** Option of the event's call, checked in the list */
  currentOption?: ConferenceProviderOption;
  onPick: (option: ConferenceProviderOption) => void;
  onRemove: () => void;
  /** Called with the item under the pointer or keyboard, previewed in the trigger */
  onPreview: (option: ConferenceProviderOption | null) => void;
  /** Closes the menu (on Escape) */
  onClose: () => void;
}

/**
 * Notion's conferencing menu: "No conferencing" once a call is set, then
 * each service with a check on the current one and its hint (e.g.
 * "Connect") at the end
 */
function ConferencingMenuContent({
  providers,
  hasCall,
  currentOption,
  onPick,
  onRemove,
  onPreview,
  onClose,
}: ConferencingMenuContentProps) {
  return (
    <DropdownMenuContent
      align="start"
      side="left"
      sideOffset={13}
      className={cn("min-w-[227px]", EVENT_DETAIL_MENU_CLASS)}
      onMouseLeave={() => onPreview(null)}
      onKeyDown={closeMenuOnEscape(onClose)}
    >
      {hasCall && (
        <>
          <DropdownMenuItem
            className={MENU_ITEM_CLASS}
            onClick={onRemove}
            onMouseEnter={() => onPreview(null)}
          >
            <span className="w-4 shrink-0" />
            <VideoOff className="size-4 text-white" />
            No conferencing
          </DropdownMenuItem>
          {providers.length > 0 && (
            <DropdownMenuSeparator className="bg-[#303030]" />
          )}
        </>
      )}
      {providers.map((option) => (
        <DropdownMenuItem
          key={option.label}
          className={MENU_ITEM_CLASS}
          onClick={() => onPick(option)}
          onMouseEnter={() => onPreview(option)}
          onFocus={() => onPreview(option)}
        >
          <span className="flex w-4 shrink-0 items-center justify-center">
            {option === currentOption && (
              <Check className="size-4 text-white" />
            )}
          </span>
          <ProviderIcon
            icon={option.icon}
            fallbackClassName={MENU_ICON_CLASS}
          />
          <span className="flex-1">{option.label}</span>
          {option.hint && (
            <span className={cn("ml-3", EVENT_DETAIL_MENU_SECONDARY_CLASS)}>
              {option.hint}
            </span>
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  );
}

/**
 * The event's video call, as in Notion Calendar. Without one, a muted
 * "Conferencing" row opens the services menu; an option whose
 * `createConference` is async shows as pending until its call arrives.
 * With one, the service's icon and name (a link that joins the call) and
 * its meeting code, with a copy link button and the menu (switch service,
 * "No conferencing") on hover. Services come from `CalendarProvider`'s
 * `conferenceProviders`; without any, the row is hidden unless the event
 * already has a call.
 */
export function EventDetailConferencing<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { conferenceProviders: providers } = useCalendarConfig();
  const conference = event.conference;
  const sectionRef = React.useRef<HTMLDivElement>(null);
  const joinRef = React.useRef<HTMLAnchorElement>(null);
  /** The latest event and handler, for a call that arrives after a wait */
  const eventRef = React.useRef(event);
  const onEventChangeRef = React.useRef(onEventChange);
  /** Bumped by every change, so only the latest pending call is applied */
  const requestRef = React.useRef(0);
  /** Set when a pending call arrives with focus in the row: focus moves to it */
  const focusCallRef = React.useRef(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  /** Service under the pointer while the empty row's menu is open */
  const [preview, setPreview] = React.useState<ConferenceProviderOption | null>(
    null,
  );
  const [pending, setPending] = React.useState<PendingConference | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    eventRef.current = event;
    onEventChangeRef.current = onEventChange;
  }, [event, onEventChange]);

  // A call that arrives after the panel closes is dropped
  React.useEffect(() => {
    const requests = requestRef;
    return () => {
      requests.current += 1;
    };
  }, []);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  React.useEffect(() => {
    if (!conference || !focusCallRef.current) return;
    focusCallRef.current = false;
    joinRef.current?.focus();
  }, [conference]);

  const currentOption = conference
    ? findOption(providers, conference)
    : undefined;
  const pendingOption =
    pending?.eventId === event.id ? pending.option : undefined;

  if (!conference && providers.length === 0) return null;

  const handleOpenChange = (open: boolean) => {
    if (open && pendingOption) return;
    setMenuOpen(open);
    if (!open) setPreview(null);
  };

  const setCall = (next: EventConference | undefined) => {
    requestRef.current += 1;
    setPending(null);
    onEventChange?.({ ...event, conference: next });
  };

  const pick = (option: ConferenceProviderOption) => {
    if (option === currentOption) return;
    const result = option.createConference(event);
    if (!isPromiseLike(result)) {
      // Picked from the menu, which hands focus back to the row
      focusCallRef.current = true;
      setCall({ ...result, label: option.label });
      return;
    }

    requestRef.current += 1;
    const request = requestRef.current;
    const eventId = event.id;
    setPending({ option, eventId });
    result.then(
      (created) => {
        if (request !== requestRef.current) return;
        setPending(null);
        const latest = eventRef.current;
        if (latest.id !== eventId) return;
        focusCallRef.current =
          sectionRef.current?.contains(document.activeElement) ?? false;
        onEventChangeRef.current?.({
          ...latest,
          conference: { ...created, label: option.label },
        });
      },
      () => {
        if (request === requestRef.current) setPending(null);
      },
    );
  };

  const copyLink = () => {
    if (!conference) return;
    void navigator.clipboard?.writeText(conference.url).then(() => {
      setCopied(true);
    });
  };

  const shown = pendingOption ?? preview;
  /** The call the row shows: none while a new one is being created */
  const shownCall = pendingOption ? undefined : conference;
  const callLabel = shownCall
    ? (currentOption?.label ??
      shownCall.label ??
      PROVIDER_NAMES[shownCall.provider])
    : "";

  return (
    <EventDetailSection name="conferencing" ref={sectionRef}>
      {/* One menu for both states, so focus returns to the call's menu
          button once a pick replaces the empty row */}
      <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange}>
        <div className="flex min-h-[35px] items-center px-2">
          {shownCall ? (
            <div
              className={cn(
                "group/conferencing",
                ROW_BOX_CLASS,
                "gap-2",
                EVENT_DETAIL_HOVER_BORDER_CLASS,
                menuOpen && "border-[#E8E8E4] dark:border-[#373737]",
              )}
            >
              <a
                ref={joinRef}
                href={shownCall.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Join ${callLabel}`}
                data-testid="event-conference-join"
                className="flex shrink-0 items-center gap-[11px] outline-none"
              >
                <ProviderIcon icon={currentOption?.icon} />
                <span className={cn("shrink-0", EVENT_DETAIL_TEXT_CLASS)}>
                  {callLabel}
                </span>
              </a>
              {shownCall.meetingId && (
                <span
                  className={cn(
                    "min-w-0 truncate",
                    EVENT_DETAIL_PLACEHOLDER_CLASS,
                  )}
                >
                  {shownCall.meetingId}
                </span>
              )}
              <button
                type="button"
                aria-label={copied ? "Link copied" : "Copy link"}
                title={copied ? "Copied" : "Copy link"}
                className={cn(
                  "hidden size-5 shrink-0 items-center justify-center rounded-sm group-focus-within/conferencing:flex group-hover/conferencing:flex",
                  (menuOpen || copied) && "flex",
                  EVENT_DETAIL_SECONDARY_CLASS,
                )}
                onClick={copyLink}
              >
                {copied ? (
                  <Check className="size-3.5" />
                ) : (
                  <Link2 className="size-3.5 -rotate-45" />
                )}
              </button>
              <span className="flex-1" />
              {onEventChange && (
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Change conferencing"
                    className={cn(
                      "hidden size-5 shrink-0 items-center justify-center group-focus-within/conferencing:flex group-hover/conferencing:flex",
                      menuOpen && "flex",
                      EVENT_DETAIL_MUTED_CLASS,
                    )}
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </DropdownMenuTrigger>
              )}
            </div>
          ) : (
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={!onEventChange}
                aria-busy={pendingOption ? true : undefined}
                aria-label={
                  pendingOption
                    ? `Creating ${pendingOption.label} call`
                    : undefined
                }
                data-testid="event-conferencing-trigger"
                className={cn(
                  "group/conferencing text-left",
                  ROW_BOX_CLASS,
                  EVENT_DETAIL_HOVER_BORDER_CLASS,
                  menuOpen && OPEN_ROW_CLASS,
                )}
              >
                <ProviderIcon icon={shown?.icon} />
                <span
                  className={cn(
                    "flex-1 truncate",
                    shown
                      ? EVENT_DETAIL_TEXT_CLASS
                      : EVENT_DETAIL_PLACEHOLDER_CLASS,
                  )}
                >
                  {shown ? shown.label : "Conferencing"}
                </span>
                {pendingOption ? (
                  <LoaderCircle
                    className={cn(
                      "size-4 shrink-0 animate-spin",
                      EVENT_DETAIL_MUTED_CLASS,
                    )}
                  />
                ) : (
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 opacity-0 group-hover/conferencing:opacity-100",
                      menuOpen && "opacity-100",
                      EVENT_DETAIL_MUTED_CLASS,
                    )}
                  />
                )}
              </button>
            </DropdownMenuTrigger>
          )}
        </div>
        <ConferencingMenuContent
          providers={providers}
          hasCall={Boolean(conference)}
          currentOption={currentOption}
          onPick={pick}
          onRemove={() => setCall(undefined)}
          onPreview={setPreview}
          onClose={() => handleOpenChange(false)}
        />
      </DropdownMenu>
      {conference && <EventDetailDivider className="my-2" />}
    </EventDetailSection>
  );
}
