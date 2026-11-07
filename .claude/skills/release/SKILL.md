# Release Skill — CalendarCN

## When to Use

Invoke when preparing a new release, cutting a versioned release (changelog, tag and GitHub release), or deploying to production.

## Pre-Release Checklist

### 1. Code Quality

```bash
pnpm lint          # Zero warnings, zero errors
pnpm typecheck     # No type errors
pnpm format:check  # All files formatted
```

### 2. Build Verification

```bash
pnpm build         # Must complete without errors
```

Check for:

- No build warnings about unused imports
- No bundle size regressions (check `.next/` output)
- No missing environment variables

### 3. Manual Testing

Test the following in `pnpm dev`:

- [ ] Week view renders correctly with sample events
- [ ] Event drag works (single-day and cross-day)
- [ ] Event resize works (top and bottom handles)
- [ ] All-day event resize works
- [ ] Dark mode toggle functions
- [ ] Sidebar mini calendar navigation
- [ ] Keyboard shortcuts: `T` (today), `J`/`K` (navigate weeks), `/` (search), `Cmd+/` (shortcut help)
- [ ] Event context menu (right-click)
- [ ] Event detail popover (click)
- [ ] Current time indicator visible and positioned correctly
- [ ] Responsive behavior at different viewport sizes

### 4. Accessibility

- [ ] Keyboard navigation works for event selection
- [ ] Focus indicators visible
- [ ] Color contrast meets WCAG AA

## Cut a Versioned Release

Releases follow [ADR-006](../../../docs/decisions/006-versioned-releases.md): one semver version for the whole registry, an annotated tag `vX.Y.Z` on `main`, and a GitHub release whose notes are that version's section of the Changelog (`content/docs/changelog.mdx`). The registry keeps serving `main`; a release names a point on it.

Tags and GitHub releases are public and hard to take back. Confirm the version with the user before step 4, and don't tag or publish without their ok.

### 1. Pick the version

```bash
git fetch origin --tags
git describe --tags --abbrev=0 origin/main   # the last release; errors before the first one
```

While on 0.x, any **Breaking** line under `## Unreleased` bumps the minor version (0.1.3 → 0.2.0). Otherwise bump the patch (0.1.3 → 0.1.4). The first release is v0.1.0.

### 2. Write the changelog entry

Each pull request that changed a registry item should already have its line under `## Unreleased` (format in CONTRIBUTING.md, "The registry"). `public/r` changes exactly when a shipped file does, so this lists the ones to check:

```bash
git log --oneline <last tag>..origin/main -- public/r   # first release: 34db404~1..origin/main
```

Add any missing line, and check each one sits under the day its pull request merged (`gh pr view <number> --json mergedAt`).

Then open a release pull request, `chore: release vX.Y.Z`:

- Rename `## Unreleased` to `## vX.Y.Z`, and replace the line under it with `Released <Month D, YYYY>.`
- Set `version` in `package.json` to `X.Y.Z`.
- Preview the notes with `tools/scripts/release-notes.sh vX.Y.Z`.

The next pull request that changes an item adds a new `## Unreleased` above it, with the line "Live in the registry, but not in a tagged release yet."

### 3. Merge the release pull request

Merge it once CI passes and the user has okayed it.

### 4. Tag the merge commit

```bash
git fetch origin
git log -1 --oneline origin/main   # must be the release pull request's commit
git tag -a vX.Y.Z origin/main -m "vX.Y.Z"
git push origin vX.Y.Z
```

### 5. Create the GitHub release

```bash
tools/scripts/release-notes.sh vX.Y.Z > "$TMPDIR/release-notes.md"
gh release create vX.Y.Z --verify-tag --title "vX.Y.Z" --notes-file "$TMPDIR/release-notes.md"
```

`--verify-tag` stops if the tag didn't reach GitHub.

### 6. Verify

```bash
gh release view vX.Y.Z
curl -sfI https://raw.githubusercontent.com/vmnog/calendarcn/vX.Y.Z/public/r/calendar.json   # the registry pinned at the tag
```

## Deployment

CalendarCN deploys to Vercel automatically on push to `main`.

### Vercel Deployment Checks

- [ ] Preview deployment successful (check PR preview)
- [ ] No new Vercel build warnings
- [ ] Production deployment healthy after merge

## Rollback Procedure

If issues found post-deploy:

1. Revert the merge commit: `git revert <commit-sha>`
2. Push to `main` — Vercel will auto-deploy the revert
3. Investigate the issue on a branch
4. Fix and re-deploy via new PR

## Post-Release

- [ ] Verify production site: https://calendarcn.vercel.app
- [ ] Check browser console for errors
- [ ] Test core interactions on production
- [ ] Update any related Linear issues
