"use client";

import { Check, Copy, ExternalLink, Mail, MessageCircle, RotateCcw, Send } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Template } from "@/lib/templates";

const STEP = ["Pedir dados", "Conselho", "Câmara", "Fiscalização"];

/** Fills the signature placeholders of a letter with what the reader typed once above the tabs. */
const sign = (text: string, name: string, contact: string) =>
  text.replaceAll("[Seu nome]", name.trim() || "[Seu nome]").replaceAll("[Contato]", contact.trim() || "[Contato]");

/**
 * Ready-to-send letters as a chooser of plain-language options (a grid of cards, so nothing is cut off at 375px),
 * each with the letter (editable in place), where to send it, and copy / WhatsApp / e-mail actions.
 * Edits, name and contact live here (not in the tab panels, which unmount), so switching letters keeps them.
 */
export default function ActionKit({ templates }: { templates: Template[] }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const nameId = useId();
  const contactId = useId();
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
              {edits[t.id] != null && edits[t.id] !== t.body && " · editado"}
            </span>
            <span className="text-[0.8125rem] leading-5 font-medium">{t.title}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-2 sm:px-5">
        <div className="grid gap-1">
          <label htmlFor={nameId} className="text-xs text-muted-foreground">
            Seu nome (opcional, entra em todas as cartas)
          </label>
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="[Seu nome]" />
        </div>
        <div className="grid gap-1">
          <label htmlFor={contactId} className="text-xs text-muted-foreground">
            Contato (e-mail ou telefone, opcional)
          </label>
          <Input id={contactId} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" placeholder="[Contato]" />
        </div>
      </div>
      {templates.map((t) => (
        <TabsContent key={t.id} value={t.id} className="p-4 sm:p-5">
          <Letter
            t={t}
            text={sign(edits[t.id] ?? t.body, name, contact)}
            edited={edits[t.id] != null && edits[t.id] !== t.body}
            onChange={(v) => setEdits((m) => ({ ...m, [t.id]: v }))}
            onReset={() =>
              setEdits((m) => {
                const n = { ...m };
                delete n[t.id];
                return n;
              })
            }
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

type Status = "idle" | "copied" | "manual" | "mail";

function Letter({ t, text, edited, onChange, onReset }: { t: Template; text: string; edited: boolean; onChange: (v: string) => void; onReset: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (status !== "copied") return;
    const id = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(id);
  }, [status]);
  const copy = async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard API can be blocked (iframes, http); fall back to selecting the text
      area.current?.select();
      return !!document.execCommand?.("copy");
    }
  };
  // mail clients truncate long mailto: URLs (~2.000 chars): the full letter goes to the clipboard, the body only says so
  const mail = `mailto:?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(
    "(O texto completo foi copiado pelo Radar MDE: cole aqui com Ctrl+V ou ⌘+V.)\n\n",
  )}`;
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const link = "inline-flex min-h-6 items-center gap-1 text-brand-ink hover:underline";
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm leading-6 text-pretty">{t.who}</p>

      <div className="grid gap-3 text-[0.8125rem] leading-5 text-muted-foreground md:grid-cols-2">
        <div className="flex min-w-0 gap-2">
          <Send aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium text-foreground">Para:</span> {t.to}
          </span>
        </div>
        <div className="min-w-0">
          <span className="font-medium text-foreground">Onde enviar:</span> {t.where.text}
          {t.where.links.length > 0 && (
            <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {t.where.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className={link}>
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
        <Button variant={status === "copied" ? "outline" : "default"} onClick={async () => setStatus((await copy()) ? "copied" : "manual")}>
          {status === "copied" ? <Check className="text-good-ink" /> : <Copy />}
          {status === "copied" ? "Copiado" : "Copiar texto"}
        </Button>
        <Button variant="outline" render={<a href={wa} target="_blank" rel="noreferrer" />} nativeButton={false}>
          <MessageCircle className="text-muted-foreground" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          render={<a href={mail} />}
          nativeButton={false}
          onClick={() => {
            void copy().then((ok) => setStatus(ok ? "mail" : "manual"));
          }}
        >
          <Mail className="text-muted-foreground" />
          E-mail
        </Button>
        {edited && (
          <Button variant="ghost" onClick={onReset} className="text-muted-foreground">
            <RotateCcw />
            Desfazer edições
          </Button>
        )}
      </div>

      <textarea
        ref={area}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-label={`Texto do modelo “${t.title}” (pode ser editado)`}
        aria-describedby={`${t.id}-hint`}
        className="scroll-thin block h-80 w-full resize-y rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <p id={`${t.id}-hint`} className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {status === "manual"
          ? "Texto selecionado: use Ctrl+C (ou ⌘+C) para copiar."
          : status === "copied"
            ? "Texto copiado. Cole no e-mail, no sistema e-SIC ou num documento."
            : status === "mail"
              ? "Texto copiado: no e-mail que abriu, cole no corpo da mensagem (Ctrl+V ou ⌘+V)."
              : "Você pode editar o texto aqui; as edições ficam guardadas ao trocar de carta. Revise os dados antes de enviar. Nada é enviado pelo Radar."}
      </p>
    </div>
  );
}
