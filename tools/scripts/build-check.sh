#!/bin/bash
# Full pre-release check: lint + typecheck + format + build

set -e

echo "Checking ESLint..."
pnpm lint

echo "Running TypeScript check..."
pnpm typecheck

echo "Checking formatting..."
pnpm format:check

echo "Building for production..."
pnpm build

echo "Build check complete — ready for release!"
