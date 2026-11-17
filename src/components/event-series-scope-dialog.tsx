"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCalendarSeriesScope } from "./calendar-provider";
import {
  EVENT_DETAIL_ACCENT_BG_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  RadioDot,
} from "./event-detail-parts";
import type {
  EventChangeSummaryRow,
  SeriesEditScope,
  SeriesScopeQuestion,
} from "./calendar-types";

/** Each option's label, as Notion Calendar words it */
const SERIES_SCOPE_LABELS: Record<SeriesEditScope, string> = {
  this: "This event",
  following: "This and following events",
  all: "All events",
};

/** The question's title, Notion's, before the quoted event title */
const SERIES_SCOPE_TITLES: Record<SeriesScopeQuestion["action"], string> = {
  update: "Edit repeat event",
  delete: "Delete repeat event",
};

/** A neutral button: Continue editing, Cancel */
const NEUTRAL_BUTTON_CLASS =
  "h-8 whitespace-nowrap rounded-md border border-[#E8E8E4] px-3 text-foreground hover:bg-[#F5F5F5] dark:border-[#373737] dark:bg-[#303030] dark:hover:bg-[#373737]";

/** A filled button: Save event in blue, Delete event in red */
const FILLED_BUTTON_CLASS =
  "h-8 whitespace-nowrap rounded-md px-3 text-white hover:brightness-110";

/** Red of Discard change and Delete event, the details' delete red */
const DESTRUCTIVE_TEXT_CLASS = "text-[#E56458]";

/** One line of the edit question's summary: the label, the new value, the old one struck */
function SummaryRow({ row }: { row: EventChangeSummaryRow }) {
  return (
    <div className="flex gap-3">
      <span className={cn("w-20 shrink-0", EVENT_DETAIL_SECONDARY_CLASS)}>
        {row.label}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate">
          {row.after ?? "Changed"}
          <span aria-hidden className="ml-1.5 text-[8px] align-middle">
            {"●"}
          </span>
        </span>
        {row.before !== null && (
          <span
            className={cn(
              "truncate line-through",
              EVENT_DETAIL_SECONDARY_CLASS,
            )}
          >
            {row.before}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Notion Calendar's question after a change to a date of a repeating event:
 * "This event", "This and following events" (not on the first date) or "All
 * events". The edit question lists what changed and offers Discard change,
 * Continue editing and Save event; the delete question Cancel and Delete
 * event. The views render one; render it once yourself in a layout that has
 * none of them.
 */
export function EventSeriesScopeDialog() {
  const { question, answer, registerDialog } = useCalendarSeriesScope();
  /** The last question, kept on screen while the dialog closes */
  const [shownQuestion, setShownQuestion] =
    React.useState<SeriesScopeQuestion | null>(null);
  const [scope, setScope] = React.useState<SeriesEditScope>("this");
  /**
   * True while the event that opened the question is still being handled.
   * The Escape that leaves an event opens the question, and Base UI's
   * dialog, which starts listening as it opens, would take that same key as
   * a request to close
   */
  const isOpeningRef = React.useRef(false);
  // A new question starts on its first option. Adjusted while rendering,
  // so its first frame already has it
  if (question && question !== shownQuestion) {
    setShownQuestion(question);
    setScope(question.scopes[0] ?? "this");
  }
  const shown = question ?? shownQuestion;

  React.useEffect(() => registerDialog(), [registerDialog]);

  React.useLayoutEffect(() => {
    if (!question) return;
    isOpeningRef.current = true;
    const timer = window.setTimeout(() => {
      isOpeningRef.current = false;
    });
    return () => {
      window.clearTimeout(timer);
      isOpeningRef.current = false;
    };
  }, [question]);

  const isDelete = shown?.action === "delete";
  const summary = shown?.summary ?? [];

  return (
    // Stays mounted while closed, so its Escape handling always runs
    <Dialog
      open={question !== null}
      onOpenChange={(open) => {
        if (open || isOpeningRef.current) return;
        // Escape never discards: it continues editing, or cancels a delete
        answer({ action: isDelete ? "cancel" : "continue" });
      }}
    >
      <DialogContent
        showCloseButton={false}
        // Inside the event details as far as their popover and the views'
        // click handlers are concerned, so it doesn't close them
        data-calendar-popover=""
        className="w-[420px] max-w-[calc(100vw-32px)] gap-4 rounded-xl border-[#E8E8E4] bg-white p-5 text-sm font-medium dark:border-[#303030] dark:bg-[#252525]"
        // Keys stay in the question: Escape must not deselect the event and
        // single-key shortcuts must not move the calendar behind it. Tab is
        // left to the dialog's focus trap
        onKeyDown={(e) => {
          if (e.key !== "Tab") e.stopPropagation();
        }}
      >
        <DialogTitle className="text-base font-medium">
          {shown ? `${SERIES_SCOPE_TITLES[shown.action]} “${shown.title}”` : ""}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Choose which events of the series the change applies to
        </DialogDescription>
        <div
          role="radiogroup"
          aria-label="Apply to"
          className="flex flex-col gap-1"
        >
          {shown?.scopes.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={scope === option}
              onClick={() => setScope(option)}
              className="flex h-8 items-center gap-2.5 text-left text-foreground outline-none focus-visible:underline"
            >
              <RadioDot checked={scope === option} />
              {SERIES_SCOPE_LABELS[option]}
            </button>
          ))}
        </div>
        {!isDelete && summary.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-[#E8E8E4] pt-4 dark:border-[#373737]">
            {summary.map((row) => (
              <SummaryRow key={row.label} row={row} />
            ))}
          </div>
        )}
        {isDelete ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => answer({ action: "cancel" })}
              className={NEUTRAL_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => answer({ action: "delete", scope })}
              className={cn(FILLED_BUTTON_CLASS, "bg-[#E56458]")}
            >
              Delete event
            </button>
          </div>
        ) : (
          // Wraps on phones rather than squeezing the labels
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => answer({ action: "discard" })}
              className={cn(
                "mr-auto h-8 whitespace-nowrap rounded-md px-1 hover:underline",
                DESTRUCTIVE_TEXT_CLASS,
              )}
            >
              Discard change
            </button>
            <button
              type="button"
              onClick={() => answer({ action: "continue" })}
              className={NEUTRAL_BUTTON_CLASS}
            >
              Continue editing
            </button>
            <button
              type="button"
              onClick={() => answer({ action: "save", scope })}
              className={cn(FILLED_BUTTON_CLASS, EVENT_DETAIL_ACCENT_BG_CLASS)}
            >
              Save event
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The dot before the title of an event whose change waits for the series
 * question (Notion's pending change). Draws nothing for other events
 */
export function SeriesChangeDot({ eventId }: { eventId: string }) {
  const { pendingEventId } = useCalendarSeriesScope();
  if (pendingEventId !== eventId) return null;
  return (
    <span aria-hidden className="mr-1 inline-block align-middle text-[8px]">
      {"●"}
    </span>
  );
}
