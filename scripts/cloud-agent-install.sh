#!/usr/bin/env bash
# Idempotent install for a Radar MDE verification VM.
# npm ci resets node_modules from the lockfile. Playwright skips a Chromium
# build it already has, and install-deps is a no-op when the libraries are present.
# Keep these steps in sync with the cloud environment's install command.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

npm ci --prefix web
npm ci --prefix scripts/control

# Browser binary for the user who will run control-radar-mde (cache: ~/.cache/ms-playwright).
npx --prefix scripts/control playwright install chromium

# System libraries. sudo's PATH often hides npx, so call Playwright's CLI with node directly.
node_bin="$(command -v node)"
cli="$root/scripts/control/node_modules/playwright/cli.js"
if [[ "$(id -u)" -eq 0 ]]; then
  DEBIAN_FRONTEND=noninteractive "$node_bin" "$cli" install-deps chromium
else
  sudo env DEBIAN_FRONTEND=noninteractive "$node_bin" "$cli" install-deps chromium
fi
