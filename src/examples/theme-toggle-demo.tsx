"use client";

import { ThemeToggle } from "@/components/theme-toggle";

export function ThemeToggleDemo() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      {/* Needs the ThemeProvider from theme-provider.tsx around the app */}
      <ThemeToggle className="size-9 text-foreground" />
      <p className="text-sm text-muted-foreground">
        System, then light, then dark
      </p>
    </div>
  );
}
