# Code Review Skill — CalendarCN

## When to Use

Invoke when reviewing PRs, diffs, or code changes in the CalendarCN project.

## Checklist

### 1. Type Safety

- [ ] No `any` types introduced
- [ ] All shared types imported from `week-view-types.ts` (not duplicated)
- [ ] `import type` used for type-only imports
- [ ] Props defined via `interface ComponentNameProps`
- [ ] Optional props use `?` (not `| undefined`)

### 2. React Patterns

- [ ] `ref.current` never assigned during render (always in `useEffect`)
- [ ] Hook dependencies are exhaustive (no eslint-disable for deps)
- [ ] Refs used to break circular dependencies (not skipped deps)
- [ ] `React.useCallback` for handlers passed as props
- [ ] `React.useMemo` for expensive derived state
- [ ] No state updates during render

### 3. Component Structure

- [ ] `"use client"` directive present if component uses hooks/browser APIs
- [ ] Import order: external → `@/lib/utils` → `@/hooks` → `@/components` → `@/lib`
- [ ] Constants in ALL_CAPS with JSDoc
- [ ] Early returns instead of deeply nested conditionals
- [ ] Props destructured in function params

### 4. Styling

- [ ] Uses `cn()` for conditional classes (no string concatenation)
- [ ] Tailwind for fixed styles, inline `style` for computed layout
- [ ] Color variants use `eventColorStyles[color]` map
- [ ] Z-index follows scale: events(0-2) < selected(20) < placeholder(25) < dragging(30) < portal(9999)
- [ ] Dark mode tested (uses CSS variables, not hardcoded colors)

### 5. Naming

- [ ] Files: `kebab-case`
- [ ] Components: `PascalCase`
- [ ] Hooks: `useCamelCase`
- [ ] Constants: `ALL_CAPS_SNAKE`

### 6. Performance

- [ ] No unnecessary re-renders (check memoization)
- [ ] Event listeners cleaned up in `useEffect` return
- [ ] ResizeObserver disconnected on unmount
- [ ] Large computations memoized (e.g., `calculatePositionedEvents`)

### 7. Pre-submit

```bash
pnpm lint && pnpm typecheck && pnpm format:check
```

All three must pass before approving.

## Red Flags

- Direct DOM mutation outside refs
- `any` or `as unknown as X` type casts
- Missing cleanup for event listeners or observers
- Types defined in component files instead of `week-view-types.ts`
- Hardcoded pixel values that should be constants
- `console.log` left in production code
