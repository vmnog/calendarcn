# Deployment Runbook

## Overview

CalendarCN auto-deploys to Vercel on push to `main`. This runbook covers manual checks and troubleshooting.

## Pre-Deployment

```bash
pnpm lint          # Must pass
pnpm typecheck     # Must pass
pnpm format:check  # Must pass
pnpm build         # Must succeed
```

## Deployment Steps

1. Merge PR to `main` via GitHub
2. Vercel triggers automatic deployment
3. Monitor build in Vercel dashboard
4. Verify at https://calendarcn.vercel.app

## Rollback

```bash
# Revert the merge commit
git revert <merge-commit-sha>
git push origin main
# Vercel auto-deploys the revert
```

## Troubleshooting

### Build Fails on Vercel

1. Check Vercel build logs for the specific error
2. Try reproducing locally: `pnpm build`
3. Common causes: missing environment variables, type errors not caught locally

### Site Loads But Looks Broken

1. Check browser console for JavaScript errors
2. Verify CSS variables are loading (inspect `:root` styles)
3. Test in incognito mode (clear cache issues)
4. Compare with preview deployment from the PR

### Performance Issues

1. Check bundle size in Vercel analytics
2. Look for unnecessary re-renders with React DevTools Profiler
3. Verify memoization is working (check useMemo/useCallback deps)
