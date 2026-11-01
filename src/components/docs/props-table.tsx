import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PropDefinition {
  name: string;
  /** TypeScript type, rendered as code. */
  type: string;
  /** Default value, rendered as code. Omit when there is none. */
  default?: string;
  required?: boolean;
  /** Plain text or JSX. In a string, `backticks` render as inline code. */
  description?: ReactNode;
}

interface PropsTableProps {
  /** Rows to render. Omit (or pass an empty list) while the API isn't final. */
  rows?: PropDefinition[];
  /** Header of the first column, e.g. "Field" for a type or return value. */
  nameHeader?: string;
  /** Message shown when there are no rows yet. */
  todo?: ReactNode;
  className?: string;
}

/** Classes for code inside a description, matching the prop name's font. */
const INLINE_CODE_CLASS =
  "rounded-sm bg-fd-muted px-1 py-px font-mono text-[0.8125rem] text-fd-foreground";

/** Renders a description string's `backtick` spans as inline code. */
function renderDescription(description: ReactNode): ReactNode {
  if (typeof description !== "string") {
    return description;
  }

  // Odd indexes are the parts between backticks
  return description.split("`").map((part, index) =>
    index % 2 === 1 ? (
      <code key={index} className={INLINE_CODE_CLASS}>
        {part}
      </code>
    ) : (
      part
    ),
  );
}

/** API reference table for a component's props, in the style of ui.shadcn.com. */
export function PropsTable({
  rows = [],
  nameHeader = "Prop",
  todo,
  className,
}: PropsTableProps) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "not-prose my-6 rounded-xl border border-dashed p-6 text-center text-sm text-fd-muted-foreground",
          className,
        )}
      >
        {todo ?? "Nothing to list here."}
      </div>
    );
  }

  // Types and return values have no defaults; drop the empty column
  const showDefault = rows.some((row) => row.default);

  return (
    <div
      className={cn(
        "docs-surface not-prose my-6 overflow-x-auto rounded-xl text-sm",
        className,
      )}
    >
      <table className="w-full min-w-[36rem] border-collapse text-left">
        <thead className="bg-fd-muted/50 text-fd-muted-foreground">
          <tr>
            {/* Name and description get the room; types and defaults are short */}
            <th
              className={cn(
                "px-4 py-2.5 font-medium",
                showDefault ? "w-[46%]" : "w-[52%]",
              )}
            >
              {nameHeader}
            </th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            {showDefault && (
              <th className="px-4 py-2.5 font-medium">Default</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t align-top">
              <td className="px-4 py-3">
                <code className="font-mono text-[0.8125rem] font-medium text-fd-foreground">
                  {row.name}
                  {row.required && (
                    <>
                      <span aria-hidden className="text-fd-primary">
                        *
                      </span>
                      <span className="sr-only"> (required)</span>
                    </>
                  )}
                </code>
                {row.description && (
                  <div className="mt-1.5 text-pretty text-fd-muted-foreground">
                    {renderDescription(row.description)}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                {/* Long types wrap; each line keeps the chip's padding */}
                <code className="box-decoration-clone rounded-md bg-fd-muted px-1.5 py-0.5 font-mono text-[0.8125rem] leading-6">
                  {row.type}
                </code>
              </td>
              {showDefault && (
                <td className="px-4 py-3 text-fd-muted-foreground">
                  {row.default ? (
                    <code className="font-mono text-[0.8125rem]">
                      {row.default}
                    </code>
                  ) : (
                    "–"
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
