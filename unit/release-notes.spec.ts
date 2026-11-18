import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * `tools/scripts/release-notes.sh`, which prints one version's section of the
 * docs Changelog as the notes of its GitHub release (ADR-006). Run on the
 * changelog as it is, so a new kind of MDX in an entry fails here before a
 * release prints it.
 */

/** The repository root, where the script and the changelog are */
const ROOT = path.join(__dirname, "..");

/** The docs Changelog the script reads */
const CHANGELOG_PATH = path.join(ROOT, "content", "docs", "changelog.mdx");

/** MDX the docs render and GitHub doesn't, and links that only work on the site */
const MDX_LEFT = /<\/?(Kbd|KbdGroup|Contributor)\b|\]\(\/docs\//;

/**
 * Longest the script may take. macOS's bash 3.2 once needed minutes for a
 * section the size of v0.1.0's.
 */
const TIME_LIMIT_MS = 10_000;

/** The headings of the changelog's version sections, newest first, e.g. `v0.1.0` */
function getVersionHeadings(): string[] {
  return [
    ...readFileSync(CHANGELOG_PATH, "utf8").matchAll(/^## (v\S+)$/gm),
  ].map(([, heading]) => heading);
}

function printReleaseNotes(heading: string): string {
  return execFileSync("bash", ["tools/scripts/release-notes.sh", heading], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: TIME_LIMIT_MS,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

test("the changelog has a version section", () => {
  expect(getVersionHeadings()).toContain("v0.1.0");
});

for (const heading of getVersionHeadings()) {
  test(`${heading}'s release notes are GitHub Markdown, with no MDX left`, () => {
    const notes = printReleaseNotes(heading);

    expect(notes).toMatch(/^Released [A-Z][a-z]+ \d{1,2}, \d{4}\.\n/);
    // The entries, by the day they merged
    expect(notes).toMatch(/^### [A-Z][a-z]+ \d{1,2}, \d{4}$/m);
    expect(notes).toMatch(/^- \*\*(Added|Improved|Fixed)\*\*/m);
    expect(notes).not.toMatch(MDX_LEFT);
    // The next section's heading isn't part of it
    expect(notes).not.toMatch(/^## /m);
  });
}

test("v0.1.0's notes turn keys into code and credits into links", () => {
  const notes = printReleaseNotes("v0.1.0");

  // <KbdGroup><Kbd>⌘</Kbd><Kbd>A</Kbd></KbdGroup>
  expect(notes).toContain("`⌘+A`");
  // <Contributor handle="doneumark" pr={43} />
  expect(notes).toContain(
    "by @doneumark in [#43](https://github.com/vmnog/calendarcn/pull/43)",
  );
  expect(notes).toContain("](https://calendarcn.xyz/docs/");
});

test("a section that doesn't exist fails with a message", () => {
  expect(() => printReleaseNotes("v0.0.0-missing")).toThrow(
    /No "## v0\.0\.0-missing" section/,
  );
});
