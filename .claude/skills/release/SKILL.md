# Release Skill — CalendarCN

## When to Use

Invoke when preparing a new release or deploying to production.

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

### 5. Version & Changelog

- Update version in `package.json` if applicable
- Document changes since last release
- Tag the release in git

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
