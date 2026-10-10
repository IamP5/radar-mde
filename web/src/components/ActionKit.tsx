"use client";

import { Check, Copy, ExternalLink, Mail, MessageCircle, RotateCcw, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/arc/input/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs";
import { Textarea } from "@/components/arc/textarea/textarea";
import { ButtonLink } from "@/components/kit/button-link";
import type { Template } from "@/lib/templates";

const STEP = ["Pedir dados", "Conselho", "Câmara", "Fiscalização"];

/** Fills the signature placeholders of a letter with what the reader typed once above the tabs. */
const sign = (text: string, name: string, contact: string) =>
  text.replaceAll("[Seu nome]", name.trim() || "[Seu nome]").replaceAll("[Contato]", contact.trim() || "[Contato]");

/**
 * Ready-to-send letters as tabs of plain-language options (the list scrolls sideways on phones), each with the letter (editable in place), where to send it, and copy / WhatsApp / e-mail actions.
 * Edits, name and contact live here (not in the tab panels, which unmount), so switching letters keeps them.
 */
export default function ActionKit({ templates }: { templates: Template[] }) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  return (
    <Tabs defaultValue={templates[0].id}>
      <div className="border-b p-3 sm:p-4">
        <TabsList aria-label="Escolha o que fazer">
          {templates.map((t, i) => (
            <TabsTrigger key={t.id} value={t.id}>
              <span className="block py-2 text-left">
                <span className="block text-xs font-normal text-muted-foreground">
                  {i + 1}. {STEP[i] ?? ""}
                  {edits[t.id] != null && edits[t.id] !== t.body && " · editado"}
                </span>
                <span className="block">{t.title}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2 sm:px-5">
        <Input label="Seu nome" description="Opcional, entra em todas as cartas." value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="[Seu nome]" />
        <Input label="Contato" description="E-mail ou telefone, opcional." value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" placeholder="[Contato]" />
      </div>
      {templates.map((t) => (
        <TabsContent key={t.id} value={t.id} className="px-4 pb-4 sm:px-5 sm:pb-5">
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

/** Phones and tablets paste with a long press, not Ctrl+V (CIT-25); read at click time, never during render. */
const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
const PASTE_TOUCH = "toque e segure e escolha Colar";
const PASTE_KEYS = "Ctrl+V ou ⌘+V";

function Letter({ t, text, edited, onChange, onReset }: { t: Template; text: string; edited: boolean; onChange: (v: string) => void; onReset: () => void }) {
  const [status, setStatus] = useState<Status>("idle");
  const [touch, setTouch] = useState(false);
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
    "(O texto completo foi copiado pelo Radar MDE. Cole aqui: no celular, toque e segure e escolha Colar; no computador, Ctrl+V ou ⌘+V.)\n\n",
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
        <Button
          variant="primary"
          size="sm"
          onClick={async () => {
            setTouch(isTouch());
            setStatus((await copy()) ? "copied" : "manual");
          }}
        >
          {status === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
          {status === "copied" ? "Copiado" : "Copiar texto"}
        </Button>
        <ButtonLink external href={wa} target="_blank" rel="noreferrer">
          <MessageCircle aria-hidden className="size-4 text-muted-foreground" />
          WhatsApp
        </ButtonLink>
        <ButtonLink
          external
          href={mail}
          onClick={() => {
            setTouch(isTouch());
            void copy().then((ok) => setStatus(ok ? "mail" : "manual"));
          }}
        >
          <Mail aria-hidden className="size-4 text-muted-foreground" />
          E-mail
        </ButtonLink>
        {edited && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" />
            Desfazer edições
          </Button>
        )}
      </div>

      <Textarea
        ref={area}
        label="Texto do modelo (pode ser editado)"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        aria-describedby={`${t.id}-hint`}
        className="scroll-thin h-80"
      />
      <p id={`${t.id}-hint`} className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {status === "manual"
          ? touch
            ? "Texto selecionado: toque e segure sobre ele e escolha Copiar."
            : "Texto selecionado: use Ctrl+C (ou ⌘+C) para copiar."
          : status === "copied"
            ? `Texto copiado. Cole no e-mail, no sistema e-SIC ou num documento (${touch ? PASTE_TOUCH : PASTE_KEYS}).`
            : status === "mail"
              ? `Texto copiado: no e-mail que abriu, cole no corpo da mensagem (${touch ? PASTE_TOUCH : PASTE_KEYS}).`
              : "Você pode editar o texto aqui; as edições ficam guardadas ao trocar de carta. Revise os dados antes de enviar. Nada é enviado pelo Radar."}
      </p>
    </div>
  );
}
