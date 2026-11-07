#!/bin/bash
# Prints one section of the docs Changelog as GitHub Markdown, for the notes
# of a GitHub release.
#
#   tools/scripts/release-notes.sh v0.1.0       the "## v0.1.0" section
#   tools/scripts/release-notes.sh Unreleased   the "## Unreleased" section
#
# The section runs from its "## " heading to the next one. MDX the docs render
# and GitHub doesn't is rewritten: <Contributor> credits become "by @handle in
# #PR" links, <Kbd> keys become code, and /docs links point at calendarcn.xyz.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHANGELOG="$ROOT/content/docs/changelog.mdx"
REPO_URL="https://github.com/vmnog/calendarcn"
SITE_URL="https://calendarcn.xyz"

HEADING="${1:?usage: release-notes.sh <section heading, e.g. v0.1.0>}"

SECTION="$(awk -v heading="## $HEADING" '
  $0 == heading { found = 1; next }
  found && /^## / { exit }
  found { print }
' "$CHANGELOG")"

if [ -z "${SECTION//[[:space:]]/}" ]; then
  echo "No \"## $HEADING\" section with entries in $CHANGELOG" >&2
  exit 1
fi

printf '%s\n' "$SECTION" |
  sed -E \
    -e "s#<Contributor handle=\"([^\"]+)\" pr=\{([0-9]+)\} />#by @\1 in [\#\2]($REPO_URL/pull/\2)#g" \
    -e 's#</?KbdGroup>##g' \
    -e 's#<Kbd>([^<]+)</Kbd>#`\1`#g' \
    -e "s#\]\(/docs/#]($SITE_URL/docs/#g" |
  sed -e '/./,$!d'
