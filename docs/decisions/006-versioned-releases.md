# ADR-006: Versioned Releases

## Status

Proposed

## Context

CalendarCN ships as a shadcn registry, not an npm package. `registry.json` is built into `public/r`, and every deploy of `main` serves it at `calendarcn.xyz/r`. `npx shadcn add @calendarcn/<item>` copies the source into an app, and running it again with `--overwrite` brings in whatever `main` has at that moment.

That gets fixes to people fast, but nothing names what they have:

- There are no git tags or GitHub releases, so "which version are you on?" has no answer. The `version` in `package.json` (0.1.0) isn't tied to anything.
- Nobody can stay on a known-good state. Every `add` resolves the items and the items they depend on against the latest `main`.
- Breaking changes, like `parseIcs()` reading `RRULE` into `recurrenceRule` instead of `recurrence` (#50), are only in pull request descriptions.

The docs now have a Changelog page (`content/docs/changelog.mdx`), grouped by the day each change merged, and an Updating guide built on `add --dry-run`, `--diff <path>` and `--overwrite`.

## Decision

### Tags and GitHub releases

- **One version for the whole registry.** Items depend on each other through `@calendarcn/*` names, which all resolve through the one URL an app configures, so items can't be installed at different versions anyway.
- **Semver over the registry's public surface:** exported components, hooks, functions and types, their props and fields, the file paths items install, and the CSS variables. While on 0.x, a breaking change bumps the minor version and anything else bumps the patch. 1.0 comes once the API settles.
- **Each release is an annotated tag `vX.Y.Z` on `main`** and a GitHub release whose notes are that version's Changelog section. `tools/scripts/release-notes.sh vX.Y.Z` prints it as GitHub Markdown. `package.json`'s `version` matches the latest tag.
- **The Changelog is written as changes land.** A pull request that changes an item adds its entry under `## Unreleased`, under the day it merges. A release renames `## Unreleased` to `## vX.Y.Z` with the release date, so the version's notes are already written.
- **The first release is v0.1.0**, covering everything since the registry launched on November 1, 2026.
- **Releases don't gate the registry.** `calendarcn.xyz/r` keeps serving `main`. A tag names a point on it that people can refer to, compare against and, once snapshots exist, pin.

The `release` skill (`.claude/skills/release/SKILL.md`) has the steps.

### Pinning with versioned snapshots (proposed, not implemented)

An app picks where `@calendarcn/*` resolves in its `components.json`. Pointing that URL at a fixed version pins the item and everything it depends on, since every `@calendarcn/*` dependency resolves through the same URL. Two ways to serve one:

**A. GitHub raw URLs at a tag.** `public/r` is committed, and CI fails when it's stale, so every tag already has a matching registry:

```json
{
  "registries": {
    "@calendarcn": "https://raw.githubusercontent.com/vmnog/calendarcn/v0.1.0/public/r/{name}.json"
  }
}
```

This costs nothing to build. Tested with shadcn 4.23 and a commit SHA in place of the tag: `add @calendarcn/calendar --dry-run` resolved every item at that commit. The URL depends on the GitHub repository's name, and raw.githubusercontent.com isn't meant to serve an app, which is fine for a CLI that fetches on `add`.

**B. Snapshots on the site.** The release copies `public/r` to `public/r/v<version>/`, served at `calendarcn.xyz/r/v<version>/{name}.json`. It keeps the URL on our domain and survives a repository rename, at about 900 KB per release in the repository and every deploy. `pnpm registry:build` and the CI staleness check would have to leave `public/r/v*` alone.

Start with A: document it in the Updating guide once v0.1.0 is tagged. Move to B if people pin often or the raw URLs prove unreliable.

## Consequences

### Positive

- People can say which version they're on, compare two versions, and read what changed between them.
- Watching the repository's releases on GitHub notifies people of new versions.
- Breaking changes are collected per release, and the minor version bump on 0.x flags them.
- With snapshot option A, pinning works as soon as a tag exists, with no build step.

### Negative

- Every pull request that changes an item needs a Changelog entry, and every release needs a few manual steps.
- Tracking `main` still means taking unreleased changes. A tag labels a version, it doesn't hold the registry back.

### Neutral

- There's still no npm package. Updating stays `add --overwrite`, now with a version to read about first.
