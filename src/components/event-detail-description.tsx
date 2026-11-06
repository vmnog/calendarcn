"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_INPUT_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventDetailSectionProps,
} from "./week-view-types";

/** A web address in free text, up to the next space, quote or angle bracket */
const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;

/** Punctuation that ends the sentence around an address, not the address */
const TRAILING_PUNCTUATION_PATTERN = /[.,;:!?'"]+$/;

/**
 * Lines the description editor is tall enough for while it's edited, before
 * it grows with the text, as Notion's is
 */
const DESCRIPTION_MIN_LINES = 3;

/**
 * Link text in the details panel: a faint underline that takes the text
 * color on hover, as Notion's links do
 */
export const EVENT_DETAIL_LINK_CLASS =
  "underline decoration-[#EEEEEE] decoration-1 underline-offset-2 hover:decoration-current dark:decoration-[#242424]";

/**
 * The description box, read or edited: 8px in from the panel's edges, with
 * the text from 16px, one 32px line tall at rest in a 35px row, its lines
 * 20px apart, as Notion's
 */
const DESCRIPTION_BOX_CLASS =
  "mx-2 my-[1.5px] block rounded-sm border px-[7px] py-[5px] leading-5 break-words whitespace-pre-wrap";

/**
 * A run of description text; `url` is set when the run is a web address
 */
interface DescriptionPart {
  text: string;
  url?: string;
}

/**
 * Drops sentence punctuation from the end of an address, and a closing
 * parenthesis the address didn't open ("(see https://example.com)")
 */
function trimUrl(raw: string): string {
  let url = raw.replace(TRAILING_PUNCTUATION_PATTERN, "");
  while (url.endsWith(")") && url.split(")").length > url.split("(").length) {
    url = url.slice(0, -1).replace(TRAILING_PUNCTUATION_PATTERN, "");
  }
  return url;
}

/**
 * Splits a description into plain text and the web addresses written in it
 */
function splitDescriptionLinks(text: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let end = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = trimUrl(match[0]);
    if (start > end) parts.push({ text: text.slice(end, start) });
    parts.push({ text: url, url });
    end = start + url.length;
  }
  if (end < text.length) parts.push({ text: text.slice(end) });
  return parts;
}

/**
 * The web addresses written in a description, each once, in order. Notion
 * lists them with the event's links.
 */
export function findDescriptionUrls(description: string | undefined): string[] {
  if (!description) return [];
  const urls = splitDescriptionLinks(description).flatMap((part) =>
    part.url ? [part.url] : [],
  );
  return Array.from(new Set(urls));
}

/**
 * The event's notes. At rest they read as text whose web addresses are
 * links, or a muted "Description"; clicking turns them into an editor that
 * is three lines tall and grows with the text. Typing updates the event as
 * it goes, Escape puts back the text from before, blur keeps it. It has no
 * icon: the text starts on the panel's left column.
 */
export function EventDetailDescription<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const description = event.description ?? "";

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  /** Set by Escape so the blur that follows doesn't commit */
  const escapePressedRef = React.useRef(false);
  /** Description when editing started, put back on Escape */
  const descriptionOnFocusRef = React.useRef(description);

  const [isEditing, setIsEditing] = React.useState(false);
  const [text, setText] = React.useState(description);

  // Follow the event while the description isn't being typed into
  React.useEffect(() => {
    setText(description);
  }, [description]);

  // Open the editor with the caret after the text
  React.useLayoutEffect(() => {
    if (!isEditing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [isEditing]);

  // Grow the editor with its text; `rows` keeps it three lines tall at least
  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const border = textarea.offsetHeight - textarea.clientHeight;
    textarea.style.height = `${textarea.scrollHeight + border}px`;
  }, [text, isEditing]);

  const updateDescription = React.useCallback(
    (next: string) => {
      onEventChange?.({
        ...event,
        description: next === "" ? undefined : next,
      });
    },
    [event, onEventChange],
  );

  const startEditing = React.useCallback(() => {
    if (!onEventChange) return;
    descriptionOnFocusRef.current = description;
    setIsEditing(true);
  }, [description, onEventChange]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      updateDescription(e.target.value);
    },
    [updateDescription],
  );

  const handleBlur = React.useCallback(() => {
    setIsEditing(false);
    if (escapePressedRef.current) {
      escapePressedRef.current = false;
      return;
    }
    if (text !== description) updateDescription(text);
  }, [description, text, updateDescription]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Escape") return;
      // Keep the calendar's Escape from deselecting the event
      e.preventDefault();
      e.stopPropagation();
      escapePressedRef.current = true;
      const original = descriptionOnFocusRef.current;
      setText(original);
      if (original !== description) updateDescription(original);
      textareaRef.current?.blur();
    },
    [description, updateDescription],
  );

  // Focus that lands on the box itself (a click or Tab), not on a link in it
  const handleBoxFocus = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      startEditing();
    },
    [startEditing],
  );

  if (isEditing) {
    return (
      <EventDetailSection name="description">
        <textarea
          ref={textareaRef}
          rows={DESCRIPTION_MIN_LINES}
          value={text}
          placeholder="Description"
          aria-label="Description"
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            DESCRIPTION_BOX_CLASS,
            EVENT_DETAIL_INPUT_CLASS,
            EVENT_DETAIL_TEXT_CLASS,
            "resize-none overflow-hidden placeholder:text-[#ABABA9] dark:placeholder:text-[#595959]",
          )}
        />
      </EventDetailSection>
    );
  }

  const isEditable = Boolean(onEventChange);

  return (
    <EventDetailSection name="description">
      <div
        role={isEditable ? "textbox" : undefined}
        aria-multiline={isEditable ? true : undefined}
        aria-label={isEditable ? "Description" : undefined}
        tabIndex={isEditable ? 0 : undefined}
        onFocus={handleBoxFocus}
        className={cn(
          DESCRIPTION_BOX_CLASS,
          "border-transparent",
          isEditable && cn(EVENT_DETAIL_HOVER_BORDER_CLASS, "cursor-text"),
        )}
      >
        {description ? (
          <span className={EVENT_DETAIL_TEXT_CLASS}>
            {splitDescriptionLinks(description).map((part, index) =>
              part.url ? (
                <a
                  key={index}
                  href={part.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(EVENT_DETAIL_LINK_CLASS, "cursor-pointer")}
                >
                  {part.text}
                </a>
              ) : (
                <React.Fragment key={index}>{part.text}</React.Fragment>
              ),
            )}
          </span>
        ) : (
          <span className={EVENT_DETAIL_PLACEHOLDER_CLASS}>Description</span>
        )}
      </div>
    </EventDetailSection>
  );
}
