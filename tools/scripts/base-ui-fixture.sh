#!/bin/bash
# Installs the CalendarCN registry into a shadcn/ui project set up with Base UI,
# the way a user would, then type-checks and builds it. The base-ui Playwright
# project (e2e/base-ui/) runs against the result.
#
#   tools/scripts/base-ui-fixture.sh                 install, tsc and next build
#   tools/scripts/base-ui-fixture.sh start <port>    next start the built app
#
# e2e/base-ui/fixture is the stock `shadcn init -t next -b base -p nova`
# scaffold (minus its ThemeProvider, which takes the calendar's "d" key). Each
# run copies it to BASE_UI_DIR, outside the repo, so the install never writes
# to the checkout, and installs the registry built from the current source, so
# it tests the components as they are, not the committed public/r.

set -euo pipefail

SHADCN="shadcn@4.23.0"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIXTURE="$ROOT/e2e/base-ui/fixture"
TMP_ROOT="${TMPDIR:-/tmp}"
WORK="${BASE_UI_DIR:-${TMP_ROOT%/}/calendarcn-base-ui}"
APP="$WORK/app"
REGISTRY="$WORK/registry"
REGISTRY_PORT="${BASE_UI_REGISTRY_PORT:-3201}"

export NEXT_TELEMETRY_DISABLED=1

if [ "${1:-}" = "start" ]; then
  if [ ! -f "$APP/.next/BUILD_ID" ]; then
    echo "No Base UI build in $APP. Run tools/scripts/base-ui-fixture.sh first." >&2
    exit 1
  fi
  cd "$APP"
  exec npx next start --port "${2:?usage: base-ui-fixture.sh start <port>}"
fi

echo "Copying the fixture to $APP..."
rm -rf "$WORK"
mkdir -p "$REGISTRY"
cp -R "$FIXTURE" "$APP"

echo "Building the registry from source..."
(cd "$ROOT" && pnpm registry:build --output "$REGISTRY/r")

echo "Serving the registry on port $REGISTRY_PORT..."
python3 -m http.server "$REGISTRY_PORT" --bind 127.0.0.1 --directory "$REGISTRY" >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
REGISTRY_URL="http://127.0.0.1:$REGISTRY_PORT/r/{name}.json"
for _ in $(seq 1 50); do
  curl -sf "http://127.0.0.1:$REGISTRY_PORT/r/registry.json" >/dev/null && break
  sleep 0.2
done
curl -sf "http://127.0.0.1:$REGISTRY_PORT/r/registry.json" >/dev/null || {
  echo "The registry server didn't start on port $REGISTRY_PORT" >&2
  exit 1
}

cd "$APP"

echo "Installing the fixture's dependencies..."
npm ci --no-audit --no-fund

echo "Pointing @calendarcn at $REGISTRY_URL..."
node -e '
const fs = require("fs");
const config = JSON.parse(fs.readFileSync("components.json", "utf8"));
config.registries = { ...config.registries, "@calendarcn": process.argv[1] };
fs.writeFileSync("components.json", JSON.stringify(config, null, 2) + "\n");
' "$REGISTRY_URL"

# The opt-in data items, the command menu and the sidebars install too, so
# tsc and next build check them
echo "Installing @calendarcn/calendar, command-menu, conference-providers, sample-data and the sidebars..."
npx -y "$SHADCN" add @calendarcn/calendar @calendarcn/command-menu @calendarcn/conference-providers @calendarcn/sample-data @calendarcn/calendar-sidebar @calendarcn/details-sidebar -y

echo "Type-checking..."
npx tsc --noEmit

echo "Building..."
npx next build

echo "Base UI fixture built in $APP"
