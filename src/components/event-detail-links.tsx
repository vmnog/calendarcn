"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react-dom";
import {
  Check,
  CircleHelp,
  Copy,
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link,
  Paperclip,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  EVENT_DETAIL_LINK_CLASS,
  findDescriptionUrls,
} from "./event-detail-description";
import {
  EVENT_DETAIL_GROUPED_INPUT_CLASS,
  EVENT_DETAIL_HOVER_BORDER_CLASS,
  EVENT_DETAIL_ICON_CLASS,
  EVENT_DETAIL_INPUT_GROUP_CLASS,
  EVENT_DETAIL_MENU_CLASS,
  EVENT_DETAIL_PLACEHOLDER_CLASS,
  EVENT_DETAIL_SECONDARY_CLASS,
  EVENT_DETAIL_TEXT_CLASS,
  EventDetailPlaceholderRow,
  EventDetailSection,
} from "./event-detail-parts";
import type {
  DetailedCalendarEvent,
  EventAttachment,
  EventDetailSectionProps,
} from "./week-view-types";

/** How long the pointer rests on a link before its address shows, in ms */
const TOOLTIP_OPEN_DELAY = 500;

/** Time to move the pointer from a row onto its tooltip, in ms */
const TOOLTIP_CLOSE_DELAY = 120;

/** How long the copy button shows its check mark, in ms */
const COPIED_FEEDBACK_DURATION = 1500;

/** Gap between a link row and the tooltip above it, in px */
const LINK_TOOLTIP_OFFSET = 10;

/** Gap between the "?" of a description link and its tooltip, in px */
const HELP_TOOLTIP_OFFSET = 6;

/** Gap between the panel's left edge and the add-link menu, in px */
const ADD_LINK_MENU_OFFSET = 8;

/** Closest a floating layer comes to the window's edges, in px */
const VIEWPORT_PADDING = 8;

/** A domain typed without a scheme, e.g. "example.com/notes" */
const BARE_DOMAIN_PATTERN = /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/;

/** Floating layers sit above the panel and every calendar layer */
const FLOATING_LAYER_Z_CLASS = "z-[9999]";

/** Schemes a link may open: web pages, never script or inline data */
const LINK_PROTOCOLS = ["http:", "https:"];

/** A file can also open from the object URL made when it was attached here */
const ATTACHMENT_PROTOCOLS = [...LINK_PROTOCOLS, "blob:"];

/** Base a relative address resolves against while its scheme is checked */
const RELATIVE_URL_BASE = "https://relative.invalid";

/** Elements Tab can stop at, before checking they're shown */
const TABBABLE_SELECTOR =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A row of the list: Notion's 32px box, 8px in from the panel's edges, in
 * a 35px row, with its icon centered 26px from the edge and its text from
 * 45px like the panel's other rows
 */
const LINK_ROW_CLASS =
  "mx-2 my-[1.5px] flex min-h-8 items-center gap-[11px] border border-transparent pr-[7px] pl-[9px]";

/** The add row without an icon: its box starts 8px before the text column */
const INDENTED_ROW_CLASS =
  "my-[1.5px] mr-2 ml-[36px] flex min-h-8 items-center border pr-[7px] pl-2";

/** Text of an action control that turns to the panel's text color on hover */
const HOVER_TEXT_CLASS =
  "text-[#929292] hover:text-[#32302C] dark:text-[#7F7F7F] dark:hover:text-[#D4D4D4]";

/**
 * A row's end controls (remove, "?"): shown while the row is hovered or
 * focused, and always where nothing can hover
 */
const ROW_ACTION_CLASS =
  "opacity-0 group-focus-within/link:opacity-100 group-hover/link:opacity-100 [@media(hover:none)]:opacity-100";

/** Tooltips are dark in both themes, like Notion's */
const TOOLTIP_CLASS =
  "rounded-md border border-[#303030] bg-[#252525] px-2.5 py-1.5 text-sm leading-5 font-medium text-white shadow-md";

/** A menu option; the highlighted one gets `MENU_OPTION_ACTIVE_CLASS` */
const MENU_OPTION_CLASS =
  "flex w-full cursor-default gap-[9px] rounded-sm px-2 py-1.5 text-left text-sm leading-5 font-medium text-[#E1E1E1]";

/** The highlighted menu option: by pointer, arrow keys, or a typed link */
const MENU_OPTION_ACTIVE_CLASS = "bg-[#303030] text-white";

/**
 * What the add-link menu offers: the typed link, or a file from the
 * computer while nothing is typed
 */
type AddLinkOption = { kind: "link"; url: string } | { kind: "attach" };

/**
 * The address typed text links to ("https://..." or a bare domain), or
 * null when it isn't one: Notion only adds links
 */
function parseLinkInput(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "" || /\s/.test(trimmed)) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    if (!BARE_DOMAIN_PATTERN.test(trimmed)) return null;
    candidate = `https://${trimmed}`;
  }

  try {
    const { hostname } = new URL(candidate);
    return hostname.includes(".") || hostname === "localhost"
      ? candidate
      : null;
  } catch {
    return null;
  }
}

/**
 * `url` when it opens with one of `protocols`, else undefined. Links and
 * files come in with the event, so a `javascript:` or `data:` address must
 * never reach an `href`. A relative address keeps the page's own scheme.
 */
function safeHref(
  url: string,
  protocols: readonly string[] = LINK_PROTOCOLS,
): string | undefined {
  try {
    const { protocol } = new URL(url, RELATIVE_URL_BASE);
    return protocols.includes(protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Focuses what Tab reaches after `element`, skipping `layer`: Tab out of a
 * layer portaled away from the element it opened from
 */
function focusNextTabbable(element: HTMLElement, layer: HTMLElement | null) {
  const tabbables = Array.from(
    element.ownerDocument.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR),
  ).filter(
    (candidate) =>
      candidate.tabIndex >= 0 &&
      !layer?.contains(candidate) &&
      !candidate.closest("[inert]") &&
      candidate.getClientRects().length > 0,
  );
  tabbables[tabbables.indexOf(element) + 1]?.focus();
}

/** File size the way Finder writes it: "248 KB", "1.2 MB" */
function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1000;
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }
  return `${size < 10 ? size.toFixed(1) : Math.round(size)} ${units[unit]}`;
}

/** Kind of file an attachment is, from its MIME type */
type FileKind = "image" | "video" | "audio" | "sheet" | "archive" | "text";

/** Kind of file a MIME type names, or null for any other file */
function fileKind(type: string | undefined): FileKind | null {
  if (!type) return null;
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type.includes("spreadsheet") || type.includes("csv")) return "sheet";
  if (/zip|compressed|tar|rar|7z/.test(type)) return "archive";
  if (type === "application/pdf" || type.startsWith("text/")) return "text";
  if (type.includes("document") || type.includes("msword")) return "text";
  return null;
}

/** Icon for each kind of file */
const FILE_KIND_ICONS: Record<FileKind, LucideIcon> = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  sheet: FileSpreadsheet,
  archive: FileArchive,
  text: FileText,
};

/** An attached file's icon, picked by its MIME type */
function FileTypeIcon({ type }: { type: string | undefined }) {
  const kind = fileKind(type);
  return React.createElement(kind ? FILE_KIND_ICONS[kind] : File, {
    className: EVENT_DETAIL_ICON_CLASS,
  });
}

/**
 * Where a floating layer of `element` mounts: inside the dialog, sheet or
 * drawer holding the panel (a modal turns off pointer events on the rest of
 * the page), else the body. The details popover doesn't count: its own
 * bounds would clip a menu beside it, and the body works there.
 */
function floatingRoot(element: Element): HTMLElement {
  return (
    element.closest<HTMLElement>(
      '[role="dialog"]:not([data-calendar-popover]), [role="alertdialog"]',
    ) ?? element.ownerDocument.body
  );
}

/**
 * Open state of a tooltip that shows after the pointer rests on its
 * trigger, and stays while the pointer moves onto it
 */
function useHoverTooltip() {
  const [isOpen, setIsOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  React.useEffect(() => clearTimer, [clearTimer]);

  /** The pointer entered the trigger */
  const scheduleOpen = React.useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(
      () => setIsOpen(true),
      TOOLTIP_OPEN_DELAY,
    );
  }, [clearTimer]);

  /** The pointer left the trigger or the tooltip */
  const scheduleClose = React.useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(
      () => setIsOpen(false),
      TOOLTIP_CLOSE_DELAY,
    );
  }, [clearTimer]);

  /** The pointer reached the tooltip before it closed */
  const keepOpen = clearTimer;

  return { isOpen, scheduleOpen, scheduleClose, keepOpen };
}

/**
 * Props for FloatingLayer
 */
interface FloatingLayerProps extends React.ComponentProps<"div"> {
  /** Element the layer belongs to, which picks where it mounts */
  owner: Element;
}

/**
 * A layer portaled out of the panel. `data-calendar-popover` tells the
 * calendar a press here is inside the event details, so it doesn't close
 * or deselect them.
 */
function FloatingLayer({ owner, className, ...props }: FloatingLayerProps) {
  return createPortal(
    <div
      data-calendar-popover=""
      className={cn(FLOATING_LAYER_Z_CLASS, className)}
      {...props}
    />,
    floatingRoot(owner),
  );
}

/**
 * Props for HelpTooltipIcon
 */
interface HelpTooltipIconProps {
  /** What the tooltip says */
  label: string;
  /** Called when the pointer enters (true) or leaves (false) the "?" */
  onHoverChange?: (isHovered: boolean) => void;
}

/**
 * A "?" that explains itself in a dark tooltip above it, flush with its
 * right edge
 */
function HelpTooltipIcon({ label, onHoverChange }: HelpTooltipIconProps) {
  const [iconElement, setIconElement] = React.useState<HTMLElement | null>(
    null,
  );
  const tooltip = useHoverTooltip();
  const { refs, floatingStyles } = useFloating({
    open: tooltip.isOpen,
    placement: "top-end",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(HELP_TOOLTIP_OFFSET),
      shift({ padding: VIEWPORT_PADDING }),
    ],
  });

  const setIcon = React.useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node);
      setIconElement(node);
    },
    [refs],
  );

  const setTooltip = React.useCallback(
    (node: HTMLElement | null) => refs.setFloating(node),
    [refs],
  );

  return (
    <span
      ref={setIcon}
      role="img"
      aria-label={label}
      className={cn(
        "-mr-1 flex size-6 shrink-0 items-center justify-center",
        EVENT_DETAIL_TEXT_CLASS,
      )}
      onMouseEnter={() => {
        tooltip.scheduleOpen();
        onHoverChange?.(true);
      }}
      onMouseLeave={() => {
        tooltip.scheduleClose();
        onHoverChange?.(false);
      }}
    >
      <CircleHelp className="size-4" strokeWidth={1.5} />
      {tooltip.isOpen && iconElement && (
        <FloatingLayer
          ref={setTooltip}
          owner={iconElement}
          role="tooltip"
          style={floatingStyles}
          className={cn(TOOLTIP_CLASS, "pointer-events-none whitespace-nowrap")}
        >
          {label}
        </FloatingLayer>
      )}
    </span>
  );
}

/**
 * Props for LinkTooltip
 */
interface LinkTooltipProps {
  url: string;
  /** Row the tooltip is centered above */
  owner: Element;
  /**
   * The row's link. Tab from it reaches the copy button; Shift+Tab and
   * Escape go back to it, and Tab moves on to what follows it.
   */
  link: HTMLElement | null;
  floatingRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  /** Focus left the copy button for somewhere other than the link */
  onFocusLeave: () => void;
}

/**
 * The link's address with a copy button, in a dark tooltip above its row
 */
function LinkTooltip({
  url,
  owner,
  link,
  floatingRef,
  style,
  onMouseEnter,
  onMouseLeave,
  onFocusLeave,
}: LinkTooltipProps) {
  const [layerElement, setLayerElement] = React.useState<HTMLElement | null>(
    null,
  );
  const [isCopied, setIsCopied] = React.useState(false);

  React.useEffect(() => {
    if (!isCopied) return;
    const timer = window.setTimeout(
      () => setIsCopied(false),
      COPIED_FEEDBACK_DURATION,
    );
    return () => window.clearTimeout(timer);
  }, [isCopied]);

  const setLayer = React.useCallback(
    (node: HTMLElement | null) => {
      floatingRef(node);
      setLayerElement(node);
    },
    [floatingRef],
  );

  const copyUrl = React.useCallback(() => {
    // A denied permission or an insecure page leaves the button as it was
    navigator.clipboard
      ?.writeText(url)
      .then(() => setIsCopied(true))
      .catch(() => {});
  }, [url]);

  // The layer is portaled away from the row, so Tab is routed by hand
  const handleCopyKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (!link) return;
      if (e.key === "Escape" || (e.key === "Tab" && e.shiftKey)) {
        // Keep the calendar's Escape from deselecting the event
        e.preventDefault();
        e.stopPropagation();
        link.focus();
        return;
      }
      if (e.key !== "Tab") return;
      e.preventDefault();
      focusNextTabbable(link, layerElement);
    },
    [layerElement, link],
  );

  const handleCopyBlur = React.useCallback(
    (e: React.FocusEvent<HTMLButtonElement>) => {
      if (link && e.relatedTarget === link) return;
      onFocusLeave();
    },
    [link, onFocusLeave],
  );

  return (
    <FloatingLayer
      ref={setLayer}
      owner={owner}
      role="tooltip"
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn(TOOLTIP_CLASS, "flex max-w-[280px] items-center gap-2")}
    >
      <span className="truncate">{url}</span>
      <button
        type="button"
        aria-label={isCopied ? "Link copied" : "Copy link"}
        onClick={copyUrl}
        onKeyDown={handleCopyKeyDown}
        onBlur={handleCopyBlur}
        className="flex size-4 shrink-0 items-center justify-center rounded-sm text-[#9B9B9B] outline-none hover:text-white focus-visible:text-white focus-visible:ring-1 focus-visible:ring-white/60"
      >
        {isCopied ? (
          <Check className="size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </FloatingLayer>
  );
}

/**
 * Props for LinkRow
 */
interface LinkRowProps {
  url: string;
  /** Text shown for the link: its title, or the address */
  label: string;
  /** Removes the link; leave out when it can't be removed here */
  onRemove?: () => void;
  /**
   * Whether the link comes from the description: a "?" explains that
   * instead of a remove button
   */
  isFromDescription?: boolean;
}

/**
 * A link: icon and underlined text that opens it. Hovering shows the
 * address above the row, and a remove button (or a "?" for a link written
 * in the description) at its end; Tab onto the link shows the address too.
 * An address that isn't a web page shows as text that opens nothing.
 */
function LinkRow({ url, label, onRemove, isFromDescription }: LinkRowProps) {
  const href = safeHref(url);

  const [rowElement, setRowElement] = React.useState<HTMLElement | null>(null);
  const [linkElement, setLinkElement] =
    React.useState<HTMLAnchorElement | null>(null);
  /** The "?" shows its own tooltip, in place of the address */
  const [isHelpHovered, setIsHelpHovered] = React.useState(false);
  /** The link or the tooltip's copy button has keyboard focus */
  const [hasKeyboardFocus, setHasKeyboardFocus] = React.useState(false);
  const tooltip = useHoverTooltip();
  const isTooltipOpen = tooltip.isOpen || hasKeyboardFocus;
  const { refs, floatingStyles } = useFloating({
    open: isTooltipOpen,
    placement: "top",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(LINK_TOOLTIP_OFFSET),
      shift({ padding: VIEWPORT_PADDING }),
    ],
  });

  const setRow = React.useCallback(
    (node: HTMLElement | null) => {
      refs.setReference(node);
      setRowElement(node);
    },
    [refs],
  );

  const setTooltip = React.useCallback(
    (node: HTMLElement | null) => refs.setFloating(node),
    [refs],
  );

  const handleLinkFocus = React.useCallback(
    (e: React.FocusEvent<HTMLAnchorElement>) => {
      if (e.currentTarget.matches(":focus-visible")) setHasKeyboardFocus(true);
    },
    [],
  );

  // Moving on to the tooltip's copy button keeps it open
  const handleLinkBlur = React.useCallback(
    (e: React.FocusEvent<HTMLAnchorElement>) => {
      const next = e.relatedTarget;
      if (next instanceof Node && refs.floating.current?.contains(next)) {
        return;
      }
      setHasKeyboardFocus(false);
    },
    [refs],
  );

  // Tab goes from the link into its tooltip, which is portaled elsewhere
  const handleLinkKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLAnchorElement>) => {
      if (e.key !== "Tab" || e.shiftKey || !hasKeyboardFocus) return;
      const layer = refs.floating.current;
      const copyButton = layer?.querySelector("button");
      if (!copyButton) return;
      e.preventDefault();
      copyButton.focus();
    },
    [hasKeyboardFocus, refs],
  );

  const handleTooltipFocusLeave = React.useCallback(
    () => setHasKeyboardFocus(false),
    [],
  );

  return (
    <div
      ref={setRow}
      data-link-url={url}
      className={cn(LINK_ROW_CLASS, "group/link")}
      onMouseEnter={tooltip.scheduleOpen}
      onMouseLeave={tooltip.scheduleClose}
    >
      <span className="flex w-4 shrink-0 items-center justify-center">
        <Link className={EVENT_DETAIL_ICON_CLASS} />
      </span>
      <a
        ref={setLinkElement}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onFocus={handleLinkFocus}
        onBlur={handleLinkBlur}
        onKeyDown={handleLinkKeyDown}
        className={cn(
          "min-w-0 truncate",
          EVENT_DETAIL_TEXT_CLASS,
          href && EVENT_DETAIL_LINK_CLASS,
        )}
      >
        {label}
      </a>
      <span
        className={cn("ml-auto flex shrink-0 items-center", ROW_ACTION_CLASS)}
      >
        {isFromDescription && (
          <HelpTooltipIcon
            label="Linked in event description"
            onHoverChange={setIsHelpHovered}
          />
        )}
        {!isFromDescription && onRemove && (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={onRemove}
            className={cn(
              "-mr-1.5 flex size-6 items-center justify-center",
              HOVER_TEXT_CLASS,
            )}
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        )}
      </span>
      {isTooltipOpen && !isHelpHovered && rowElement && (
        <LinkTooltip
          url={url}
          owner={rowElement}
          link={linkElement}
          floatingRef={setTooltip}
          style={floatingStyles}
          onMouseEnter={tooltip.keepOpen}
          onMouseLeave={tooltip.scheduleClose}
          onFocusLeave={handleTooltipFocusLeave}
        />
      )}
    </div>
  );
}

/**
 * Props for AttachmentRow
 */
interface AttachmentRowProps {
  attachment: EventAttachment;
  /** Removes the file; leave out for read-only details */
  onRemove?: () => void;
}

/**
 * An attached file: its type's icon, its name (opening the file), its size
 * muted after it, and a remove button on hover. A file whose address isn't
 * a web page or an object URL shows its name only.
 */
function AttachmentRow({ attachment, onRemove }: AttachmentRowProps) {
  const href = safeHref(attachment.url, ATTACHMENT_PROTOCOLS);

  return (
    <div
      data-attachment-name={attachment.name}
      className={cn(LINK_ROW_CLASS, "group/link")}
    >
      <span className="flex w-4 shrink-0 items-center justify-center">
        <FileTypeIcon type={attachment.type} />
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        download={href?.startsWith("blob:") ? attachment.name : undefined}
        className={cn(
          "min-w-0 truncate",
          EVENT_DETAIL_TEXT_CLASS,
          href && EVENT_DETAIL_LINK_CLASS,
        )}
      >
        {attachment.name}
      </a>
      {attachment.size !== undefined && (
        <span className={cn("shrink-0", EVENT_DETAIL_SECONDARY_CLASS)}>
          {formatFileSize(attachment.size)}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${attachment.name}`}
          onClick={onRemove}
          className={cn(
            "-mr-1.5 ml-auto flex size-6 shrink-0 items-center justify-center",
            HOVER_TEXT_CLASS,
            ROW_ACTION_CLASS,
          )}
        >
          <X className="size-5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}

/**
 * Props for AddLinkMenu
 */
interface AddLinkMenuProps {
  id: string;
  /** The add row, whose top the menu lines up with */
  owner: HTMLElement;
  options: AddLinkOption[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onChoose: (option: AddLinkOption) => void;
}

/**
 * Notion's add-link menu: to the left of the panel, its top level with the
 * input. It offers the typed link, or a file while nothing is typed. It
 * never takes focus from the input: the input drives it with the arrow keys
 * and Enter.
 */
function AddLinkMenu({
  id,
  owner,
  options,
  activeIndex,
  onActiveIndexChange,
  onChoose,
}: AddLinkMenuProps) {
  const { refs, floatingStyles } = useFloating({
    open: true,
    placement: "left-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(ADD_LINK_MENU_OFFSET),
      flip({ fallbackPlacements: ["bottom-start"] }),
      shift({ padding: VIEWPORT_PADDING }),
    ],
  });

  const setMenu = React.useCallback(
    (node: HTMLElement | null) => refs.setFloating(node),
    [refs],
  );

  // Measure from the panel's left edge, at the input's height
  React.useLayoutEffect(() => {
    const edge = owner.closest("[data-section]") ?? owner;
    refs.setReference({
      contextElement: owner,
      getBoundingClientRect() {
        const box = owner.getBoundingClientRect();
        const left = edge.getBoundingClientRect().left;
        return {
          x: left,
          y: box.top,
          left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.right - left,
          height: box.height,
        };
      },
    });
  }, [owner, refs]);

  const isLinkMenu = options.some((option) => option.kind === "link");

  return (
    <FloatingLayer
      ref={setMenu}
      owner={owner}
      style={floatingStyles}
      // Keep the input focused while an option is pressed
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "rounded-md border p-1 shadow-md",
        EVENT_DETAIL_MENU_CLASS,
        isLinkMenu ? "w-[260px]" : "w-60",
      )}
    >
      <div id={id} role="listbox" aria-label="Add links and attachments">
        {options.map((option, index) => (
          <div
            key={option.kind}
            id={`${id}-${option.kind}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => onActiveIndexChange(index)}
            onMouseLeave={() => onActiveIndexChange(-1)}
            onClick={() => onChoose(option)}
            className={cn(
              MENU_OPTION_CLASS,
              index === activeIndex && MENU_OPTION_ACTIVE_CLASS,
            )}
          >
            {option.kind === "link" ? (
              <>
                <Link className="size-4 shrink-0 text-[#656565]" />
                <span className="truncate">{option.url}</span>
              </>
            ) : (
              <>
                <Paperclip className="mt-px size-4 shrink-0" />
                <span className="flex flex-col gap-[3px]">
                  <span>Attach file</span>
                  <span className="text-[#8A8A8A]">
                    Upload from your computer
                  </span>
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </FloatingLayer>
  );
}

/**
 * Props for AddLinkRow
 */
interface AddLinkRowProps {
  /** Whether the row leads with the link icon: only while the list is empty */
  hasIcon: boolean;
  onAddLink: (url: string) => void;
  onAttachFiles: (files: File[]) => void;
}

/**
 * The muted "Add links and attachments" row. Clicking turns it into a
 * "Paste link..." input with Notion's menu beside the panel: Enter adds a
 * typed link, and with nothing typed the menu attaches a file instead.
 * Text that isn't a link is dropped. Escape closes the menu, then the input.
 */
function AddLinkRow({ hasIcon, onAddLink, onAttachFiles }: AddLinkRowProps) {
  const menuId = React.useId();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  /**
   * Set when the typed text was already handled (added, dropped or Escaped)
   * so the blur that follows does nothing more
   */
  const isHandledRef = React.useRef(false);

  const [rowElement, setRowElement] = React.useState<HTMLDivElement | null>(
    null,
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const [text, setText] = React.useState("");
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  /** Option under the pointer or picked with the arrow keys; -1 for none */
  const [activeIndex, setActiveIndex] = React.useState(-1);
  /** Right after a link is added the row reads "Paste link...", as Notion's */
  const [hasJustAdded, setHasJustAdded] = React.useState(false);

  React.useLayoutEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const typedUrl = parseLinkInput(text);
  const options = React.useMemo<AddLinkOption[]>(() => {
    if (text.trim() === "") return [{ kind: "attach" }];
    if (typedUrl) return [{ kind: "link", url: typedUrl }];
    return [];
  }, [text, typedUrl]);
  // A typed link is picked as soon as it's recognized
  const highlightedIndex = typedUrl ? 0 : activeIndex;
  const highlighted = options[highlightedIndex];

  /** Leaves the input, after its text was handled */
  const finish = React.useCallback(() => {
    isHandledRef.current = true;
    setText("");
    inputRef.current?.blur();
  }, []);

  const choose = React.useCallback(
    (option: AddLinkOption) => {
      if (option.kind === "attach") {
        fileInputRef.current?.click();
        return;
      }
      onAddLink(option.url);
      setHasJustAdded(true);
      finish();
    },
    [finish, onAddLink],
  );

  const handleFocus = React.useCallback(() => {
    setIsMenuOpen(true);
    setActiveIndex(-1);
  }, []);

  const handleBlur = React.useCallback(() => {
    setIsEditing(false);
    setIsMenuOpen(false);
    if (isHandledRef.current) {
      isHandledRef.current = false;
      return;
    }
    // Leaving the input keeps a typed link, like the other fields' blur
    setHasJustAdded(false);
    setText("");
    if (typedUrl) {
      onAddLink(typedUrl);
      setHasJustAdded(true);
    }
  }, [onAddLink, typedUrl]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setText(e.target.value);
      setIsMenuOpen(true);
      setActiveIndex(-1);
    },
    [],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        if (options.length === 0) return;
        e.preventDefault();
        setIsMenuOpen(true);
        const step = e.key === "ArrowDown" ? 1 : -1;
        // From no option, Down picks the first and Up the last
        const from = highlightedIndex < 0 && step < 0 ? 0 : highlightedIndex;
        const next = from + step;
        setActiveIndex(
          ((next % options.length) + options.length) % options.length,
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (isMenuOpen && highlighted) {
          choose(highlighted);
          return;
        }
        // Notion drops text that isn't a link
        if (text.trim() !== "") {
          setHasJustAdded(false);
          finish();
        }
        return;
      }
      if (e.key !== "Escape") return;
      // Keep the calendar's Escape from deselecting the event
      e.preventDefault();
      e.stopPropagation();
      if (isMenuOpen && options.length > 0) {
        setIsMenuOpen(false);
        return;
      }
      setHasJustAdded(false);
      finish();
    },
    [choose, finish, highlighted, highlightedIndex, isMenuOpen, options, text],
  );

  const handleFilesPicked = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (files.length === 0) return;
      onAttachFiles(files);
    },
    [onAttachFiles],
  );

  const rowClass = hasIcon ? LINK_ROW_CLASS : INDENTED_ROW_CLASS;
  const icon = hasIcon && (
    <span className="flex w-4 shrink-0 items-center justify-center">
      <Link className={EVENT_DETAIL_ICON_CLASS} />
    </span>
  );
  const isMenuShown = isEditing && isMenuOpen && options.length > 0;

  return (
    <>
      {isEditing ? (
        <div
          ref={setRowElement}
          className={cn(rowClass, EVENT_DETAIL_INPUT_GROUP_CLASS)}
          onClick={() => inputRef.current?.focus()}
        >
          {icon}
          <input
            ref={inputRef}
            value={text}
            placeholder="Paste link..."
            aria-label="Paste link"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isMenuShown}
            aria-controls={isMenuShown ? menuId : undefined}
            aria-activedescendant={
              isMenuShown && highlighted
                ? `${menuId}-${highlighted.kind}`
                : undefined
            }
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              EVENT_DETAIL_GROUPED_INPUT_CLASS,
              EVENT_DETAIL_TEXT_CLASS,
              "min-w-0 flex-1 placeholder:text-[#ABABA9] dark:placeholder:text-[#595959]",
            )}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className={cn(rowClass, EVENT_DETAIL_HOVER_BORDER_CLASS, "text-left")}
        >
          {icon}
          <span className={EVENT_DETAIL_PLACEHOLDER_CLASS}>
            {hasJustAdded ? "Paste link..." : "Add links and attachments"}
          </span>
        </button>
      )}
      {isMenuShown && rowElement && (
        <AddLinkMenu
          id={menuId}
          owner={rowElement}
          options={options}
          activeIndex={highlightedIndex}
          onActiveIndexChange={setActiveIndex}
          onChoose={choose}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        aria-label="Attach file"
        onChange={handleFilesPicked}
      />
    </>
  );
}

/**
 * The event's links and attached files, then the links written in its
 * description (marked with a "?"), then the row that adds more. With none,
 * it's the muted "Add links and attachments" row alone. Files are kept as
 * name, size and type with an object URL; nothing is uploaded.
 */
export function EventDetailLinks<
  TEvent extends DetailedCalendarEvent = DetailedCalendarEvent,
>({ event, onEventChange }: EventDetailSectionProps<TEvent>) {
  const links = React.useMemo(() => event.links ?? [], [event.links]);
  const attachments = React.useMemo(
    () => event.attachments ?? [],
    [event.attachments],
  );
  const descriptionUrls = React.useMemo(() => {
    const linked = new Set(links.map((link) => link.url));
    return findDescriptionUrls(event.description).filter(
      (url) => !linked.has(url),
    );
  }, [event.description, links]);

  const addLink = React.useCallback(
    (url: string) => {
      if (links.some((link) => link.url === url)) return;
      onEventChange?.({ ...event, links: [...links, { url }] });
    },
    [event, links, onEventChange],
  );

  const removeLink = React.useCallback(
    (index: number) => {
      onEventChange?.({ ...event, links: links.filter((_, i) => i !== index) });
    },
    [event, links, onEventChange],
  );

  const attachFiles = React.useCallback(
    (files: File[]) => {
      const added = files.map<EventAttachment>((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
        size: file.size,
        type: file.type || undefined,
      }));
      onEventChange?.({ ...event, attachments: [...attachments, ...added] });
    },
    [attachments, event, onEventChange],
  );

  const removeAttachment = React.useCallback(
    (index: number) => {
      const removed = attachments[index];
      if (removed?.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
      onEventChange?.({
        ...event,
        attachments: attachments.filter((_, i) => i !== index),
      });
    },
    [attachments, event, onEventChange],
  );

  const isEmpty =
    links.length === 0 &&
    attachments.length === 0 &&
    descriptionUrls.length === 0;

  if (isEmpty && !onEventChange) {
    return (
      <EventDetailSection name="links">
        <EventDetailPlaceholderRow
          icon={Link}
          label="Add links and attachments"
        />
      </EventDetailSection>
    );
  }

  return (
    <EventDetailSection name="links">
      {links.map((link, index) => (
        <LinkRow
          key={`${index}-${link.url}`}
          url={link.url}
          label={link.title ?? link.url}
          onRemove={onEventChange ? () => removeLink(index) : undefined}
        />
      ))}
      {attachments.map((attachment, index) => (
        <AttachmentRow
          key={`${index}-${attachment.url}`}
          attachment={attachment}
          onRemove={onEventChange ? () => removeAttachment(index) : undefined}
        />
      ))}
      {descriptionUrls.map((url) => (
        <LinkRow key={url} url={url} label={url} isFromDescription />
      ))}
      {onEventChange && (
        <AddLinkRow
          hasIcon={isEmpty}
          onAddLink={addLink}
          onAttachFiles={attachFiles}
        />
      )}
    </EventDetailSection>
  );
}
