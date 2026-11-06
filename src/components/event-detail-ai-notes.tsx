"use client";

import { ChevronDown, NotepadText, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_MUTED_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** A row's 32px box, from 8px off the panel's edges, with the icon column at 26px */
const ROW_BOX_CLASS =
  "flex h-8 min-w-0 flex-1 items-center gap-[11px] pr-2 pl-[9px]";

/**
 * AI meeting notes, as in Notion Calendar. Off: a muted "Add AI meeting
 * notes" row, or, once the event has a call, Notion's full-width "Add
 * meeting note" button (the panel shows it above the call). On: "AI meeting
 * notes" with a button that turns them off. Toggles `aiMeetingNotes`.
 */
export function EventDetailAiNotes<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const setNotes = (on: boolean) => {
    onEventChange?.({ ...event, aiMeetingNotes: on ? true : undefined });
  };

  if (event.aiMeetingNotes) {
    return (
      <EventDetailSection name="ai-notes">
        <div className="flex min-h-[35px] items-center px-2">
          <div className={cn("group/ai-notes", ROW_BOX_CLASS)}>
            <NotepadText className={EVENT_DETAIL_ICON_CLASS} />
            <span className={cn("flex-1 truncate", EVENT_DETAIL_TEXT_CLASS)}>
              AI meeting notes
            </span>
            {onEventChange && (
              <button
                type="button"
                aria-label="Turn off AI meeting notes"
                title="Turn off AI meeting notes"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center opacity-0 group-hover/ai-notes:opacity-100 focus-visible:opacity-100",
                  EVENT_DETAIL_SECONDARY_CLASS,
                )}
                onClick={() => setNotes(false)}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>
      </EventDetailSection>
    );
  }

  if (event.conference) {
    return (
      <EventDetailSection name="ai-notes">
        <div className="flex min-h-[35px] items-center px-2">
          <button
            type="button"
            disabled={!onEventChange}
            data-testid="event-ai-notes-button"
            className={cn(
              "flex h-8 flex-1 items-center rounded-md border border-[#F0F0F0] bg-[#FBFBFB] hover:bg-[#F5F5F5] dark:border-[#303030] dark:bg-[#282828] dark:hover:bg-[#2E2E2E]",
              EVENT_DETAIL_TEXT_CLASS,
            )}
            onClick={() => setNotes(true)}
          >
            <span className="flex flex-1 items-center justify-center gap-1.5">
              <NotepadText className="size-4" />
              Add meeting note
            </span>
            <span className="flex h-full w-8 items-center justify-center border-l border-[#F0F0F0] dark:border-[#303030]">
              <ChevronDown className="size-4" />
            </span>
          </button>
        </div>
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="ai-notes">
      <div className="flex min-h-[35px] items-center px-2">
        <button
          type="button"
          disabled={!onEventChange}
          data-testid="event-ai-notes-button"
          className={cn(
            "text-left",
            ROW_BOX_CLASS,
            EVENT_DETAIL_HOVER_BORDER_CLASS,
          )}
          onClick={() => setNotes(true)}
        >
          <NotepadText
            className={cn("size-4 shrink-0", EVENT_DETAIL_MUTED_CLASS)}
          />
          <span className={cn("truncate", EVENT_DETAIL_PLACEHOLDER_CLASS)}>
            Add AI meeting notes
          </span>
        </button>
      </div>
    </EventDetailSection>
  );
}
