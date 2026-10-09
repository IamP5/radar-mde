const ROOT = `control-radar-mde — launch and drive Radar MDE for verification

Radar MDE (web/) is a Next.js site. A person uses the browser: the national panel,
the immersive map, search, the municipality table, and the saved-municipality list.
There is no login and no server database. Municipalities a person saves live in
localStorage key radar-mde:watch inside this run's browser profile.

One checkout can run one next dev server. web/.next is shared, so a second server
in the same checkout is refused. Two checkouts can run side by side on different ports.

Usage:
  control-radar-mde <command> [subcommand] [flags]
  control-radar-mde <command> [subcommand] --help

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
Viewport starts at 1440×900 (change it with browser viewport), locale pt-BR, color
scheme light. Commands that click or fill ignore elements that are not visible,
which drops the navigation bar that the current width hides.

The browser never leaves the site. window.open to another origin, a click on a
mailto:, tel:, or external link, navigator.share, and any navigation to another
origin are blocked and recorded. Read them with browser outbound; a click that
triggered one also returns it under outbound.

Subcommands:
  open <path>              Open a path on this run (example: /explorar or /mapa#sp)
  click                    Click one visible control
  fill                     Replace a field's value
  press --key <key>        Playwright key, for example Control+k or /
  wait                     Wait for a role, text, or url fragment
  find                     List matches instead of requiring exactly one
  text                     Print the text of the one match (the value, for inputs and textareas)
  snapshot --aria --path   Write an ARIA snapshot. Relative --path stays in evidence
  screenshot --path        Write a PNG. Add --full-page for the scrolled page
  url                      Print the current URL and document title
  viewport                 Read or set the window size (--preset phone|tablet|desktop, or --width/--height)
  outbound                 List popups and outbound links the page tried to open
  clipboard                Read navigator.clipboard (after Copiar link)
  storage get --key <k>    Read localStorage
  storage set --key <k> --value <v>
                           Write localStorage and reload. Honors --dry-run.

Target flags (click, fill, wait, find, text, snapshot):
  --role <role>            ARIA role: button, link, tab, radio, option, dialog, heading, searchbox, combobox, menuitem, status, navigation
  --name <text>            Case-insensitive substring of the accessible name
  --name-regex <re>        Regular expression (case-insensitive) when several controls share a word
  --exact                  Accessible name must match --name in full
  --level <n>              Heading level, with --role heading
  --placeholder <text>     Input placeholder
  --label <text>           Label text
  --selector <css>         Playwright selector, when no role fits. Example: --selector "nav[aria-label=\\"Principal\\"]"
  --text <text>            With wait: visible text
  --text-regex <re>        With wait: visible text matching a regex
  --url-includes <text>    With wait: return when the current URL contains this
  --within-role <role>     Scope to one visible ancestor (navigation, dialog, region)
  --within-name <text>     Accessible name of that ancestor (substring)
  --within-name-regex <re> Ancestor name as a regular expression
  --within-exact           Ancestor name must match --within-name in full ("Nível" without "Nível do mapa")
  --include-hidden         Also match elements that are hidden (display:none, aria-hidden), with --role or --selector
  --force                  Click even when pointer-events is none (map state labels)
  --timeout <ms>           One budget for the whole command. Default 15000
  --download <path>        With click: wait for a file download and save it under evidence
  --expect-nav             With click: wait for the URL to change even though the target is not a link
  --full-page              With screenshot

If more than one control matches, the command fails and lists names. Narrow --name.
Do not pass a coordinate.

Headless Chromium does enter fullscreen from a click. On the map, Tela cheia
becomes Sair da tela cheia; assert that name, then click it to leave.
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
  http get <path> [--save <file>] [--fail-on-status]

<path> is a path such as /sp/santo-andre or /dados/csv/sp. Other hosts are rejected.
--save writes the body under the evidence directory when the path is relative.
JSON includes status, final URL, content type, byte size, and a short text preview.
A 404 exits 0 with status 404 unless --fail-on-status is set.
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

const SUBCOMMANDS = {
  "browser open": `control-radar-mde browser open <path>

Opens a path on this run's origin. Example: browser open /explorar or browser open "/mapa#sp".
The returned JSON includes the final url, document title, and HTTP status.
`,
  "browser click": `control-radar-mde browser click — click one visible control

Flags:
  --role <role>            Required with --name, unless --placeholder or --label is set
  --name <text>            Case-insensitive substring of the accessible name
  --name-regex <re>        When several controls share a word
  --exact                  Full accessible name
  --selector <css>         Instead of --role, when no role fits
  --download <path>        Wait for the file this click downloads and save it under evidence
  --expect-nav             Wait for the URL to change even though the target is not a link
  --force                  Click even when pointer-events is none
  --within-role <role>     Scope to one ancestor
  --within-name <text>     Accessible name of that ancestor
  --within-exact           Ancestor name must match in full
  --timeout <ms>           One budget for finding, clicking, and waiting. Default 15000

Before clicking, the CLI decides whether the click should navigate: a same-origin
link to another path or query, or a search result inside the dialog. Those wait
until the URL changes. Every other click (a toggle that renames, a row that
unmounts, a button that opens a dialog, a link to the current page) returns about
400 ms after the click.

JSON includes url, navigated, expectNav, and elapsedMs. With --download it also
includes download.path, download.suggestedFilename, and download.bytes. Read that
file to check CSV contents. If the click opened a popup or an outbound link, the
JSON has outbound entries (kind, url, target) and the page stayed on the site.

If a navigating click does not change the URL within --timeout, the command fails
with clicked: true. Do not click again; run browser wait --url-includes <path>.
If more than one control matches, the command lists names and does not click.
`,
  "browser fill": `control-radar-mde browser fill — replace one field's value

Flags:
  --role <role>     searchbox or combobox
  --name <text>     Accessible name
  --value <text>    Required. The new field value.

Name filters in Explorar write the URL after a short pause. Follow fill with
browser wait --url-includes q= before asserting the table.
`,
  "browser press": `control-radar-mde browser press --key <key>

Playwright key name. Example: browser press --key Control+k opens search.
"/" also opens search unless focus is already in a field.
`,
  "browser wait": `control-radar-mde browser wait — wait for a role, text, or URL

Flags:
  --role <role> --name <text>     One visible control
  --text <text>                   Visible text
  --text-regex <re>               Visible text matching a regex
  --url-includes <text>           Current URL contains this fragment
  --timeout <ms>                  Default 15000

Example: browser wait --role dialog --name "Buscar município, estado ou região"
`,
  "browser find": `control-radar-mde browser find — list matches, do not click

Same target flags as click. JSON includes count and samples. Use it when a click
refuses because more than one control matched.

--include-hidden counts elements outside the accessibility tree too, such as the
navigation bar the current width hides with display:none. Example:
  browser find --role navigation --name Principal --include-hidden   (count 2)
  browser find --role navigation --name Principal                    (count 1)
`,
  "browser text": `control-radar-mde browser text — text of the one match

Same target flags as click. Refuses when the count is not one.
For input, textarea, and select, text is the current value (source: "value").
For anything else it is the rendered text (source: "innerText").
`,
  "browser viewport": `control-radar-mde browser viewport — read or set the window size

  browser viewport                         Print width, height, and preset
  browser viewport --preset phone          390×844 (below the 460 px breakpoint)
  browser viewport --preset tablet         768×1024
  browser viewport --preset desktop        1440×900 (the default)
  browser viewport --width 375 --height 812

The size is kept for the rest of the run, including after the browser daemon
restarts. Set --preset desktop again before a recipe that assumes 1440×900.
Below md width (768 px) the header shows the second navigation bar, and the
desktop one is hidden; at 390 px Metodologia is labeled Método.
`,
  "browser outbound": `control-radar-mde browser outbound — what tried to leave the site

The browser blocks and records, without leaving Radar MDE:
  window.open to another origin         kind "window.open" (WhatsApp share)
  a click on mailto:, tel:, or another origin   kind "link" (E-mail, WhatsApp buttons)
  navigator.share                        kind "share" (only where the browser has it)
  a top-level navigation elsewhere       kind "navigation"
  a same-origin popup                    kind "popup" (closed after it loads)

Flags:
  --since <n>    Skip the first n entries (use total from an earlier call)
  --clear        Empty the list after printing it

Entries live in the browser daemon and are lost when cleanup stops it.
`,
  "browser snapshot": `control-radar-mde browser snapshot --aria --path <file>

Writes an ARIA snapshot. A relative --path stays inside the evidence directory.
A path with .. is rejected. Add --role and --name to snapshot one control.
`,
  "browser screenshot": `control-radar-mde browser screenshot --path <file> [--full-page]

Writes a PNG. A relative --path stays inside the evidence directory.
`,
  "browser url": `control-radar-mde browser url

Prints the current URL and document title. Read-only.
`,
  "browser clipboard": `control-radar-mde browser clipboard

Reads navigator.clipboard. Click Copiar link first.
`,
  "browser storage": `control-radar-mde browser storage — localStorage in this run's profile

Subcommands:
  storage get --key <k>
  storage set --key <k> --value <v> [--dry-run]

--dry-run reports from and to and sets wrote to false. Confirm with storage get:
the stored value is still from. Prefer seed watch for radar-mde:watch.
`,
  "seed watch": `control-radar-mde seed watch — the saved-municipality list

Subcommands:
  seed watch list
  seed watch add --id sp/santo-andre
  seed watch remove --id sp/santo-andre
  seed watch clear

add, remove, and clear accept --dry-run. Dry-run sets wrote to false and reports
from and to. Run seed watch list afterwards and confirm the ids still match from.
A fresh launch starts from an empty profile.
`,
  "http get": `control-radar-mde http get <path> [--save <file>] [--fail-on-status]

GET a path on this run's origin, such as /sp/santo-andre or /dados/csv/sp.
Other hosts are rejected. --save writes the body under the evidence directory
when the path is relative. JSON includes status, statusOk, url, content type,
bytes, and a short text preview. http has no other subcommand.

A 404 or 500 is still a successful request: exit 0, ok true, status 404. Assert
on status. Add --fail-on-status to exit 1 when the status is 4xx or 5xx.
`,
  "evidence path": `control-radar-mde evidence path

Prints the absolute evidence directory. cleanup does not delete it.
`,
  "evidence list": `control-radar-mde evidence list

Lists proof files and sizes. Still works after cleanup.
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
  const sub = positionals[1];
  if (!sub) return text;
  const two = SUBCOMMANDS[`${cmd} ${sub}`];
  const three = positionals[2] ? SUBCOMMANDS[`${cmd} ${sub} ${positionals[2]}`] : undefined;
  if (three) return three;
  if (two) return two;
  return `${text}\nNo separate help for ${JSON.stringify(positionals.slice(1).join(" "))}. The subcommands are listed above.\n`;
}

export const commandNames = Object.keys(COMMANDS);
