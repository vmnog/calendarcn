# Refactor Skill — CalendarCN

## When to Use

Invoke when restructuring code, extracting components/hooks, or improving code quality without changing behavior.

## Pre-Refactor Checklist

1. **Verify current state passes:** `pnpm lint && pnpm typecheck && pnpm format:check`
2. **Identify the scope:** Which files will change?
3. **Check for dependents:** Search for imports of the module being refactored
4. **Plan the changes:** Describe what moves where before touching code

## Refactor Playbook

### Extracting a Component

1. Identify the JSX block to extract
2. Create `src/components/new-component-name.tsx` (kebab-case)
3. Define `interface NewComponentNameProps` for all data/callbacks needed
4. Move JSX into new component function
5. Add `"use client"` if it uses hooks or browser APIs
6. Update imports in the parent component
7. Run `pnpm typecheck` to catch missed props

### Extracting a Hook

1. Create `src/hooks/use-hook-name.ts`
2. Define `interface UseHookNameOptions` and `interface UseHookNameReturn`
3. Follow the ref-sync pattern for all options:
   ```ts
   const optionRef = useRef(option);
   useEffect(() => { optionRef.current = option; }, [option]);
   ```
4. Store global event handlers in refs
5. Return typed object matching `UseHookNameReturn`
6. Clean up all listeners in `useEffect` return

### Extracting Utility Functions

1. If the function is pure (no React) → `src/lib/`
2. If it's event-related → `src/lib/event-utils.ts`
3. Add JSDoc comment describing purpose, params, and return
4. Export function (no default exports for utils)
5. Add `import type` for any type dependencies

### Moving Types

- All shared types must live in `src/components/week-view-types.ts`
- Component-local types can stay in the component file
- Never duplicate types — always import from canonical source

## Post-Refactor Checklist

1. **Verify:** `pnpm lint && pnpm typecheck && pnpm format:check`
2. **Visual check:** `pnpm dev` — test the affected UI manually
3. **Check imports:** No circular dependencies introduced
4. **Check naming:** All new files follow `kebab-case` convention
5. **Check types:** No new `any` types, all imports use `import type` where applicable
6. **Format:** `pnpm format` to normalize style

## Common Refactor Patterns

### Replace Nested Conditionals with Early Returns

```ts
// Before
if (condition) {
  if (otherCondition) {
    // deep logic
  }
}

// After
if (!condition) return;
if (!otherCondition) return;
// flat logic
```

### Extract Constants

```ts
// Before
if (scrollPosition > 100) { ... }

// After
/** Scroll threshold in pixels before triggering auto-navigation */
const SCROLL_THRESHOLD_PX = 100;
if (scrollPosition > SCROLL_THRESHOLD_PX) { ... }
```

### Consolidate Event Color Logic

All color-related logic should go through `eventColorStyles[color]` — never hardcode individual color class strings.
