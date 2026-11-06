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

/** Sets a textarea's height to fit its text; its `rows` keep the minimum */
function fitToText(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const border = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${textarea.scrollHeight + border}px`;
}

/**
 * The description at rest: its text, with each web address a link, or a
 * muted "Description" when there's none
 */
function DescriptionText({ description }: { description: string }) {
  if (!description) {
    return <span className={EVENT_DETAIL_PLACEHOLDER_CLASS}>Description</span>;
  }

  return (
    <span className={EVENT_DETAIL_TEXT_CLASS}>
      {splitDescriptionLinks(description).map((part, index) => {
        if (!part.url) {
          return <React.Fragment key={index}>{part.text}</React.Fragment>;
        }
        return (
          <a
            key={index}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(EVENT_DETAIL_LINK_CLASS, "cursor-pointer")}
          >
            {part.text}
          </a>
        );
      })}
    </span>
  );
}

/**
 * The event's notes. At rest they read as text whose web addresses are
 * links, or a muted "Description"; clicking (anywhere but a link) or Tab
 * turns them into an editor that is three lines tall and grows with the
 * text. Blur keeps the edit and Escape puts back the text from before. It
 * has no icon: the text starts on the panel's left column.
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
  /**
   * Set while a press is on the box: its focus waits for the click, which
   * knows whether a link was pressed. Safari focuses the box, not the link.
   */
  const isPressingRef = React.useRef(false);

  const [isEditing, setIsEditing] = React.useState(false);
  const [text, setText] = React.useState(description);

  // Follow the event while the description isn't being typed into
  React.useEffect(() => {
    if (isEditing) return;
    setText(description);
  }, [description, isEditing]);

  // Open the editor with the caret after the text
  React.useLayoutEffect(() => {
    if (!isEditing) return;
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }, [isEditing]);

  // Grow the editor with its text
  React.useLayoutEffect(() => {
    if (textareaRef.current) fitToText(textareaRef.current);
  }, [text, isEditing]);

  // Fit it again when a new panel width rewraps the text
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!isEditing || !textarea) return;
    let width = textarea.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (textarea.offsetWidth === width) return;
      width = textarea.offsetWidth;
      fitToText(textarea);
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, [isEditing]);

  const startEditing = React.useCallback(() => {
    if (!onEventChange) return;
    descriptionOnFocusRef.current = description;
    setIsEditing(true);
  }, [description, onEventChange]);

  // The event takes the text on blur, so an address being typed doesn't
  // show up in the links list one letter at a time
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value),
    [],
  );

  const handleBlur = React.useCallback(() => {
    setIsEditing(false);
    if (escapePressedRef.current) {
      escapePressedRef.current = false;
      return;
    }
    if (text === description) return;
    onEventChange?.({ ...event, description: text === "" ? undefined : text });
  }, [description, event, onEventChange, text]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Escape") return;
      // Keep the calendar's Escape from deselecting the event
      e.preventDefault();
      e.stopPropagation();
      escapePressedRef.current = true;
      setText(descriptionOnFocusRef.current);
      textareaRef.current?.blur();
    },
    [],
  );

  const handleBoxPointerDown = React.useCallback(() => {
    isPressingRef.current = true;
  }, []);

  // Tab onto the box opens the editor; a press leaves that to its click
  const handleBoxFocus = React.useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const isPress = isPressingRef.current;
      isPressingRef.current = false;
      if (isPress || e.target !== e.currentTarget) return;
      startEditing();
    },
    [startEditing],
  );

  const handleBoxBlur = React.useCallback(() => {
    isPressingRef.current = false;
  }, []);

  // A click opens the editor, unless it's on a link in the text
  const handleBoxClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      isPressingRef.current = false;
      if (e.target instanceof Element && e.target.closest("a")) return;
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

  if (!onEventChange) {
    return (
      <EventDetailSection name="description">
        <div className={cn(DESCRIPTION_BOX_CLASS, "border-transparent")}>
          <DescriptionText description={description} />
        </div>
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="description">
      <div
        role="textbox"
        aria-multiline
        aria-label="Description"
        tabIndex={0}
        onPointerDown={handleBoxPointerDown}
        onFocus={handleBoxFocus}
        onBlur={handleBoxBlur}
        onClick={handleBoxClick}
        className={cn(
          DESCRIPTION_BOX_CLASS,
          "cursor-text border-transparent",
          EVENT_DETAIL_HOVER_BORDER_CLASS,
        )}
      >
        <DescriptionText description={description} />
      </div>
    </EventDetailSection>
  );
}
