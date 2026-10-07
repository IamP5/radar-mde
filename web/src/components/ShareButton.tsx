"use client";

import { Check, Link2, MessageCircle, Share, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/site";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Share menu (link keeps ?ano=): copy link (with inline "copiado" feedback), WhatsApp, and the native sheet where available. */
export default function ShareButton({ text, path }: { text: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator is only readable after hydration
    setNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  // keep the selected year (?ano=, mirrored by useYear) so the link opens on the same exercise
  const url = () => {
    const ano = new URLSearchParams(window.location.search).get("ano");
    return absoluteUrl(`${path}${ano && /^\d{4}$/.test(ano) ? `?ano=${ano}` : ""}`);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
    } catch {
      window.prompt("Copie o link:", url());
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" className="print:hidden">
              {copied ? <Check className="text-good-ink" /> : <Share className="text-muted-foreground" />}
              {copied ? "Link copiado" : "Compartilhar"}
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={copy}>
            <Link2 className="text-muted-foreground" />
            Copiar link
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url()}`)}`, "_blank", "noopener")}
          >
            <MessageCircle className="text-muted-foreground" />
            Enviar no WhatsApp
          </DropdownMenuItem>
          {native && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigator.share({ title: document.title, text, url: url() }).catch(() => {})}>
                <Share2 className="text-muted-foreground" />
                Mais opções…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Link copiado para a área de transferência" : ""}
      </span>
    </>
  );
}
