const ROOT = `control-radar-mde — launch and drive Radar MDE for verification

Radar MDE (web/) is a Next.js site. A person uses the browser: the national panel,
the immersive map, search, the municipality table, and the saved-municipality list.
There is no login and no server database. Municipalities a person saves live in
localStorage key radar-mde:watch inside this run's browser profile.

One checkout can run one next dev server. web/.next is shared, so a second server
in the same checkout is refused. Two checkouts can run side by side on different ports.

Usage:
  control-radar-mde <command> [subcommand] [flags]
  control-radar-mde <command> --help

Commands:
  launch      Start next dev on 127.0.0.1 and wait until the home page says Radar MDE
  doctor      Read-only check: our pid, our port, HTTP identity, git revision
  browser     Drive the page with Playwright (click, fill, snapshot, screenshot)
  seed        Seed or clear the watchlist in this run's browser profile
  http        GET a path on this run's origin (pages and CSV routes)
  logs        Read the dev-server log
  evidence    Show the proof directory cleanup will not delete
  cleanup     Stop only this run's processes and delete only this run's state

Global flags:
  --run-id <id>   Run printed by launch. Or set RADAR_VERIFY_RUN_ID.
  --dry-run       On cleanup, seed, and browser storage set: report the write and skip it.
  --help          Help for the current command.

Stdout is one JSON object, except --help which prints this text.
Failures include "error" and "hint" (the command to run instead).
Evidence defaults to /tmp/radar-mde-verify-evidence/<run-id> and survives cleanup.
State (pid, port, profile, server log) defaults to /tmp/radar-mde-verify/<run-id>.
`;

const COMMANDS = {
  launch: `control-radar-mde launch — start an isolated dev server

Starts web/'s next dev bound to 127.0.0.1, writes a run record, and waits until
GET / returns HTML that contains "Radar MDE".

Flags:
  --port <n>       Use this port. If it is taken, exit with a hint. Omit to search from 4173.
  --run-id <id>    Reuse an id. If that run is already healthy, launch returns it and does not start a second server.
  --timeout <ms>   Ready timeout. Default 180000. The first compile of this app is slow.

The child is a new process group. cleanup kills that group only after checking the
command line still contains next/dist/bin/next. A recycled pid is not killed.

No secrets are required. Data is the JSON already in web/src/data. VERCEL_* and
NEXT_PUBLIC_SITE_URL are stripped from the child so canonical URLs stay on this origin.
`,
  doctor: `control-radar-mde doctor — read-only health check

Flags:
  --run-id <id>    Required (or RADAR_VERIFY_RUN_ID).

Checks, without clicking the UI:
  process        the recorded pid is alive and its command line is still next dev
  port           every listener on the run's port is in that process tree
  http           GET / is 200 and the HTML identifies Radar MDE
  revision       git HEAD still matches the revision recorded at launch

Exit 0 when ok is true. Exit 2 when the run exists but a check failed.
There is no auth cookie to validate: the site is public.
`,
  browser: `control-radar-mde browser — drive the running site

A background Chromium (Playwright, which speaks CDP) stays open for the run so a
dialog opened by one command is still there for the next. The profile directory is
per run, so localStorage does not leak into another run or a human's browser.
Viewport is 1440×900, locale pt-BR, color scheme light. Commands that click or fill
ignore elements that are not visible, which drops the duplicate phone navigation.

Subcommands:
  open <path>              Open a path on this run (example: /explorar or /mapa#sp)
  click                    Click one visible control
  fill                     Replace a field's value
  press --key <key>        Playwright key, for example Control+k or /
  wait                     Wait for a role, text, or url fragment
  find                     List matches instead of requiring exactly one
  text                     Print the accessible text of the one match
  snapshot --aria --path   Write an ARIA snapshot. Relative --path stays in evidence
  screenshot --path        Write a PNG. Add --full-page for the scrolled page
  url                      Print the current URL and document title
  clipboard                Read navigator.clipboard (after Copiar link)
  storage get --key <k>    Read localStorage
  storage set --key <k> --value <v>
                           Write localStorage and reload. Honors --dry-run.

Target flags (click, fill, wait, find, text, snapshot):
  --role <role>            ARIA role: button, link, tab, radio, option, dialog, heading, searchbox, combobox, menuitem
  --name <text>            Case-insensitive substring of the accessible name
  --name-regex <re>        Regular expression (case-insensitive) when several controls share a word
  --exact                  Accessible name must match --name in full
  --level <n>              Heading level, with --role heading
  --placeholder <text>     Input placeholder
  --label <text>           Label text
  --within-role <role>     Scope to one visible ancestor (navigation, dialog, region)
  --within-name <text>     Accessible name of that ancestor
  --include-hidden         Also match display:none duplicates
  --force                  Click even when pointer-events is none (map state labels)
  --timeout <ms>           Default 15000
  --download <path>        With click: wait for a file download and save it under evidence
  --full-page              With screenshot

If more than one control matches, the command fails and lists names. Narrow --name.
Do not pass a coordinate.
`,
  seed: `control-radar-mde seed — watchlist fixtures in this run's profile

The only user data is localStorage. seed watch edits radar-mde:watch, an array of
"uf/slug" ids such as sp/santo-andre. It does not touch the server or another browser.

Subcommands:
  seed watch list
  seed watch add --id sp/santo-andre
  seed watch remove --id sp/santo-andre
  seed watch clear

--dry-run reads the current list, reports the list it would write, and does not write.
Confirm that with seed watch list afterwards: the stored list is unchanged.
A fresh launch starts from an empty profile, which is the baseline for save-municipality.
`,
  http: `control-radar-mde http — request this run's origin

Subcommands:
  http get <path> [--save <file>]

<path> is a path such as /sp/santo-andre or /dados/csv/sp. Other hosts are rejected.
--save writes the body under the evidence directory when the path is relative.
JSON includes status, final URL, content type, byte size, and a short text preview.
`,
  logs: `control-radar-mde logs — dev server log

Flags:
  --tail <n>       Lines to return. Default 80.
  --save <file>    Also copy those lines into the evidence directory so they survive cleanup.

The raw log is inside the state directory and cleanup deletes it. Save a copy first
when the log is part of the proof.
`,
  evidence: `control-radar-mde evidence — proof files

Subcommands:
  evidence path    Print the absolute evidence directory
  evidence list    List files and sizes

cleanup never removes this directory. After cleanup, evidence list must still show
the screenshots and ARIA snapshots from the drive.
`,
  cleanup: `control-radar-mde cleanup — stop this run only

Flags:
  --dry-run        Print the pid and the state directory that would be removed. Do not signal, do not delete.
  --run-id <id>    Required.

Kills the recorded process group only when /proc/<pid>/cmdline still contains
next/dist/bin/next, and the browser daemon only when its command line contains
browser-daemon.mjs. Then it deletes the state directory (profile, sockets, server log).

It does not delete the evidence directory, other runs, or any process found by name.
Running cleanup twice is safe: the second run reports alreadyClean.
Verify a dry-run by running doctor afterwards; the server must still be healthy.
`,
};

/** @param {string[]} positionals */
export function helpFor(positionals) {
  const cmd = positionals[0];
  if (!cmd || cmd === "help") return ROOT;
  const text = COMMANDS[cmd];
  if (!text) {
    return `${ROOT}\nUnknown command ${JSON.stringify(cmd)}. Use one of: ${Object.keys(COMMANDS).join(", ")}.\n`;
  }
  return text;
}

export const commandNames = Object.keys(COMMANDS);
