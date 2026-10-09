---
name: verify-radar-mde
description: >-
  Verify Radar MDE, the Next.js web panel of Brazilian municipal education
  spending (MDE) in web/. Use when changing the panel, search, map, explorer,
  saved-municipality list, or any page a person sees, and you need to launch
  the app, drive it in a browser, and capture proof.
---

# Verify Radar MDE

Radar MDE is a browser app. A person opens the national panel, searches for a municipality, filters the national table, flies the map, and saves cities in this browser. The control CLI is `./scripts/control-radar-mde` from the repo root. Feature recipes live in [features/README.md](features/README.md). Read the index, then the one feature file, and run its commands literally.

There is no login and no server database. Figures come from JSON already in `web/src/data`. The only user state is localStorage in the run's browser profile (`radar-mde:watch` for saved municipalities, `radar-mde:recent-search` for recent searches, `theme` for the theme). One checkout can run one `next dev` because `web/.next` is shared. A second checkout can run its own server on another port.

## Launch

### Cloud agent

This repository's saved Cursor cloud environment runs the same steps as `scripts/cloud-agent-install.sh` before it snapshots: `npm ci` in `web/`, `npm ci` in `scripts/control/`, then Playwright's Chromium and the system libraries that browser needs. An agent that boots from that snapshot already has `web/node_modules`, `scripts/control/node_modules`, and Chromium under `~/.cache/ms-playwright`. The dev server is not started at boot. Skip the install and start here:

```bash
./scripts/control-radar-mde launch
```

Stdout is JSON. Export `RADAR_VERIFY_RUN_ID` from `runId`, then run `doctor`, then the feature recipe. Run `cleanup` when the recipe is done so the next command can use `web/.next`.

If `web/node_modules/next` is missing, or a browser command says Chromium is not installed (a branch changed a lockfile, or this VM did not boot from the snapshot), run `bash scripts/cloud-agent-install.sh` once and then launch. Do not start `next dev` by hand.

### When dependencies are missing

```bash
bash scripts/cloud-agent-install.sh
```

That script is idempotent. It uses `npm ci` (the lockfile, not a floating install) and installs Chromium for the user who will run the CLI.

Start the server and wait until the home page identifies itself:

```bash
./scripts/control-radar-mde launch
```

Stdout is JSON. `ready: true` and a title containing `Radar MDE` means the server is up. `url` is `http://127.0.0.1:<port>` (the search starts at 4173). Export the id before any other command:

```bash
export RADAR_VERIFY_RUN_ID=<runId from the JSON>
```

Pass `--port` only when you need a specific port. If that port is taken, the command stops and tells you what to run; it does not attach to a foreign process. Pass `--timeout 180000` (the default) on a cold compile. `NEXT_TELEMETRY_DISABLED` is set. `VERCEL_*` and `NEXT_PUBLIC_SITE_URL` are removed from the child so links stay on this origin.

The server is a new process group whose command line contains `next/dist/bin/next`. Re-running launch with the same live `--run-id` returns that server and does not start another. Launch against a checkout that already has a live run fails and names the blocking run id.

## Doctor

```bash
./scripts/control-radar-mde doctor
```

Read-only. Require `ok: true` and every flag in `checks` true before driving:

- `process` — the recorded pid is alive and its command line is still next dev
- `port` — every listener on that port is in that process tree
- `http` — `GET /` is 200 and the HTML contains Radar MDE
- `revision` — `git HEAD` matches the revision stored at launch

`auth` is `none`. Do not look for a session cookie. Exit code 2 means the run record exists but a check failed; follow `hint`. Do not drive a server this CLI did not start.

## Drive

Drive from the recipes in `features/`. Every browser command goes through `./scripts/control-radar-mde browser`, which keeps one Chromium (Playwright over CDP) open for the run. Viewport is 1440×900, locale `pt-BR`, color scheme light. Clicks ignore elements that are not visible, so the phone navigation (in the DOM, `display: none` at this width) is not the target.

Stable handles, from the UI:

- Header search button: role `button`, name `Buscar município, estado ou região`. Home CTA: role `button`, name `Digite o nome da sua cidade`.
- Search dialog: role `dialog`, name `Buscar município, estado ou região`. Field: role `combobox`, name `Buscar`. Results: role `option`.
- Header links: role `link` inside role `navigation` named `Principal`. Names: `Painel`, `Mapa`, `Explorar`, `Salvos`, `Dados`, `Metodologia`.
- Year control: role `button` name `Ano anterior` or `Próximo ano`, radios inside role `radiogroup` named `Exercício`.
- Explorer filter: role `searchbox` name `Buscar município pelo nome`. UF filter: role `combobox` name `UF`, then role `option`.
- Save control on a city page: role `button` name `Salvar` (becomes `Salvo`). Removal: role `button` name `Remover <city> dos salvos`.
- Map shell: role `application` whose name starts with `Mapa do Brasil`. Indicator tabs: role `tab` inside `Indicador do mapa` (`% em educação`, `Fundeb`, `R$ por aluno`, `Anos abaixo`).

If a command reports more than one match, it lists names and does not click. Tighten `--name` or add `--name-regex`. Do not pass coordinates.

Keyboard: `./scripts/control-radar-mde browser press --key Control+k` opens search. `/` does too, unless focus is in a field. Side effects that are not on screen are `browser storage get --key radar-mde:watch` and `http get <path>`.

## Evidence

Proof is the person-facing action and the state it left behind. Screenshots and ARIA snapshots go under the run's evidence directory (`evidenceDir` from launch, default `/tmp/radar-mde-verify-evidence/<run-id>`):

```bash
./scripts/control-radar-mde browser screenshot --full-page --path save-municipality/list.png
./scripts/control-radar-mde browser snapshot --aria --path save-municipality/list.aria.txt
./scripts/control-radar-mde logs --save save-municipality/next.log
```

Relative `--path` values stay inside that directory. A path with `..` is rejected. Absolute paths are written where you name them and are also left alone by cleanup.

A UI proof needs the screenshot (the header shows Radar MDE) and the ARIA snapshot. A mutation proof also needs a second view: open `/acompanhar` after Salvar, and read `radar-mde:watch`. A CSV proof uses `browser click --download <file>` or `http get /dados/csv/sp --save sp.csv`, then read the file. Record the feature id and the entry point next to the artifacts.

`--dry-run` on `seed watch` and `browser storage set` prints `from` and `to` and sets `wrote: false`. Run `seed watch list` or `storage get` afterwards and confirm the stored value is still `from`.

## Cleanup

Stop only this run. Preview first:

```bash
./scripts/control-radar-mde cleanup --dry-run
./scripts/control-radar-mde doctor
```

Doctor must still be healthy. Then:

```bash
./scripts/control-radar-mde cleanup
./scripts/control-radar-mde evidence list
```

Cleanup signals the recorded next process group only when `/proc/<pid>/cmdline` still contains `next/dist/bin/next`, and the browser daemon only when its command line contains `browser-daemon.mjs`. It deletes the state directory (profile, socket, server log). It does not delete the evidence directory, other runs, or anything found by process name. `evidence list` still works after cleanup. A second cleanup returns `alreadyClean: true`.

Run cleanup after a failed drive too, so the checkout is not left holding `web/.next`.

## Helpers

| Command | What it does |
| --- | --- |
| `./scripts/control-radar-mde launch` | Start next dev and wait for Radar MDE |
| `./scripts/control-radar-mde doctor` | Read-only health check |
| `./scripts/control-radar-mde browser …` | Click, fill, snapshot, screenshot, storage |
| `./scripts/control-radar-mde seed watch …` | Seed `radar-mde:watch` in this profile |
| `./scripts/control-radar-mde http get <path>` | Fetch a page or CSV on this origin |
| `./scripts/control-radar-mde logs --save <file>` | Copy the server log into evidence |
| `./scripts/control-radar-mde evidence list` | List proof files |
| `./scripts/control-radar-mde cleanup` | Stop this run only |

The script is executable. `node scripts/control/cli.mjs` is the same program. Tests that do not need a browser:

```bash
node --test scripts/control/test/cli.test.mjs
```

`seed watch add --id sp/santo-andre` is how you arrange the saved list before a recipe that starts from a non-empty baseline. A fresh launch already has an empty profile, which is the baseline for saving a city. Do not point the CLI at a human's Chrome profile.

## Upkeep

When routes, accessible names, or this CLI change, update the feature file in the same change. Keep the skill current with `/maintain-verification-skill`.
