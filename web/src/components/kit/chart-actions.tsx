"use client";

import { Check, Download, FileCode2, FileSpreadsheet, ImageDown, Quote } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { csvFilename, downloadCsv, toCsv, type CsvRecord } from "@/lib/csv";
import { SITE_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export type ChartCsv = {
  /** Column keys, in order (header row). */
  columns: string[];
  rows: CsvRecord[];
};

/**
 * Export menu for a chart/map Panel (`<Panel action={<ChartActions … />}>`): PNG, SVG, CSV of the chart's rows and a
 * ready citation. The exported image is the chart's own SVG with a title and source footer drawn in, every computed
 * style inlined and theme colors resolved (it looks the same outside the site). See qa/fixes/CONTRACT-design.md.
 */
export function ChartActions({
  title, filename, csv, svgSelector, getSvg, source = "FNDE/SIOPE", note, className,
}: {
  /** Chart title: drawn on the image and used in the citation, e.g. "% aplicado em MDE — Santo André (SP), 2008–2025". */
  title: string;
  /** File name parts without extension, e.g. ["santo-andre", "mde"] → radar-mde_santo-andre_mde.png. */
  filename: (string | number | null | undefined | false)[];
  /** Rows behind the chart. Omit to hide "Baixar CSV". */
  csv?: ChartCsv;
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
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(""), 2500);
    return () => clearTimeout(t);
  }, [status]);

  const base = csvFilename(filename).replace(/\.csv$/, "");
  const findSvg = () => getSvg?.() ?? pickSvg(ref.current, svgSelector);

  const exportImage = async (kind: "png" | "svg") => {
    const svg = findSvg();
    if (!svg) return setStatus("Gráfico não encontrado");
    try {
      const { markup, width, height } = buildExport(svg, { title, source, note, url: pageUrl() });
      if (kind === "svg") {
        save(`${base}.svg`, new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
      } else {
        save(`${base}.png`, await rasterize(markup, width, height, 2));
      }
      setStatus(kind === "png" ? "PNG baixado" : "SVG baixado");
    } catch {
      setStatus("Não foi possível exportar");
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button ref={ref} variant="ghost" size="icon" aria-label={`Exportar: ${title}`} title="Baixar ou citar" className={cn("text-muted-foreground print:hidden", className)}>
              {status && status !== "Não foi possível exportar" && status !== "Gráfico não encontrado" ? <Check className="text-good-ink" /> : <Download />}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
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
              <DropdownMenuItem onClick={() => downloadCsv(`${base}.csv`, toCsv(csv.columns, csv.rows))}>
                <FileSpreadsheet className="text-muted-foreground" />
                Dados em CSV
              </DropdownMenuItem>
            )}
            {csv && (
              <DropdownMenuItem onClick={() => downloadCsv(`${base}_excel.csv`, toCsv(csv.columns, csv.rows, { excel: true }))}>
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

const pageUrl = () => (typeof window === "undefined" ? SITE_URL : `${SITE_URL}${window.location.pathname}${window.location.search}`);

/** "Radar MDE (2026). <título>. <url>. Fonte: FNDE/SIOPE. Acesso em 07/10/2026." */
export function citation(title: string, source = "FNDE/SIOPE", date = new Date()) {
  const t = title.replace(/\.\s*$/, "");
  return `Radar MDE (${date.getFullYear()}). ${t}. ${pageUrl()}. Fonte: ${source}. Acesso em ${date.toLocaleDateString("pt-BR")}.`;
}

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

function buildExport(svg: SVGSVGElement, { title, source, note, url }: { title: string; source: string; note?: string; url: string }) {
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

  const pad = 20;
  const width = Math.max(w + pad * 2, 480);
  const titleLines = wrap(title, Math.floor((width - pad * 2) / 8.4));
  const top = pad + titleLines.length * 22 + 10;
  const footer = [`Fonte: ${source}. Radar MDE · Brasil — ${url}`, note].filter(Boolean) as string[];
  const height = top + h + 14 + footer.length * 16 + pad - 4;

  clone.setAttribute("x", String((width - w) / 2));
  clone.setAttribute("y", String(top));
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  clone.removeAttribute("aria-hidden");
  clone.removeAttribute("aria-label");
  clone.removeAttribute("style");

  const text = (y: number, s: string, size: number, color: string, weight = 400) =>
    `<text x="${pad}" y="${y}" font-family="${esc(font)}" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(s)}</text>`;
  const markup = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${esc(title)}</title>`,
    `<rect width="100%" height="100%" fill="${bg}"/>`,
    ...titleLines.map((l, i) => text(pad + 15 + i * 22, l, 16, ink, 600)),
    new XMLSerializer().serializeToString(clone),
    ...footer.map((l, i) => text(top + h + 18 + i * 16, l, 11, muted)),
    `</svg>`,
  ].join("\n");
  return { markup, width, height };
}

function opaque(c: string | undefined) {
  if (!c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c)) return null;
  return c;
}

function wrap(s: string, max: number) {
  const out: string[] = [];
  let line = "";
  for (const word of s.split(/\s+/)) {
    if (line && (line + " " + word).length > max) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
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
