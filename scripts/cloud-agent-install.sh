#!/usr/bin/env bash
# Install for a Radar MDE verification VM. The cloud environment's install command
# is exactly `bash scripts/cloud-agent-install.sh`, so this file is the only copy of these steps.
# Safe to re-run: npm ci resets node_modules from the lockfiles, Playwright skips a Chromium
# build it already has, and the system-library step is skipped when Chromium already launches.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

# npm ci replaces web/node_modules, which a live next dev from this checkout is reading.
live="$(node -e '
const fs = require("fs"), path = require("path");
const dir = process.env.RADAR_VERIFY_STATE_ROOT || "/tmp/radar-mde-verify";
let names = [];
try { names = fs.readdirSync(dir); } catch {}
for (const n of names) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(dir, n, "state.json"), "utf8"));
    if (s.repoRoot !== process.argv[1] || !s.pid) continue;
    const cmd = fs.readFileSync(`/proc/${s.pid}/cmdline`, "utf8");
    if (cmd.includes(s.expectCmd || "next/dist/bin/next")) console.log(s.runId);
  } catch {}
}' "$root")"
if [[ -n "$live" && "${RADAR_INSTALL_ALLOW_LIVE:-}" != "1" ]]; then
  echo "A verification run is live in this checkout ($live). npm ci would replace node_modules under it." >&2
  echo "Run ./scripts/control-radar-mde cleanup --run-id <id> first, or only reinstall the browser: npx --prefix scripts/control playwright install chromium" >&2
  exit 1
fi

npm ci --prefix web
npm ci --prefix scripts/control

# Browser binary for the user who will run control-radar-mde (cache: ~/.cache/ms-playwright).
npx --prefix scripts/control playwright install chromium

# System libraries. Skip apt entirely when Chromium already starts, so a re-run works offline.
node_bin="$(command -v node)"
cli="$root/scripts/control/node_modules/playwright/cli.js"
if "$node_bin" -e 'require(process.argv[1]).chromium.launch().then((b) => b.close()).catch(() => process.exit(1))' "$root/scripts/control/node_modules/playwright" 2>/dev/null; then
  echo "Chromium launches; skipping playwright install-deps."
elif [[ "$(id -u)" -eq 0 ]]; then
  DEBIAN_FRONTEND=noninteractive "$node_bin" "$cli" install-deps chromium
elif sudo -n true 2>/dev/null; then
  # sudo's secure_path often hides npx, so call Playwright's CLI with node directly.
  sudo -n env DEBIAN_FRONTEND=noninteractive "$node_bin" "$cli" install-deps chromium
else
  echo "Chromium cannot start because system libraries are missing, and sudo needs a password." >&2
  echo "As root, run: DEBIAN_FRONTEND=noninteractive $node_bin $cli install-deps chromium" >&2
  exit 1
fi
