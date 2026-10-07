"use client";

import { Check, Download, FileCode2, FileSpreadsheet, ImageDown, Quote, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { csvFilename, downloadCsv, toCsv, type CsvRecord } from "@/lib/csv";
import { currentPageUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

export type ChartCsv = {
  /** Column keys, in order (header row). */
  columns: string[];
  rows: CsvRecord[];
};

/**
 * One legend entry drawn into the exported image.
 * `kind`: "line" (default; `dash` = SVG dasharray, or true for "4 3"), "swatch" (filled square, map bins),
 * "dot" (filled circle), "ring" (hollow circle, e.g. "fora do padrão" markers), "hatch" (diagonal lines, e.g. "não declarou").
 */
export type ChartLegendItem = {
  label: string;
  color: string;
  kind?: "line" | "swatch" | "dot" | "ring" | "hatch";
  dash?: string | boolean;
};

/**
 * Export menu for a chart/map Panel (`<Panel action={<ChartActions … />}>`): PNG, SVG, CSV of the chart's rows, a
 * ready citation and, on phones, "Compartilhar imagem". The exported image is the chart's own SVG with the title, a
 * legend and a wrapped source footer drawn in, every computed style inlined and theme colors resolved.
 * See qa/fixes/CONTRACT-design.md.
 */
export function ChartActions({
  title, filename, csv, legend, svgSelector, getSvg, source = "FNDE/SIOPE", note, className,
}: {
  /** Chart title: drawn on the image and used in the citation. Name the metric, place and years. */
  title: string;
  /** File name parts without extension, e.g. ["santo-andre", "mde"] → radar-mde_santo-andre_mde.png. */
  filename: (string | number | null | undefined | false)[];
  /** Rows behind the chart. Omit to hide the CSV items. Numbers are rounded to at most 4 decimals. */
  csv?: ChartCsv;
  /** Legend drawn under the chart in the image. When omitted, the Panel's on-screen legend (`li` with an aria-hidden marker) is collected. Pass [] for none. */
  legend?: ChartLegendItem[];
  /** CSS selector of the svg inside the enclosing Panel (default: the largest non-icon svg). */
  svgSelector?: string;
  /** Explicit svg lookup (wins over svgSelector). */
  getSvg?: () => SVGSVGElement | null;
  /** Source line on the image and in the citation. */
  source?: string;
  /** Extra footer line on the image (e.g. "Valores nominais"). */
  note?: string;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState("");
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(t);
  }, [status]);
  useEffect(() => {
    // touch devices with the Web Share API for files (WhatsApp etc.): only readable after hydration
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    let files = false;
    try {
      files = !!navigator.canShare?.({ files: [new File([""], "x.png", { type: "image/png" })] });
    } catch {
      files = false;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator/matchMedia are only readable after hydration
    setCanShare(!!coarse && files);
  }, []);

  const base = csvFilename(filename).replace(/\.csv$/, "");
  const findSvg = () => getSvg?.() ?? pickSvg(ref.current, svgSelector);

  const image = async (kind: "png" | "svg") => {
    const svg = findSvg();
    if (!svg) throw new Error("svg");
    const items = legend ?? collectLegend(svg);
    const { markup, width, height } = buildExport(svg, { title, source, note, url: currentPageUrl(), legend: items });
    return kind === "svg" ? new Blob([markup], { type: "image/svg+xml;charset=utf-8" }) : rasterize(markup, width, height, 2);
  };

  const exportImage = async (kind: "png" | "svg") => {
    try {
      save(`${base}.${kind}`, await image(kind));
      setStatus(kind === "png" ? "PNG baixado" : "SVG baixado");
    } catch {
      setStatus("Não foi possível exportar");
    }
  };

  const shareImage = async () => {
    try {
      const file = new File([await image("png")], `${base}.png`, { type: "image/png" });
      await navigator.share({ files: [file], title, text: citation(title, source) });
      setStatus("Imagem compartilhada");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setStatus("Não foi possível compartilhar");
    }
  };

  const copyCitation = async () => {
    const text = citation(title, source);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Citação copiada");
    } catch {
      window.prompt("Copie a citação:", text);
    }
  };

  const ok = status && !status.startsWith("Não");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button ref={ref} variant="ghost" size="icon" aria-label={`Exportar: ${title}`} title="Baixar, compartilhar ou citar" className={cn("text-muted-foreground print:hidden", className)}>
              {ok ? <Check className="text-good-ink" /> : <Download />}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-60">
          {canShare && (
            <>
              <DropdownMenuItem onClick={shareImage}>
                <Share2 className="text-muted-foreground" />
                Compartilhar imagem…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Baixar gráfico</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => exportImage("png")}>
              <ImageDown className="text-muted-foreground" />
              Imagem PNG
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportImage("svg")}>
              <FileCode2 className="text-muted-foreground" />
              Imagem SVG (editável)
            </DropdownMenuItem>
            {csv && (
              <DropdownMenuItem onClick={() => downloadCsv(`${base}.csv`, toCsv(csv.columns, roundRows(csv.rows)))}>
                <FileSpreadsheet className="text-muted-foreground" />
                Dados em CSV
              </DropdownMenuItem>
            )}
            {csv && (
              <DropdownMenuItem onClick={() => downloadCsv(`${base}_excel.csv`, toCsv(csv.columns, roundRows(csv.rows), { excel: true }))}>
                <FileSpreadsheet className="text-muted-foreground" />
                Dados em CSV (Excel Brasil)
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyCitation}>
            <Quote className="text-muted-foreground" />
            Copiar citação
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  );
}

/* ----------------------------------------------------------------------------------------------------------- */

/** "Radar MDE (2026). <título>. <url>. Fonte: FNDE/SIOPE. Acesso em 07/10/2026." (origin via lib/site `siteUrl()`). */
export function citation(title: string, source = "FNDE/SIOPE", date = new Date()) {
  const t = title.replace(/\.\s*$/, "");
  return `Radar MDE (${date.getFullYear()}). ${t}. ${currentPageUrl()}. Fonte: ${source}. Acesso em ${date.toLocaleDateString("pt-BR")}.`;
}

/** At most 4 decimals, no float artefacts (28.244999999999997 → 28.245). */
export const roundNum = (v: number) => (Number.isFinite(v) ? Number(v.toFixed(4)) : v);
const roundRows = (rows: CsvRecord[]) =>
  rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? roundNum(v) : v])) as CsvRecord);

/** The chart svg of the Panel that holds the button: the selector, or the largest svg that isn't an icon. */
function pickSvg(from: HTMLElement | null, selector?: string): SVGSVGElement | null {
  const scope = from?.closest("section") ?? document;
  if (selector) return scope.querySelector<SVGSVGElement>(selector);
  let best: SVGSVGElement | null = null;
  let area = 0;
  for (const s of scope.querySelectorAll<SVGSVGElement>("svg")) {
    if (s.classList.contains("lucide") || s.closest("button,[role=menu]")) continue;
    const r = s.getBoundingClientRect();
    if (r.width * r.height > area) {
      area = r.width * r.height;
      best = s;
    }
  }
  return best;
}

const visibleColor = (c: string) => !!c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c);

/**
 * Fallback legend: the Panel's on-screen legend rows — `li` elements outside the chart svg whose first child is an
 * aria-hidden marker (span swatch/line or small svg) followed by text.
 */
function collectLegend(chart: SVGSVGElement): ChartLegendItem[] {
  const scope = chart.closest("section");
  if (!scope) return [];
  const out: ChartLegendItem[] = [];
  for (const li of scope.querySelectorAll("li")) {
    if (li.closest("table,[role=menu],nav") || chart.contains(li)) continue;
    const mark = li.querySelector<HTMLElement | SVGElement>("[aria-hidden]");
    const label = (li.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!mark || !label || label.length > 60 || mark.getBoundingClientRect().width > 32) continue;
    const item = markerToItem(mark, label);
    if (item && !out.some((o) => o.label === item.label)) out.push(item);
  }
  return out;
}

function markerToItem(mark: HTMLElement | SVGElement, label: string): ChartLegendItem | null {
  if (mark instanceof SVGElement) {
    const shape = mark.querySelector("line,path,circle,rect");
    if (!shape) return null;
    const cs = getComputedStyle(shape);
    if (shape.tagName === "circle") {
      const filled = visibleColor(cs.fill) && cs.fill !== getComputedStyle(document.body).backgroundColor;
      return { label, color: visibleColor(cs.stroke) && !filled ? cs.stroke : cs.fill, kind: filled ? "dot" : "ring" };
    }
    if (shape.tagName === "rect") return { label, color: cs.fill, kind: "swatch" };
    const dash = cs.strokeDasharray && cs.strokeDasharray !== "none" ? cs.strokeDasharray : undefined;
    return { label, color: cs.stroke, kind: "line", dash };
  }
  const cs = getComputedStyle(mark);
  if (cs.backgroundImage.includes("gradient")) {
    const c = cs.backgroundImage.match(/rgba?\([^)]*\)/)?.[0];
    return { label, color: c ?? cs.color, kind: "hatch" };
  }
  const r = mark.getBoundingClientRect();
  if (visibleColor(cs.backgroundColor)) {
    const round = parseFloat(cs.borderRadius) >= r.height / 2 && Math.abs(r.width - r.height) < 1;
    return { label, color: cs.backgroundColor, kind: r.height <= 3 ? "line" : round ? "dot" : "swatch" };
  }
  if (cs.borderTopStyle !== "none" && parseFloat(cs.borderTopWidth) > 0) {
    return { label, color: cs.borderTopColor, kind: "line", dash: cs.borderTopStyle === "dotted" ? "1 2" : cs.borderTopStyle === "dashed" ? "4 3" : undefined };
  }
  return null;
}

/** Presentation properties copied from the computed style onto each exported node (resolves var(), classes, theme). */
const PROPS = [
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "stroke-linecap", "stroke-linejoin",
  "opacity", "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor", "dominant-baseline",
  "stop-color", "stop-opacity", "visibility", "paint-order", "font-variant-numeric",
] as const;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  const decl = PROPS.map((p) => {
    const v = cs.getPropertyValue(p);
    return v && v !== "normal" && v !== "auto" ? `${p}:${v}` : "";
  }).filter(Boolean);
  if (cs.display === "none") decl.push("display:none");
  dst.setAttribute("style", decl.join(";"));
  dst.removeAttribute("class");
  dst.removeAttribute("tabindex");
  dst.removeAttribute("role");
  dst.removeAttribute("data-id");
  // var(--x) left in presentation attributes would not resolve outside the page
  for (const a of ["fill", "stroke", "stop-color"]) if (dst.getAttribute(a)?.includes("var(")) dst.removeAttribute(a);
  const sc = src.children;
  const dc = dst.children;
  for (let i = 0; i < sc.length; i++) inlineStyles(sc[i], dc[i]);
}

/** Text measurement with the page font (falls back to an average glyph width). */
function measurer(font: string) {
  const ctx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  return (s: string, size: number, weight = 400) => {
    if (!ctx) return s.length * size * 0.56;
    ctx.font = `${weight} ${size}px ${font}`;
    return ctx.measureText(s).width;
  };
}

/** Greedy word wrap to `max` px; words longer than a line (URLs) are broken at "/", "?", "&" or by characters. */
function wrapPx(s: string, max: number, measure: (s: string) => number) {
  const tokens = s.split(/(\s+)/).filter((t) => t.trim()).flatMap((w) => {
    if (measure(w) <= max) return [w];
    const parts = w.split(/(?<=[/?&=-])/);
    const out: string[] = [];
    let cur = "";
    for (const p of parts) {
      if (cur && measure(cur + p) > max) {
        out.push(cur);
        cur = "";
      }
      // still too long: hard break by characters
      let rest = p;
      while (measure(rest) > max) {
        let n = rest.length;
        while (n > 1 && measure(rest.slice(0, n)) > max) n--;
        out.push(rest.slice(0, n));
        rest = rest.slice(n);
      }
      cur += rest;
    }
    if (cur) out.push(cur);
    return out.map((t, i) => (i < out.length - 1 ? `${t}\u0000` : t)); // \0 = glue (no space) to the next piece
  });
  const lines: string[] = [];
  let line = "";
  let glue = false;
  for (const raw of tokens) {
    const t = raw.replace(/\u0000$/, "");
    const cand = line ? (glue ? line + t : `${line} ${t}`) : t;
    if (line && measure(cand) > max) {
      lines.push(line);
      line = t;
    } else line = cand;
    glue = raw.endsWith("\u0000");
  }
  if (line) lines.push(line);
  return lines;
}

function legendMarker(it: ChartLegendItem, x: number, cy: number) {
  const c = esc(it.color);
  switch (it.kind) {
    case "swatch":
      return `<rect x="${x + 0.5}" y="${cy - 4.5}" width="9" height="9" rx="2" fill="${c}" stroke="rgba(128,128,128,0.45)" stroke-width="1"/>`;
    case "dot":
      return `<circle cx="${x + 5}" cy="${cy}" r="4" fill="${c}"/>`;
    case "ring":
      return `<circle cx="${x + 6}" cy="${cy}" r="4" fill="none" stroke="${c}" stroke-width="2"/>`;
    case "hatch":
      return `<rect x="${x}" y="${cy - 5}" width="10" height="10" rx="2" fill="none" stroke="${c}" stroke-opacity="0.5"/>` +
        [0, 4, 8].map((o) => `<line x1="${x + o}" y1="${cy + 5}" x2="${x + o + 5}" y2="${cy - 5}" stroke="${c}" stroke-width="1"/>`).join("");
    default: {
      const dash = it.dash === true ? "4 3" : it.dash || "";
      return `<line x1="${x}" y1="${cy}" x2="${x + 18}" y2="${cy}" stroke="${c}" stroke-width="2"${dash ? ` stroke-dasharray="${esc(String(dash))}"` : ""}/>`;
    }
  }
}

function buildExport(
  svg: SVGSVGElement,
  { title, source, note, url, legend }: { title: string; source: string; note?: string; url: string; legend: ChartLegendItem[] },
) {
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox?.baseVal;
  const w = Math.round(vb && vb.width ? vb.width : box.width);
  const h = Math.round(vb && vb.height ? vb.height : box.height);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);

  const panel = svg.closest("section") ?? document.body;
  const bg = opaque(getComputedStyle(panel).backgroundColor) ?? opaque(getComputedStyle(document.body).backgroundColor) ?? "#ffffff";
  const ink = getComputedStyle(panel).color || "#171717";
  const muted = getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim() || "#666666";
  const font = `${getComputedStyle(document.body).fontFamily}, system-ui, sans-serif`.replace(/"/g, "'");
  const measure = measurer(font);

  const pad = 20;
  const width = Math.max(w + pad * 2, 520);
  const inner = width - pad * 2;
  const parts: string[] = [];
  const text = (x: number, y: number, s: string, size: number, color: string, weight = 400) =>
    `<text x="${x}" y="${y}" font-family="${esc(font)}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(s)}</text>`;

  // title
  let y = pad;
  for (const l of wrapPx(title, inner, (s) => measure(s, 16, 600))) {
    parts.push(text(pad, y + 15, l, 16, ink, 600));
    y += 22;
  }
  y += 10;

  // chart
  clone.setAttribute("x", String((width - w) / 2));
  clone.setAttribute("y", String(y));
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  for (const a of ["aria-hidden", "aria-label", "style", "class"]) clone.removeAttribute(a);
  parts.push(new XMLSerializer().serializeToString(clone));
  y += h + 12;

  // legend: wrapped row of marker + label (var(--x) / color-mix resolved against the panel, so it works outside the page)
  legend = legend.map((it) => ({ ...it, color: resolveColor(it.color, panel) }));
  if (legend.length) {
    let x = pad;
    const rowH = 18;
    y += 2;
    for (const it of legend) {
      const mw = it.kind === "line" || !it.kind ? 18 : 12;
      const tw = measure(it.label, 12);
      const iw = mw + 6 + tw;
      if (x > pad && x + iw > width - pad) {
        x = pad;
        y += rowH;
      }
      parts.push(legendMarker(it, x, y + 6));
      parts.push(text(x + mw + 6, y + 10, it.label, 12, ink));
      x += iw + 16;
    }
    y += rowH + 4;
  }

  // footer: source, URL (own line, wrapped), note — never clipped
  const foot = [`Fonte: ${source}. Radar MDE · Brasil.`, url, note].filter(Boolean) as string[];
  y += 4;
  for (const f of foot) {
    for (const l of wrapPx(f, inner, (s) => measure(s, 11))) {
      parts.push(text(pad, y + 11, l, 11, muted));
      y += 15;
    }
  }
  const height = Math.ceil(y + pad - 4);

  const markup = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${esc(title)}</title>`,
    `<rect width="100%" height="100%" fill="${bg}"/>`,
    ...parts,
    `</svg>`,
  ].join("\n");
  return { markup, width, height };
}

/** Any CSS color (var(--series-1), color-mix, named) → the computed rgb() in the given scope (theme-aware). */
function resolveColor(color: string, scope: Element) {
  if (!/var\(|color-mix|currentcolor/i.test(color)) return color;
  const probe = document.createElement("span");
  probe.style.color = color;
  probe.style.display = "none";
  scope.appendChild(probe);
  const out = getComputedStyle(probe).color;
  probe.remove();
  return out || color;
}

function opaque(c: string | undefined) {
  if (!c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c)) return null;
  return c;
}

function rasterize(markup: string, width: number, height: number, scale: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg"));
    };
    img.src = url;
  });
}

function save(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
