import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PropDefinition {
  name: string;
  /** TypeScript type, rendered as code. */
  type: string;
  /** Default value, rendered as code. Omit when there is none. */
  default?: string;
  required?: boolean;
  description?: ReactNode;
}

interface PropsTableProps {
  /** Rows to render. Omit (or pass an empty list) while the API isn't final. */
  rows?: PropDefinition[];
  /** Message shown when there are no rows yet. */
  todo?: ReactNode;
  className?: string;
}

/** API reference table for a component's props, in the style of ui.shadcn.com. */
export function PropsTable({ rows = [], todo, className }: PropsTableProps) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "not-prose my-6 rounded-xl border border-dashed p-6 text-center text-sm text-fd-muted-foreground",
          className,
        )}
      >
        {todo ??
          "TODO: the API reference lands once the calendar refactor is final."}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "not-prose my-6 overflow-x-auto rounded-xl border text-sm",
        className,
      )}
    >
      <table className="w-full border-collapse text-left">
        <thead className="bg-fd-muted/50 text-fd-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Prop</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Default</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t align-top">
              <td className="px-4 py-3">
                <code className="font-mono text-[0.8125rem] font-medium text-fd-foreground">
                  {row.name}
                  {row.required && <span className="text-fd-primary">*</span>}
                </code>
                {row.description && (
                  <div className="mt-1.5 text-fd-muted-foreground">
                    {row.description}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <code className="rounded-md bg-fd-muted px-1.5 py-0.5 font-mono text-[0.8125rem]">
                  {row.type}
                </code>
              </td>
              <td className="px-4 py-3 text-fd-muted-foreground">
                {row.default ? (
                  <code className="font-mono text-[0.8125rem]">
                    {row.default}
                  </code>
                ) : (
                  "–"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
