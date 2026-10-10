"use client";

import { Check, Link2, MessageCircle, Share, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { DropdownMenu, type DropdownItem } from "@/components/arc/dropdown-menu/dropdown-menu";
import { absoluteUrl } from "@/lib/site";

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
  const items: DropdownItem[] = [
    { label: "Copiar link", icon: <Link2 />, onSelect: copy },
    {
      label: "Enviar no WhatsApp",
      icon: <MessageCircle />,
      onSelect: () => window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url()}`)}`, "_blank", "noopener"),
    },
  ];
  if (native)
    items.push({
      label: "Mais opções…",
      icon: <Share2 />,
      separatorBefore: true,
      onSelect: () => navigator.share({ title: document.title, text, url: url() }).catch(() => {}),
    });
  return (
    <span className="contents print:hidden">
      <DropdownMenu label={copied ? "Link copiado" : "Compartilhar"} icon={copied ? <Check className="size-4 text-good-ink" /> : <Share className="size-4" />} items={items} />
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Link copiado para a área de transferência" : ""}
      </span>
    </span>
  );
}
