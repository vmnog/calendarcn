"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggleTooltipDemo() {
  return (
    <div className="flex h-full items-center justify-center">
      <Tooltip>
        {/* The toggle forwards its ref and props to its button, so it works
            as the trigger */}
        <TooltipTrigger asChild>
          <ThemeToggle className="size-9 text-foreground" />
        </TooltipTrigger>
        <TooltipContent>Switch theme</TooltipContent>
      </Tooltip>
    </div>
  );
}
