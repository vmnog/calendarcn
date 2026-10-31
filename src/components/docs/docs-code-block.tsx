"use client";

import { useRef } from "react";
import type { ComponentProps, HTMLAttributes, RefObject } from "react";
import { CheckIcon, ClipboardIcon } from "lucide-react";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { useCopyButton } from "fumadocs-ui/utils/use-copy-button";

import { cn } from "@/lib/utils";

/** Cross-fade between the copy and copied icons: both stay mounted, so enter and exit both animate. */
const ICON_TRANSITION_CLASS =
  "transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none";

/** Resting state of the visible icon. */
const ICON_SHOWN_CLASS = "scale-100 opacity-100 blur-[0px]";

/** Resting state of the hidden icon. */
const ICON_HIDDEN_CLASS = "scale-[0.25] opacity-0 blur-[4px]";

type DocsCodeBlockProps = ComponentProps<typeof CodeBlock>;

/**
 * Fumadocs `CodeBlock` with the docs surface (shadow ring) and a copy button
 * whose icon cross-fades instead of swapping.
 */
export function DocsCodeBlock({
  allowCopy = true,
  className,
  ...props
}: DocsCodeBlockProps) {
  const figureRef = useRef<HTMLElement>(null);
  const copyable = allowCopy !== false && allowCopy !== "false";

  return (
    <CodeBlock
      {...props}
      ref={figureRef}
      allowCopy={false}
      Actions={({ className: actionsClassName }) => (
        <div className={cn("empty:hidden", actionsClassName)}>
          {copyable && <CopyButton containerRef={figureRef} />}
        </div>
      )}
      className={cn("docs-surface", className)}
    />
  );
}

/** MDX `pre` (and `ServerCodeBlock`) renderer that uses `DocsCodeBlock`. */
export function DocsPre({
  children,
  ...props
}: HTMLAttributes<HTMLPreElement>) {
  return (
    <DocsCodeBlock {...props}>
      <Pre>{children}</Pre>
    </DocsCodeBlock>
  );
}

interface CopyButtonProps {
  containerRef: RefObject<HTMLElement | null>;
}

function CopyButton({ containerRef }: CopyButtonProps) {
  const [checked, onClick] = useCopyButton(() => {
    const pre = containerRef.current?.querySelector("pre");
    if (!pre) {
      return;
    }

    const clone = pre.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".nd-copy-ignore").forEach((node) => {
      node.replaceWith("\n");
    });
    return navigator.clipboard.writeText(clone.textContent ?? "");
  });

  return (
    <button
      type="button"
      data-checked={checked || undefined}
      aria-live="polite"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-md p-1 text-fd-muted-foreground transition-[color,scale] duration-150 ease-out hover:text-fd-accent-foreground focus-visible:ring-2 focus-visible:ring-fd-ring focus-visible:outline-none active:scale-[0.96] data-checked:text-fd-accent-foreground motion-reduce:active:scale-100"
    >
      <span className="relative flex size-4 items-center justify-center">
        <CheckIcon
          aria-hidden="true"
          className={cn(
            "absolute inset-0 size-4",
            ICON_TRANSITION_CLASS,
            checked ? ICON_SHOWN_CLASS : ICON_HIDDEN_CLASS,
          )}
        />
        <ClipboardIcon
          aria-hidden="true"
          className={cn(
            "size-4",
            ICON_TRANSITION_CLASS,
            checked ? ICON_HIDDEN_CLASS : ICON_SHOWN_CLASS,
          )}
        />
      </span>
      <span className="sr-only">{checked ? "Copied Text" : "Copy Text"}</span>
    </button>
  );
}
