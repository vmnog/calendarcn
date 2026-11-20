import { cn } from "@/lib/utils";

import registry from "../../../registry.json";

/** Name of the theme item, whose values the tables show beside the defaults */
const THEME_ITEM = "theme-notion";

/** The seven event colors that ship, in the pickers' order */
const EVENT_COLOR_NAMES = [
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "gray",
];

/** The variables of one event color, by what each paints */
const EVENT_COLOR_PARTS = [
  { suffix: "", label: "Text" },
  { suffix: "-bg", label: "Background" },
  { suffix: "-border", label: "Bar and swatch" },
  { suffix: "-strong", label: "Month title" },
  { suffix: "-muted", label: "Month time" },
];

/**
 * What each of the calendar's own tokens paints, by the group the Theming
 * page lists it in. The values come from `registry.json`; a token of the
 * registry that is missing here fails the build, so the page can't go stale.
 */
const TOKEN_GROUPS = {
  details: {
    "calendar-detail-foreground":
      "Text of the event details: the title and every value",
    "calendar-detail-secondary":
      'Secondary text (a duration, a time zone offset, "before") and small actions',
    "calendar-detail-muted":
      "Row icons, arrows, chevrons, and the All-day switch while it's off",
    "calendar-detail-placeholder":
      'Empty fields ("Location", "Description") and captions',
    "calendar-detail-border": "Lines between groups of rows, link underlines",
    "calendar-detail-hover-border":
      "Border of a field on hover, and of the dialogs and their buttons",
    "calendar-detail-focus":
      "Fill of a focused field, an open trigger and a hovered row",
  },
  menus: {
    "calendar-menu":
      "Surface of the menus, the toasts, the tooltips and the scheduling hint",
    "calendar-menu-border": "Their border, and the lines inside a menu",
    "calendar-menu-foreground":
      "Their text. Softer text is this color at a lower opacity",
    "calendar-menu-muted-foreground": "Labels and hints in a menu",
    "calendar-menu-accent": "The highlighted item",
    "calendar-menu-accent-foreground": "The highlighted item's text",
  },
  accents: {
    "calendar-selection":
      "A checked radio or switch, focus rings in the details, the dialogs' main button",
    "calendar-selection-foreground": "Text and marks on it",
    "calendar-danger": "Delete and Remove, and a guest who declined",
    "calendar-danger-foreground": "Text on it",
    "calendar-avatar": "The placeholder avatar of a guest or a room",
    "calendar-avatar-foreground": "The initial or icon on it",
  },
  views: {
    "calendar-weekend": "Weekend columns, and weekend cells in month view",
    "calendar-highlight": "The flash on a day's column after you jump to it",
    "calendar-current-week": "The days on screen, in the mini calendar",
    "calendar-day-hover": "A day under the pointer, in the mini calendar",
    "calendar-day-hover-current-week":
      "A day under the pointer that is already on screen",
  },
  sidebars: {
    "calendar-sidebar": "Background of the calendar sidebar",
    "calendar-sidebar-foreground": "Its text",
    "calendar-sidebar-muted-foreground":
      "Its icons, placeholders and the show and hide buttons",
    "calendar-sidebar-primary": "Filled controls in the sidebars",
    "calendar-sidebar-primary-foreground": "Text on them",
    "calendar-sidebar-accent": "A hovered or current row",
    "calendar-sidebar-accent-foreground": "Its text",
    "calendar-sidebar-border": "Lines between the sidebars' sections",
    "calendar-sidebar-ring": "Focus rings in the sidebars",
    "calendar-context-panel": "Background of the details sidebar",
    "calendar-context-panel-muted-foreground":
      "Labels and placeholders in the details sidebar",
  },
} satisfies Record<string, Record<string, string>>;

/** A group of tokens the Theming page lists in one table */
export type ThemeTokenGroup = keyof typeof TOKEN_GROUPS;

/** The `cssVars` of a `registry.json` item */
interface CssVars {
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

/** The parts of a `registry.json` item the tables read */
interface RegistryItem {
  name: string;
  cssVars?: CssVars;
}

const ITEMS = registry.items as RegistryItem[];

/** Light and dark values of every variable an item other than the theme declares */
const DEFAULTS: Required<CssVars> = { light: {}, dark: {} };
for (const item of ITEMS) {
  if (item.name === THEME_ITEM) continue;
  Object.assign(DEFAULTS.light, item.cssVars?.light);
  Object.assign(DEFAULTS.dark, item.cssVars?.dark);
}

/** The Notion Calendar theme's values */
const NOTION: CssVars =
  ITEMS.find((item) => item.name === THEME_ITEM)?.cssVars ?? {};

/** Every calendar token a table describes */
const DESCRIBED_TOKENS = new Set(
  Object.values(TOKEN_GROUPS).flatMap((group) => Object.keys(group)),
);

for (const name of Object.keys(DEFAULTS.light)) {
  if (name.startsWith("calendar-") && !DESCRIBED_TOKENS.has(name)) {
    throw new Error(
      `ThemeTokens: --${name} is in registry.json but in no group of src/components/docs/theme-tokens.tsx`,
    );
  }
}

/** One token, as a table lists it */
export interface ThemeTokenRow {
  /** The variable's name, with its dashes: `--calendar-menu` */
  name: string;
  /** What it paints */
  description: string;
  /** What a plain install sets it to: a shadcn/ui token, or a mix of them */
  defaultValue: string;
  /** The Notion Calendar theme's light value */
  notionLight: string;
  /** The Notion Calendar theme's dark value */
  notionDark: string;
}

/** A variable's value in `values`, failing the build when the registry lost it */
function valueOf(values: Record<string, string> | undefined, name: string) {
  const value = values?.[name];
  if (value === undefined) {
    throw new Error(`ThemeTokens: registry.json has no value for --${name}`);
  }
  return value;
}

/** The rows of one group, with their values read from `registry.json` */
export function getThemeTokenRows(group: ThemeTokenGroup): ThemeTokenRow[] {
  return Object.entries(TOKEN_GROUPS[group]).map(([name, description]) => ({
    name: `--${name}`,
    description,
    defaultValue: valueOf(DEFAULTS.light, name),
    notionLight: valueOf(NOTION.light, name),
    notionDark: valueOf(NOTION.dark, name),
  }));
}

/** One event color: its name and the light and dark value of each of its variables */
export interface EventColorRow {
  /** `red`, `orange`… */
  color: string;
  /** Its variables, in `EVENT_COLOR_PARTS` order */
  parts: { name: string; label: string; light: string; dark: string }[];
}

/** The seven event colors that ship, with their values from `registry.json` */
export function getEventColorRows(): EventColorRow[] {
  return EVENT_COLOR_NAMES.map((color) => ({
    color,
    parts: EVENT_COLOR_PARTS.map(({ suffix, label }) => ({
      name: `--event-${color}${suffix}`,
      label,
      light: valueOf(DEFAULTS.light, `event-${color}${suffix}`),
      dark: valueOf(DEFAULTS.dark, `event-${color}${suffix}`),
    })),
  }));
}

/** The labels of an event color's variables, in the order the rows list them */
export function getEventColorPartLabels(): string[] {
  return EVENT_COLOR_PARTS.map((part) => part.label);
}

/** The docs tables' frame, as `PropsTable` draws it */
const TABLE_FRAME_CLASS =
  "docs-surface not-prose my-6 overflow-x-auto rounded-xl text-sm";

/** A header cell of the docs tables */
const HEADER_CELL_CLASS = "px-4 py-2.5 font-medium";

/** Code in a table cell: a token's name or its default */
const CODE_CLASS = "font-mono text-[0.8125rem]";

interface SwatchProps {
  /** Any CSS color */
  color: string;
  /** Names the swatch for assistive tech and in a tooltip */
  label: string;
}

/** A small square of a color, outlined so white and near-black both show */
function Swatch({ color, label }: SwatchProps) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-block size-3.5 shrink-0 rounded-[4px] ring-1 ring-fd-foreground/15"
      style={{ backgroundColor: color }}
    />
  );
}

interface ThemeTokensProps {
  /** Which of the calendar's tokens to list */
  group: ThemeTokenGroup;
  className?: string;
}

/**
 * A table of the calendar's own tokens: what each paints, what a plain
 * install sets it to, and the Notion Calendar theme's light and dark value.
 * Built from `registry.json`, so it always matches what the CLI writes.
 */
export function ThemeTokens({ group, className }: ThemeTokensProps) {
  const rows = getThemeTokenRows(group);

  return (
    <div className={cn(TABLE_FRAME_CLASS, className)}>
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <thead className="bg-fd-muted/50 text-fd-muted-foreground">
          <tr>
            <th className={cn(HEADER_CELL_CLASS, "w-[44%]")}>Token</th>
            <th className={HEADER_CELL_CLASS}>Default</th>
            <th className={HEADER_CELL_CLASS}>Notion, light and dark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t align-top">
              <td className="px-4 py-3">
                <code
                  className={cn(CODE_CLASS, "font-medium text-fd-foreground")}
                >
                  {row.name}
                </code>
                <div className="mt-1.5 text-pretty text-fd-muted-foreground">
                  {row.description}
                </div>
              </td>
              <td className="px-4 py-3">
                <code
                  className={cn(
                    CODE_CLASS,
                    "box-decoration-clone rounded-md bg-fd-muted px-1.5 py-0.5 leading-6",
                  )}
                >
                  {row.defaultValue}
                </code>
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <Swatch color={row.notionLight} label="Light" />
                  <code className={CODE_CLASS}>{row.notionLight}</code>
                </span>
                <span className="mt-1 flex items-center gap-1.5 whitespace-nowrap">
                  <Swatch color={row.notionDark} label="Dark" />
                  <code className={CODE_CLASS}>{row.notionDark}</code>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EventColorTokensProps {
  className?: string;
}

/**
 * The seven event colors that ship: each color's five variables, as a light
 * and a dark swatch. Built from `registry.json`.
 */
export function EventColorTokens({ className }: EventColorTokensProps) {
  const rows = getEventColorRows();

  return (
    <div className={cn(TABLE_FRAME_CLASS, className)}>
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <thead className="bg-fd-muted/50 text-fd-muted-foreground">
          <tr>
            <th className={HEADER_CELL_CLASS}>Color</th>
            {getEventColorPartLabels().map((label) => (
              <th key={label} className={HEADER_CELL_CLASS}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.color} className="border-t">
              <td className="px-4 py-3">
                <code
                  className={cn(CODE_CLASS, "font-medium text-fd-foreground")}
                >
                  {row.color}
                </code>
              </td>
              {row.parts.map((part) => (
                <td key={part.name} className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <Swatch
                      color={part.light}
                      label={`${part.name}, light: ${part.light}`}
                    />
                    <Swatch
                      color={part.dark}
                      label={`${part.name}, dark: ${part.dark}`}
                    />
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
