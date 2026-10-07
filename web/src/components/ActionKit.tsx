"use client";

import { Check, Copy, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Template = { id: string; title: string; to: string; body: string };

/** Ready-to-send letters (LAI, CACS-Fundeb, vereador, tribunal de contas) as tabs, each with a copy button. */
export default function ActionKit({ templates }: { templates: Template[] }) {
  return (
    <Tabs defaultValue={templates[0].id} className="gap-0">
      <div className="scroll-thin overflow-x-auto border-b px-4 sm:px-5">
        <TabsList variant="line" className="h-10! gap-4 p-0">
          {templates.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="h-10 flex-none px-0 text-[13px] group-data-horizontal/tabs:after:bottom-0">
              {t.title}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {templates.map((t) => (
        <TabsContent key={t.id} value={t.id} className="p-4 sm:p-5">
          <Letter t={t} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Letter({ t }: { t: Template }) {
  const [copied, setCopied] = useState<"no" | "yes" | "manual">("no");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (copied !== "yes") return;
    const id = setTimeout(() => setCopied("no"), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t.body);
      setCopied("yes");
    } catch {
      // Clipboard API can be blocked (iframes, http); fall back to selecting the text
      area.current?.select();
      setCopied(document.execCommand?.("copy") ? "yes" : "manual");
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-start gap-2 text-[13px] text-muted-foreground">
          <Send className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium text-foreground">Para:</span> {t.to}
          </span>
        </p>
        <Button variant={copied === "yes" ? "outline" : "default"} size="sm" onClick={copy} className="shrink-0">
          {copied === "yes" ? <Check className="text-good-ink" /> : <Copy />}
          {copied === "yes" ? "Copiado" : "Copiar texto"}
        </Button>
      </div>
      <div className="relative">
        <textarea
          ref={area}
          readOnly
          value={t.body}
          aria-label={`Texto do modelo: ${t.title}`}
          className="scroll-thin block h-80 w-full resize-y rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {copied === "manual"
          ? "Texto selecionado: use Ctrl+C (ou ⌘+C) para copiar."
          : copied === "yes"
            ? "Texto copiado. Cole no e-mail, no sistema e-SIC ou num documento."
            : "Revise os dados e acrescente seu nome antes de enviar."}
      </p>
    </div>
  );
}
