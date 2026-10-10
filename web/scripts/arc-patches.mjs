#!/usr/bin/env node
// Arc components are copied in by `npx shadcn add @uiarc/<id>`. Re-adding one with --overwrite restores
// upstream English copy and drops the local props below; run `node scripts/arc-patches.mjs` afterwards.
// `--check` exits 1 when any patch is missing (npm test runs it).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/components/arc");

export const PATCHES = {
  "dialog/dialog.tsx": [['aria-label="Close dialog"', 'aria-label="Fechar"']],
  "progress/progress.tsx": [['aria-label={label ?? "Progress"}', 'aria-label={label ?? "Progresso"}']],
  "search-field/search-field.tsx": [['aria-label="Clear search"', 'aria-label="Limpar busca"']],
  "select/select.tsx": [['placeholder = "Select an option"', 'placeholder = "Selecione uma opção"']],
  "skeleton/skeleton.tsx": [['label = "Loading content"', 'label = "Carregando"']],
  "tabs/tabs.tsx": [
    ['aria-label="Scroll tabs left"', 'aria-label="Rolar abas para a esquerda"'],
    ['aria-label="Scroll tabs right"', 'aria-label="Rolar abas para a direita"'],
  ],
  "theme-switch/theme-switch.tsx": [
    ["aria-label={label ?? `Switch to ${next} mode`}", 'aria-label={label ?? (next === "dark" ? "Usar tema escuro" : "Usar tema claro")}'],
    [">Switch theme<", ">Alternar tema<"],
  ],
  // Print styles hide buttons by this hook; module class names are hashed in production builds.
  "button/button.tsx": [["<motion.button\n      ref={setRefs}", "<motion.button\n      data-slot=\"button\"\n      ref={setRefs}"]],
  // Several menus share one visible word ("Exportar"); the trigger needs a distinct accessible name.
  "dropdown-menu/dropdown-menu.tsx": [
    ["export interface DropdownMenuProps { label: string; items: DropdownItem[]; icon?: ReactNode; }", "export interface DropdownMenuProps { label: string; items: DropdownItem[]; icon?: ReactNode; ariaLabel?: string; }"],
    ["export function DropdownMenu({ label, items, icon }: DropdownMenuProps) {", "export function DropdownMenu({ label, items, icon, ariaLabel }: DropdownMenuProps) {"],
    ['<DropdownPrimitive.Trigger className={styles.trigger} type="button">', '<DropdownPrimitive.Trigger className={styles.trigger} type="button" aria-label={ariaLabel}>'],
  ],
};

// Arc passes Base UI's `render` prop to Radix primitives, which ignore it and spread it onto the DOM,
// so the motion element never mounts. Radix composes through `asChild`.
const RENDER_FILES = ["dialog/dialog.tsx", "tabs/tabs.tsx"];
const RENDER_PROP = /\srender=\{<motion\.div ([\s\S]*?) \/>\}>([\s\S]*?)<\/((?:Dialog|Tabs)Primitive\.\w+)>/g;

export function missingPatches() {
  const missing = [];
  for (const [file, pairs] of Object.entries(PATCHES)) {
    const src = readFileSync(path.join(root, file), "utf8");
    for (const [, to] of pairs) if (!src.includes(to)) missing.push(`${file}: ${to}`);
  }
  for (const file of RENDER_FILES) {
    if (readFileSync(path.join(root, file), "utf8").includes("render={<motion.")) missing.push(`${file}: render prop on a Radix primitive`);
  }
  return missing;
}

function apply() {
  for (const [file, pairs] of Object.entries(PATCHES)) {
    const p = path.join(root, file);
    let src = readFileSync(p, "utf8");
    for (const [from, to] of pairs) {
      if (src.includes(to)) continue;
      if (!src.includes(from)) throw new Error(`${file}: upstream text changed, update the patch for: ${from}`);
      src = src.replaceAll(from, to);
    }
    writeFileSync(p, src);
  }
  for (const file of RENDER_FILES) {
    const p = path.join(root, file);
    const src = readFileSync(p, "utf8");
    writeFileSync(p, src.replace(RENDER_PROP, (_, attrs, children, tag) => ` asChild><motion.div ${attrs}>${children}</motion.div></${tag}>`));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    const missing = missingPatches();
    if (missing.length) {
      console.error(`Arc patches missing (run node scripts/arc-patches.mjs):\n${missing.join("\n")}`);
      process.exit(1);
    }
  } else {
    apply();
  }
}
