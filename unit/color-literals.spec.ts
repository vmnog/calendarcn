import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import registry from "../registry.json";

/**
 * No color is typed into a file the registry ships: every one is a CSS
 * variable, so the calendar wears the app's theme and an app restyles it in
 * its own CSS (see the Theming page). The colors themselves live in
 * `registry.json` (`cssVars`), where the CLI reads them.
 */

/** The repository root: the tests run from it */
const ROOT = path.join(__dirname, "..");

/** The parts of a `registry.json` item this test reads */
interface RegistryItem {
  name: string;
  files?: { path: string }[];
}

/** Every file the registry ships, once */
const SHIPPED_FILES = [
  ...new Set(
    (registry.items as RegistryItem[]).flatMap((item) =>
      (item.files ?? []).map((file) => file.path),
    ),
  ),
].sort();

/** A color literal in code, by the name the failure message gives it */
const COLOR_LITERALS: { name: string; pattern: RegExp }[] = [
  // `&#8984;` is an HTML entity, not a color
  { name: "hex color", pattern: /(?<![&\w])#[0-9a-fA-F]{3,8}\b/g },
  {
    name: "color function",
    pattern: /(?<![a-zA-Z-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/g,
  },
  {
    name: "white or black utility",
    pattern:
      /(?<![\w-])(?:bg|text|border|ring|fill|stroke|outline|shadow|from|to|via|divide|decoration|caret|accent|placeholder)-(?:white|black)\b/g,
  },
  { name: "white or black value", pattern: /["'`](?:white|black)["'`]/g },
];

/**
 * The literals that stay, each with the reason it isn't a token. Both are
 * shadows: a shadow is black at some opacity in every theme, as Tailwind's
 * own `shadow-*` utilities are, so there is no theme color to follow.
 */
const ALLOWED: { file: string; text: string; reason: string }[] = [
  {
    file: "src/components/calendar-toaster.tsx",
    text: "dark:shadow-black/40",
    reason: "the toast's shadow, stronger on a dark page",
  },
  {
    file: "src/components/event-detail-field-popover.tsx",
    text: "shadow-[0_8px_24px_rgb(0_0_0/0.24)]",
    reason: "the time menu's and date picker's shadow, Notion's size",
  },
];

/**
 * A file's code without its comments, which may name a color in prose
 * ("Notion: #D4D4D4") or a React error ("#418"). Line numbers stay the same.
 */
function stripComments(source: string): string {
  const blank = (text: string) => text.replace(/[^\n]/g, " ");
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      // `//` after a colon is a URL, not a comment
      .replace(/(^|[\s;{}(),])\/\/[^\n]*/gm, (match, before: string) => {
        return before + blank(match.slice(before.length));
      })
  );
}

/** Every color literal left in a file's code, as `path:line: kind "text"` */
function findColorLiterals(file: string): string[] {
  let code = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
  for (const allowed of ALLOWED) {
    if (allowed.file === file) code = code.split(allowed.text).join("");
  }

  const found: string[] = [];
  code.split("\n").forEach((line, index) => {
    for (const { name, pattern } of COLOR_LITERALS) {
      for (const match of line.matchAll(pattern)) {
        found.push(`${file}:${index + 1}: ${name} "${match[0]}"`);
      }
    }
  });
  return found;
}

test("the registry ships files to check", () => {
  expect(SHIPPED_FILES.length).toBeGreaterThan(80);
});

test("no shipped file types a color in: every color is a CSS variable", () => {
  const found = SHIPPED_FILES.flatMap(findColorLiterals);
  expect(
    found,
    "Use a token's utility (bg-calendar-menu, text-calendar-detail-muted, bg-event-bg…) instead; the Theming page lists them",
  ).toEqual([]);
});

test("every allowed literal is still in its file", () => {
  for (const { file, text, reason } of ALLOWED) {
    const code = stripComments(readFileSync(path.join(ROOT, file), "utf8"));
    expect(
      code.includes(text),
      `${file} no longer has ${text} (${reason})`,
    ).toBe(true);
    expect(SHIPPED_FILES).toContain(file);
  }
});

test("the guard catches each kind of literal", () => {
  const samples: Record<string, string> = {
    "hex color": 'className="bg-[#303030]"',
    "color function": 'style={{ color: "rgb(0 0 0 / 0.2)" }}',
    "white or black utility": 'className="text-white/60 hover:bg-black"',
    "white or black value": 'style={{ color: "white" }}',
  };
  for (const { name, pattern } of COLOR_LITERALS) {
    expect(samples[name].match(pattern), name).not.toBeNull();
  }
  // Not colors: an HTML entity, a utility that only starts like one, a color
  // space inside color-mix()
  const clean =
    '<Kbd>&#8984;</Kbd> className="whitespace-nowrap [--x:color-mix(in_oklab,var(--foreground)_13%,transparent)]"';
  for (const { name, pattern } of COLOR_LITERALS) {
    expect(clean.match(pattern), name).toBeNull();
  }
});
