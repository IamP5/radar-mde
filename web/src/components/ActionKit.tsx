"use client";

import { Check, Copy, ExternalLink, Mail, MessageCircle, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Template } from "@/lib/templates";

const STEP = ["Pedir dados", "Conselho", "Câmara", "Fiscalização"];

/**
 * Ready-to-send letters as a chooser of plain-language options (a grid of cards, so nothing is cut off at 375px),
 * each with the letter (editable in place), where to send it, and copy / WhatsApp / e-mail actions.
 */
export default function ActionKit({ templates }: { templates: Template[] }) {
  return (
    <Tabs defaultValue={templates[0].id} className="gap-0">
      <TabsList
        aria-label="Escolha o que fazer"
        className="grid h-auto! w-full grid-cols-1 gap-2 rounded-none border-b bg-transparent p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4"
      >
        {templates.map((t, i) => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            className="h-auto! flex-col items-start justify-start gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left whitespace-normal text-foreground after:hidden hover:bg-accent/60 data-active:border-foreground/60 data-active:bg-accent/60 data-active:shadow-[inset_0_0_0_1px_var(--foreground)] dark:data-active:border-foreground/60 dark:data-active:bg-accent/60"
          >
            <span className="text-xs font-normal text-muted-foreground">
              {i + 1}. {STEP[i] ?? ""}
            </span>
            <span className="text-[13px] leading-5 font-medium">{t.title}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {templates.map((t) => (
        <TabsContent key={t.id} value={t.id} className="p-4 sm:p-5">
          <Letter t={t} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Letter({ t }: { t: Template }) {
  const [text, setText] = useState(t.body);
  const [copied, setCopied] = useState<"no" | "yes" | "manual">("no");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (copied !== "yes") return;
    const id = setTimeout(() => setCopied("no"), 2500);
    return () => clearTimeout(id);
  }, [copied]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      // Clipboard API can be blocked (iframes, http); fall back to selecting the text
      area.current?.select();
      setCopied(document.execCommand?.("copy") ? "yes" : "manual");
    }
  };
  const edited = text !== t.body;
  const mail = `mailto:?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(text)}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-pretty">{t.who}</p>

      <div className="grid gap-3 text-[13px] leading-5 text-muted-foreground md:grid-cols-2">
        <div className="flex min-w-0 gap-2">
          <Send aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium text-foreground">Para:</span> {t.to}
          </span>
        </div>
        <div className="min-w-0">
          <span className="font-medium text-foreground">Onde enviar:</span> {t.where.text}
          {t.where.links.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
              {t.where.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center gap-1 text-brand-ink hover:underline">
                  {l.label}
                  <ExternalLink aria-hidden className="size-3" />
                  <span className="sr-only"> (abre em nova aba)</span>
                </a>
              ))}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant={copied === "yes" ? "outline" : "default"} onClick={copy}>
          {copied === "yes" ? <Check className="text-good-ink" /> : <Copy />}
          {copied === "yes" ? "Copiado" : "Copiar texto"}
        </Button>
        <Button variant="outline" render={<a href={wa} target="_blank" rel="noreferrer" />} nativeButton={false}>
          <MessageCircle className="text-muted-foreground" />
          WhatsApp
        </Button>
        <Button variant="outline" render={<a href={mail} />} nativeButton={false}>
          <Mail className="text-muted-foreground" />
          E-mail
        </Button>
        {edited && (
          <Button variant="ghost" onClick={() => setText(t.body)} className="text-muted-foreground">
            <RotateCcw />
            Desfazer edições
          </Button>
        )}
      </div>

      <textarea
        ref={area}
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        aria-label={`Texto do modelo “${t.title}” (pode ser editado)`}
        aria-describedby={`${t.id}-hint`}
        className="scroll-thin block h-80 w-full resize-y rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <p id={`${t.id}-hint`} className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {copied === "manual"
          ? "Texto selecionado: use Ctrl+C (ou ⌘+C) para copiar."
          : copied === "yes"
            ? "Texto copiado. Cole no e-mail, no sistema e-SIC ou num documento."
            : "Você pode editar o texto aqui: troque [Seu nome] e [Contato] e revise os dados antes de enviar. Nada é enviado pelo Radar."}
      </p>
    </div>
  );
}
