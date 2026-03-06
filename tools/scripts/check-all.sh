#!/bin/bash
# Run all code quality checks. Use before committing or opening a PR.

set -e

echo "Checking ESLint..."
pnpm lint

echo "Running TypeScript check..."
pnpm typecheck

echo "Checking formatting..."
pnpm format:check

echo "All checks passed!"
