"use client";

import * as React from "react";
import { Check, ChevronDown, Link2, Video, VideoOff } from "lucide-react";

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

/** Letters of a placeholder Google Meet code */
const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** A run of random lowercase letters */
function randomLetters(length: number): string {
  return Array.from(
    { length },
    () => LETTERS[Math.floor(Math.random() * LETTERS.length)],
  ).join("");
}

/** A run of random digits */
function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

/**
 * Services the "Conferencing" menu offers when `CalendarProvider` sets no
 * `conferenceProviders`. Their links are placeholders in each service's
 * format, made up on the spot; pass your own `createConference` to create
 * real meetings.
 */
export const DEFAULT_CONFERENCE_PROVIDERS: ConferenceProviderOption[] = [
  {
    provider: "google-meet",
    label: "Google Meet",
    createConference: () => {
      const code = `${randomLetters(3)}-${randomLetters(4)}-${randomLetters(3)}`;
      return {
        provider: "google-meet",
        url: `https://meet.google.com/${code}`,
        meetingId: code,
      };
    },
  },
  {
    provider: "zoom",
    label: "Zoom",
    createConference: () => {
      const id = randomDigits(10);
      return {
        provider: "zoom",
        url: `https://zoom.us/j/${id}`,
        meetingId: `${id.slice(0, 3)} ${id.slice(3, 6)} ${id.slice(6)}`,
      };
    },
  },
  {
    provider: "microsoft-teams",
    label: "Microsoft Teams",
    createConference: () => {
      const id = randomDigits(12);
      return {
        provider: "microsoft-teams",
        url: `https://teams.microsoft.com/meet/${id}`,
        meetingId: id.replace(/(\d{3})(?=\d)/g, "$1 "),
      };
    },
  },
];

/** Google Meet's four-color camera */
function GoogleMeetLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 87.5 72" aria-hidden="true" className={className}>
      <path
        fill="#00832d"
        d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"
      />
      <path
        fill="#0066da"
        d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z"
      />
      <path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z" />
      <path fill="#2684fc" d="M20.5 20.5H0v31h20.5z" />
      <path
        fill="#00ac47"
        d="M82.6 8.68L69.5 19.42v33.66l13.16 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"
      />
      <path
        fill="#ffba00"
        d="M63.5 0h-43v20.5h29V36l20-16.57V6c0-3.315-2.685-6-6-6z"
      />
    </svg>
  );
}

/** Zoom's white camera on a blue rounded square */
function ZoomLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <rect width="16" height="16" rx="4" fill="#2D8CFF" />
      <rect x="3" y="5.25" width="7" height="5.5" rx="1.25" fill="#fff" />
      <path d="M10.5 7.4l2.5-1.65v4.5L10.5 8.6z" fill="#fff" />
    </svg>
  );
}

/** Microsoft Teams' white "T" on a purple rounded square */
function TeamsLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <rect width="16" height="16" rx="4" fill="#5B5FC7" />
      <path d="M4.5 4.75h7v1.6H8.8v5.9H7.2v-5.9H4.5z" fill="#fff" />
    </svg>
  );
}

/** The service's logo at 16px, or a muted camera for any other service */
function ProviderLogo({ provider }: { provider: ConferenceProvider }) {
  if (provider === "google-meet") {
    return <GoogleMeetLogo className="size-4 shrink-0" />;
  }
  if (provider === "zoom") {
    return <ZoomLogo className="size-4 shrink-0" />;
  }
  if (provider === "microsoft-teams") {
    return <TeamsLogo className="size-4 shrink-0" />;
  }
  return <Video className={EVENT_DETAIL_ICON_CLASS} />;
}

/** Item text in the conferencing menu */
const MENU_ITEM_CLASS = cn(EVENT_DETAIL_MENU_ITEM_CLASS, "gap-2 text-sm");

/**
 * Props for ConferencingMenuContent
 */
interface ConferencingMenuContentProps {
  providers: ConferenceProviderOption[];
  /** The event's call, checked in the list and removable */
  current?: EventConference;
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
  current,
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
      {current && (
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
          <DropdownMenuSeparator className="bg-[#303030]" />
        </>
      )}
      {providers.map((option) => (
        <DropdownMenuItem
          key={`${option.provider}-${option.label}`}
          className={MENU_ITEM_CLASS}
          onClick={() => onPick(option)}
          onMouseEnter={() => onPreview(option)}
          onFocus={() => onPreview(option)}
        >
          <span className="flex w-4 shrink-0 items-center justify-center">
            {current?.provider === option.provider && (
              <Check className="size-4 text-white" />
            )}
          </span>
          <ProviderLogo provider={option.provider} />
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

/** A row's 32px box, from 8px off the panel's edges, with the icon column at 26px */
const ROW_BOX_CLASS =
  "flex h-8 min-w-0 flex-1 items-center gap-[11px] pr-2 pl-[9px]";

/**
 * The event's video call, as in Notion Calendar. Without one, a muted
 * "Conferencing" row opens the services menu. With one, the service's logo
 * and name (a link that joins the call) and its meeting code, with a copy
 * link button and the menu (switch service, "No conferencing") on hover.
 * Services come from `CalendarProvider`'s `conferenceProviders`, or
 * `DEFAULT_CONFERENCE_PROVIDERS`.
 */
export function EventDetailConferencing<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const { conferenceProviders } = useCalendarConfig();
  const providers = conferenceProviders ?? DEFAULT_CONFERENCE_PROVIDERS;
  const conference = event.conference;
  const [menuOpen, setMenuOpen] = React.useState(false);
  /** Service under the pointer while the empty row's menu is open */
  const [preview, setPreview] = React.useState<ConferenceProviderOption | null>(
    null,
  );
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleOpenChange = (open: boolean) => {
    setMenuOpen(open);
    if (!open) setPreview(null);
  };

  const pick = (option: ConferenceProviderOption) => {
    if (conference?.provider === option.provider) return;
    onEventChange?.({ ...event, conference: option.createConference() });
  };

  const remove = () => {
    onEventChange?.({ ...event, conference: undefined });
  };

  const copyLink = () => {
    if (!conference) return;
    void navigator.clipboard?.writeText(conference.url).then(() => {
      setCopied(true);
    });
  };

  const menu = (
    <ConferencingMenuContent
      providers={providers}
      current={conference}
      onPick={pick}
      onRemove={remove}
      onPreview={setPreview}
      onClose={() => handleOpenChange(false)}
    />
  );

  if (!conference) {
    return (
      <EventDetailSection name="conferencing">
        <div className="flex min-h-[35px] items-center px-2">
          <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={!onEventChange}
                data-testid="event-conferencing-trigger"
                className={cn(
                  "group/conferencing text-left",
                  ROW_BOX_CLASS,
                  EVENT_DETAIL_HOVER_BORDER_CLASS,
                  menuOpen &&
                    "border-[#F5F5F5] bg-[#F5F5F5] dark:border-[#242424] dark:bg-[#242424]",
                )}
              >
                {preview ? (
                  <ProviderLogo provider={preview.provider} />
                ) : (
                  <Video className={EVENT_DETAIL_ICON_CLASS} />
                )}
                <span
                  className={cn(
                    "flex-1 truncate",
                    preview
                      ? EVENT_DETAIL_TEXT_CLASS
                      : EVENT_DETAIL_PLACEHOLDER_CLASS,
                  )}
                >
                  {preview ? preview.label : "Conferencing"}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 opacity-0 group-hover/conferencing:opacity-100",
                    menuOpen && "opacity-100",
                    EVENT_DETAIL_MUTED_CLASS,
                  )}
                />
              </button>
            </DropdownMenuTrigger>
            {menu}
          </DropdownMenu>
        </div>
      </EventDetailSection>
    );
  }

  const label =
    providers.find((option) => option.provider === conference.provider)
      ?.label ?? PROVIDER_NAMES[conference.provider];

  return (
    <EventDetailSection name="conferencing">
      <div className="flex min-h-[35px] items-center px-2">
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
            href={conference.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Join ${label}`}
            data-testid="event-conference-join"
            className="flex shrink-0 items-center gap-[11px]"
          >
            <ProviderLogo provider={conference.provider} />
            <span className={cn("shrink-0", EVENT_DETAIL_TEXT_CLASS)}>
              {label}
            </span>
          </a>
          {conference.meetingId && (
            <span
              className={cn("min-w-0 truncate", EVENT_DETAIL_PLACEHOLDER_CLASS)}
            >
              {conference.meetingId}
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
          <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Change conferencing"
                disabled={!onEventChange}
                className={cn(
                  "hidden size-5 shrink-0 items-center justify-center group-focus-within/conferencing:flex group-hover/conferencing:flex",
                  menuOpen && "flex",
                  EVENT_DETAIL_MUTED_CLASS,
                )}
              >
                <ChevronDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            {menu}
          </DropdownMenu>
        </div>
      </div>
      <EventDetailDivider className="my-2" />
    </EventDetailSection>
  );
}
